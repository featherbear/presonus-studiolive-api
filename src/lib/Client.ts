import "./util/logging";

import type { DiscoveryType, ChannelCount, SubscriptionOptions, ChannelSelector, FileListItem } from "./types";
import { ChannelSwitch, type ChannelSwitchName } from "./types/ChannelSwitch";
import type * as InstanceOptions from "./types/InstanceOptions";
import type { MeterData } from "./MeterServer";

import { Channel, type ChannelTypes, MessageCode, type ConnectionState } from "./constants";

import { EventEmitter } from "node:events";

import * as packetParser from "./packetParser";
import Discovery from "./Discovery";
import MeterServer from "./MeterServer";

import DataClient from "./util/DataClient";
import { analysePacket, createPacket } from "./util/messageProtocol";
import { parseChannelString, setCounts } from "./util/channelUtil";
import { toShort, toFloat, toBoolean } from "./util/bufferUtil";
import { craftSubscribe, unsubscribePacket } from "./util/subscriptionUtil";
import CacheProvider from "./util/CacheProvider";
import { tokenisePath, simplifyPathTokens } from "./util/treeUtil";
import { doesLookupMatch } from "./util/ValueTransformer";
import { ignorePV } from "./util/transformers";
import { logVolumeToLinear, transitionValue, UniqueRandom } from "./util/valueUtil";
import { dumpNode, ZlibRangeSymbol, type ZlibNode } from "./util/zlib/zlibNodeParser";
import { getZlibValue } from "./util/zlib/zlibUtil";
import KeepAliveHelper from "./util/KeepAliveHelper";
import * as FDHelper from "./util/fileRequestUtil";
import { JSONtoPacketBuffer } from "./util/jsonPacketUtil";

// Forward discovery events
const discovery = new Discovery();

type APIEventMap = { [_ in keyof typeof ConnectionState]: [] } & {
	[_ in MessageCode]: [any];
} & {
	meter: [MeterData];
	data: [
		{
			code: MessageCode;
			data: any;
		},
	];
};

export class Client {
	readonly serverHost: string;
	readonly serverPort: number;
	readonly options: Partial<InstanceOptions.InstanceOptions>;

	channelCounts: ChannelCount;

	meteringClient: Awaited<ReturnType<typeof MeterServer>>;
	private eventEmitter: EventEmitter<APIEventMap>;
	private fileDataEmitter: EventEmitter;

	private keepAliveHelper: KeepAliveHelper;

	readonly state: ReturnType<typeof CacheProvider>;
	private zlibData?: ZlibNode;

	private conn: ReturnType<typeof DataClient>;
	private connectPromise: Promise<Client>;

	constructor(address: InstanceOptions.ConnectionAddress, options?: Partial<InstanceOptions.InstanceOptions>) {
		if (!address?.host) throw new Error("Host address not supplied");

		this.eventEmitter = new EventEmitter();
		this.fileDataEmitter = new EventEmitter();

		this.serverHost = address.host;
		this.serverPort = address?.port || 53000;
		this.options = options;

		if (typeof this.options?.logLevel !== "undefined") {
			logger.level(this.options.logLevel);
		}

		this.meteringClient = null;

		this.conn = DataClient(this.handleRecvPacket.bind(this));

		this.state = CacheProvider({
			get: (key) => (this.zlibData ? getZlibValue(this.zlibData, key) : null),
		});

		this.on(MessageCode.ZLIB, (ZB) => {
			this.zlibData = ZB;
		});

		this.on(MessageCode.ParamValue, ({ name, value }) => {
			// Tokenise ahead of time
			name = tokenisePath(name);

			for (const ignoreKey of ignorePV) {
				if (doesLookupMatch(ignoreKey, name)) return;
			}

			this.state.set(name, value);
		});

		this.on(MessageCode.ParamString, ({ name, value }) => {
			this.state.set(name, value);
		});

		this.on(MessageCode.ParamChars, ({ name, value }) => {
			this.state.set(name, value);
		});

		this.on(MessageCode.FaderPosition, (MS: { [_ in ChannelTypes]: number[] }) => {
			for (const [type, values] of Object.entries(MS)) {
				for (let i = 0; i < values.length; i++) {
					this.state.set(`${Channel[type]}/ch${i + 1}/volume`, values[i]);
				}
			}
		});

		this.on(MessageCode.FileData, ({ id, data }) => {
			this.fileDataEmitter.emit(id, data);
		});
	}

	protected emit<K extends keyof APIEventMap>(event: K, ...data: APIEventMap[K]): this {
		this.eventEmitter.emit(event, ...(data as any));
		return this;
	}

	on<K extends keyof APIEventMap>(event: K, listener: (...arg: APIEventMap[K]) => void): this {
		this.eventEmitter.on(event, listener as any);
		return this;
	}

	once<K extends keyof APIEventMap>(event: K, listener: (...arg: APIEventMap[K]) => void): this {
		this.eventEmitter.once(event, listener as any);
		return this;
	}

	off<K extends keyof APIEventMap>(event: K, listener: (...arg: APIEventMap[K]) => void): this {
		this.eventEmitter.off(event, listener as any);
		return this;
	}
	addListener<K extends keyof APIEventMap>(event: K, listener: (...arg: APIEventMap[K]) => void): this {
		this.eventEmitter.addListener(event, listener as any);
		return this;
	}

	removeListener<K extends keyof APIEventMap>(event: K, listener: (...arg: APIEventMap[K]) => void): this {
		this.eventEmitter.removeListener(event, listener as any);
		return this;
	}
	/**
	 * Extracts the data structure and cache layer
	 * @internal
	 */
	dumpState(): any {
		return {
			internal: dumpNode(this.zlibData),
			cache: this.state._data.toJSON(),
		};
	}

	// introspectStateType(key: string | string[]) {
	//   enum PropertyType {
	//     String,
	//     Float,
	//     Number,
	//     Boolean
	//   }

	//   let value = getZlibValue(this.zlibData, key)
	//   switch (typeof value) {
	//     case 'string': {
	//       return
	//     }
	//   }
	// }

	/**
	 * @param timeout Default 10s
	 */
	static async discover(timeout = 10 * 1000) {
		const devices: { [serial: string]: DiscoveryType } = {};
		const func = (device) => {
			devices[device.serial] = device;
		};

		discovery.on("discover", func);
		await discovery.start(timeout);
		discovery.off("discover", func);

		return Object.values(devices);
	}

	/**
	 * Subscribe to the metering data
	 */
	async meterSubscribe(port?: number) {
		port = port ?? 0;
		this.meteringClient = await MeterServer.call(this, port, (meterData: MeterData) => this.emit("meter", meterData));
		this._sendPacket(MessageCode.Hello, toShort(this.meteringClient.address().port), 0x00);
	}

	/**
	 * Unsubscribe from the metering data
	 */
	meterUnsubscribe() {
		if (!this.meteringClient) return;
		this.meteringClient.close();
		this.meteringClient = null;
	}

	async connect(subscribeData?: SubscriptionOptions) {
		if (this.connectPromise) return this.connectPromise;

		const connectPromise = new Promise<this>((resolve, reject) => {
			let fastReconnectTimer: ReturnType<typeof setTimeout>;
			logger.info({ host: this.serverHost, port: this.serverPort }, "Connecting to console");

			const reconnect = () => {
				logger.debug("Reconnecting");
				doConnect();
			};

			this.conn.addListener("connect", () => {
				clearTimeout(fastReconnectTimer);

				this.keepAliveHelper = new KeepAliveHelper(3000);

				// #region Connection handshake

				// The zlib payload may come either as a ZB or CK packet
				const chunkedZlibInitCallback = (data) => {
					this.removeListener(MessageCode.Chunk, chunkedZlibInitCallback);
					this.emit(MessageCode.ZLIB, data);
				};
				this.addListener(MessageCode.Chunk, chunkedZlibInitCallback);

				Promise.all([
					new Promise((resolve) => {
						// TODO: Do DCAs change during project/scene recall?
						this.once(MessageCode.ZLIB, () => {
							// De-register the listener in case the payload was not encapsulated in a CK packet
							this.removeListener(MessageCode.Chunk, chunkedZlibInitCallback);

							const getCount = (key) => Object.keys(this.state.get(key) ?? {}).length;
							const channelCounts: ChannelCount = {
								LINE: getCount("line"),
								AUX: getCount("aux"),
								FX /* fxbus == fxreturn */: getCount("fxbus"),
								FXRETURN: getCount("fxreturn"),
								RETURN /* aka tape? */: getCount("return"),
								TALKBACK: getCount("talkback"),
								MAIN: getCount("main"),
								DCA: getCount("filtergroup"),
								/**
								 * 16R doesn't have SUB groups
								 */
								SUB: getCount("sub"),

								/**
								 * Exclusive to the 64S
								 */
								MASTER: getCount("master"),

								/**
								 * Exclusive to the 64S
								 */
								MONO: getCount("mono"),
							};
							this.channelCounts = channelCounts;
							setCounts(channelCounts);
							resolve(this);
						});
					}),

					/**
					 * Await for the subscription success
					 */
					new Promise((resolve) => {
						const subscribeCallback = (data) => {
							if (data.id === "SubscriptionReply") {
								this.removeListener(MessageCode.JSON, subscribeCallback);
								resolve(this);
							}
						};
						this.addListener(MessageCode.JSON, subscribeCallback);
					}),
				]).then(() => {
					this.keepAliveHelper.start(
						(packets) => {
							packets.forEach((bytes) => this._writeBytes(bytes));
						},
						() => {
							if (!this.conn.destroyed) this.conn.destroy();
							logger.info("Connection closed");
							this.emit("closed");

							console.log("conn was closed so will reconnect");
							if (this.options?.autoreconnect) {
								this.emit("reconnecting");
								reconnect();
							}
						},
					);

					logger.info("Connected");
					this.emit("connected");
					resolve(this);
				});

				// Send subscription request
				this._sendPacket(MessageCode.JSON, craftSubscribe(subscribeData));
				// #endregion
			});

			const doConnect = () => {
				this.conn.destroy();
				fastReconnectTimer = setTimeout(() => reconnect(), 2000);
				this.conn.connect(this.serverPort, this.serverHost);
				this.conn.once("error", () => {});
			};

			doConnect();
		});
		this.connectPromise = connectPromise;
		return connectPromise;
	}

	async close() {
		this.meterUnsubscribe();
		await this._sendPacket(MessageCode.JSON, unsubscribePacket).then(() => {
			this.conn.destroy();
		});
	}

	/**
	 * Analyse, decode and emit packets
	 */
	private handleRecvPacket(packet) {
		let [messageCode, data] = analysePacket(packet);
		if (messageCode === null) return;

		// Handle message types
		const handlers: { [k in MessageCode]?: (data) => any } = {
			[MessageCode.JSON]: packetParser.handleJMPacket,
			[MessageCode.ParamValue]: packetParser.handlePVPacket,
			[MessageCode.ParamString]: packetParser.handlePSPacket,
			[MessageCode.ZLIB]: packetParser.handleZBPacket,
			[MessageCode.FaderPosition]: packetParser.handleMSPacket,
			[MessageCode.Chunk]: packetParser.handleCKPacket,
			[MessageCode.ParamChars]: packetParser.handlePCPacket,
			[MessageCode.FileData]: this.keepAliveHelper.intercept(packetParser.handleFDPacket),
			[MessageCode.DeviceList]: null,
			[MessageCode.Unknown1]: null,
			[MessageCode.Unknown3]: null,
		};

		if (Object.hasOwn(handlers, messageCode)) {
			data = handlers[messageCode]?.call?.(this, data);
		} else {
			console.warn("Unhandled message code", messageCode);
		}

		if (!data) return;
		this.emit(messageCode, data);
		this.emit("data", { code: messageCode, data });
	}

	/**
	 * Get projects stored on the console
	 * @param fetchScenes Should scenes be fetched as well
	 */
	async getProjects(fetchScenes: true): Promise<FileListItem.ProjectItem<{ scenes: FileListItem.SceneItem[] }>[]>;
	async getProjects(fetchScenes?: false): Promise<FileListItem.ProjectItem[]>;
	async getProjects(fetchScenes?: boolean) {
		if (!fetchScenes) return this.sendList(FDHelper.PROJECTS);

		const result: FileListItem.ProjectItem<{
			scenes: FileListItem.SceneItem[];
		}>[] = [];

		for (const project of await this.getProjects(false)) {
			result.push({
				...project,
				scenes: await this.getScenesOfProject(project.name),
			});
		}

		return result;
	}

	async getScenes() {
		return this.getScenesOfProject(this.currentProject);
	}

	/**
	 * Get scenes of a project stored on the console
	 */
	getScenesOfProject(projFile: string): Promise<FileListItem.SceneItem[]> {
		return this.sendList(FDHelper.SCENES_OF(projFile));
	}

	/**
	 * Current loaded scene
	 */
	get currentScene() {
		const path: string = this.state.get("presets.loaded_scene_name", "");
		return path.slice(path.lastIndexOf("/") + 1) || null;
	}

	/**
	 * Current loaded project
	 */
	get currentProject() {
		const path: string = this.state.get("presets.loaded_project_name", "");
		return path.slice(path.lastIndexOf("/") + 1) || null;
	}

	/**
	 * Get channel presets stored on the console
	 */
	getChannelPresets(): Promise<FileListItem.ChannelPresetItem[]> {
		return this.sendList(FDHelper.CHANNEL_PRESETS);
	}

	sendList(key: typeof FDHelper.PROJECTS): Promise<FileListItem.ProjectItem[]>;
	sendList(key: typeof FDHelper.CHANNEL_PRESETS): Promise<FileListItem.ChannelPresetItem[]>;
	sendList(key: ReturnType<typeof FDHelper.SCENES_OF>): Promise<FileListItem.SceneItem[]>;
	sendList<T = unknown>(key: string): Promise<T> {
		const id = UniqueRandom.get(16).request();

		const idBuffer = Buffer.allocUnsafe(2);
		idBuffer.writeUInt16BE(id); // Different to bufferUtil::toShort()

		return new Promise<T>((resolve, reject) => {
			let timeout: ReturnType<typeof setTimeout>;

			const callback = (data: any) => {
				clearTimeout(timeout);

				if (key === FDHelper.PROJECTS || key === FDHelper.CHANNEL_PRESETS || key.startsWith(FDHelper.SCENES_OF(""))) {
					data = data?.files
						?.filter(({ title }) => title !== "* Empty Location *")
						?.filter(({ name }) => !(name.endsWith(".lock") || name.endsWith(".cnfg")));
				}

				return resolve(data);
			};

			const eventName = id.toString();
			this.fileDataEmitter.once(eventName, callback);

			this._sendPacket(
				MessageCode.FileRequest,
				Buffer.concat([idBuffer, Buffer.from("List" + key.toString()), Buffer.from([0x00, 0x00])]),
			);

			timeout = setTimeout(() => {
				this.fileDataEmitter.removeListener(eventName, callback);
				UniqueRandom.get(16).release(id);
				reject(new Error("Timeout"));
			}, 10 * 1000);
		});
	}

	/**
	 * Send bytes to the console
	 */
	private async _sendPacket(...params: Parameters<typeof createPacket>) {
		return this._writeBytes(createPacket(...params));
	}

	private async _writeBytes(bytes: Buffer) {
		return new Promise((resolve) => {
			this.conn.write(bytes, null, (resp) => {
				resolve(resp);
			});
		});
	}

	/**
	 * @param projFile e.g 01.Showfile.proj
	 */
	recallProject(projFile: string) {
		this._sendPacket(
			MessageCode.JSON,
			JSONtoPacketBuffer({
				id: "RestorePreset",
				url: "presets",
				presetTarget: "",
				presetTargetSlave: 0,
				presetFile: "presets/proj/" + projFile,
			}),
		);
	}

	/**
	 *
	 * @param projFile e.g. 01.Showfile.proj
	 * @param sceneFile e.g. 02.SceneBackup.scn
	 */
	recallProjectScene(projFile: string, sceneFile: string) {
		this._sendPacket(
			MessageCode.JSON,
			JSONtoPacketBuffer({
				id: "RestorePreset",
				url: "presets",
				presetTarget: "",
				presetTargetSlave: 0,
				presetFile: `presets/proj/${projFile}/${sceneFile}`,
			}),
		);
	}

	recallChannelStrip(selector: ChannelSelector, chanFile: string) {
		this._sendPacket(
			MessageCode.JSON,
			JSONtoPacketBuffer({
				id: "RestorePreset",
				url: "presets",
				// FIXME: Implement whitelist
				presetTarget: parseChannelString(selector, ["LINE", "AUX", "FX" /* 'FXRETURN' ??? */, "MAIN"]),
				presetTargetSlave: 0,
				presetFile: "presets/channel/" + chanFile,
			}),
		);
	}

	/**
	 * Mute a given channel
	 */
	mute(selector: ChannelSelector) {
		this.setMute(selector, true);
	}

	/**
	 * Unmute a given channel
	 */
	unmute(selector: ChannelSelector) {
		this.setMute(selector, false);
	}

	/**
	 * Toggle the mute status of a channel
	 */
	toggleMute(selector: ChannelSelector) {
		this.setMute(selector, "toggle");
	}

	/**
	 * Get mute status of a channel
	 */
	getMute(selector: ChannelSelector) {
		const state = this.state.get(this._getMuteTargetString(selector));
		if (state === null) return null;

		// AUX and FX mixes have inverted states
		return selector.mixType ? !state : state;
	}

	/**
	 * Set the mute status of a channel
	 */
	setMute(selector: ChannelSelector, status: boolean | "toggle") {
		const targetString = this._getMuteTargetString(selector);

		// AUX and FX mixes have inverted states
		const shouldInvert = !!selector.mixType;

		let state: boolean = status === "toggle" ? !this.state.get(targetString) : status;
		if (status !== "toggle" && shouldInvert) state = !state;

		this._sendPacket(
			MessageCode.ParamValue,
			Buffer.concat([Buffer.from(targetString + "\x00\x00\x00"), toBoolean(state)]),
		);
	}

	/**
	 * @private
	 */
	private _getMuteTargetString(selector: ChannelSelector) {
		let targetString = parseChannelString(selector);

		if (selector.mixType) {
			targetString += `/assign_${selector.mixType.toLowerCase()}${selector.mixNumber}`;
		} else {
			targetString += "/mute";
		}

		return targetString;
	}

	/**
	 * Toggle the solo status of a channel
	 */
	toggleSolo(selector: ChannelSelector) {
		this.setSolo(selector, "toggle");
	}

	/**
	 * Get solo status of a channel
	 */
	getSolo(selector: ChannelSelector) {
		const state = this.state.get(this._getSoloTargetString(selector));
		if (state === null) return null;
		return state;
	}

	/**
	 * Set the solo status of a channel
	 */
	setSolo(selector: ChannelSelector, status: boolean | "toggle") {
		const targetString = this._getSoloTargetString(selector);

		// AUX and FX mixes have inverted states
		const shouldInvert = !!selector.mixType;

		let state: boolean = status === "toggle" ? !this.state.get(targetString) : status;
		if (status !== "toggle" && shouldInvert) state = !state;

		this._sendPacket(
			MessageCode.ParamValue,
			Buffer.concat([Buffer.from(targetString + "\x00\x00\x00"), toBoolean(state)]),
		);
	}

	/**
	 * @private
	 */
	private _getSoloTargetString(selector: ChannelSelector) {
		let targetString = parseChannelString(selector);
		targetString += "/solo";
		return targetString;
	}

	/**
	 * Read a channel switch — phantom power, polarity, or a processor in/out.
	 *
	 * The same switch reaches the cache in three shapes depending on where it
	 * came from, so all three are normalised to a boolean here:
	 *
	 *   - a boolean, for `48v` in the initial state dump
	 *   - a number, for the others in that dump
	 *   - a 4-byte Buffer holding a float, when the console pushes the change
	 *     back as a ParamValue packet
	 *
	 * The Buffer case is the one that bites: `Number(buffer)` is NaN, so a
	 * naive comparison reports every echoed change as off, and a switch appears
	 * to revert a moment after it is set.
	 *
	 * Returns null when the console has not reported the parameter, matching
	 * the mute and solo getters.
	 */
	getSwitch(selector: ChannelSelector, name: ChannelSwitchName): boolean | null {
		let value = this.state.get(this._getSwitchTargetString(selector, name));
		if (value === null || value === undefined) return null;
		if (typeof value === "boolean") return value;
		if (Buffer.isBuffer(value)) {
			if (value.length < 4) return null;
			value = value.readFloatLE(0);
		}
		return Number(value) > 0;
	}

	/**
	 * Set a channel switch. Pass "toggle" to flip whatever the console last
	 * reported.
	 *
	 * These go out as a float 1 or 0: toBoolean() is toFloat(1|0), so the
	 * switches the console stores as numbers and the one it stores as a
	 * boolean take the same encoding on the wire.
	 */
	setSwitch(selector: ChannelSelector, name: ChannelSwitchName, state: boolean | "toggle") {
		const targetString = this._getSwitchTargetString(selector, name);
		const value = state === "toggle" ? !this.getSwitch(selector, name) : state;

		this._sendPacket(
			MessageCode.ParamValue,
			Buffer.concat([Buffer.from(`${targetString}\x00\x00\x00`), toBoolean(value)]),
		);

		// The console echoes the change back as a ParamValue packet, but not for
		// roughly 150ms. Seed the cache so a read straight after this call sees
		// the new value rather than the old one; the echo then overwrites it
		// with the identical value. _setLevel does the same thing.
		this.state.set(targetString, value);
	}

	/**
	 * @private
	 */
	private _getSwitchTargetString(selector: ChannelSelector, name: ChannelSwitchName) {
		const property = ChannelSwitch[name];
		if (!property) throw new Error(`Unknown channel switch: ${String(name)}`);
		return `${parseChannelString(selector)}/${property}`;
	}

	/**
	 * The console's own published range for a parameter, when it has one.
	 *
	 * The initial state dump carries min/max/default/units for a handful of
	 * parameters — preamp gain among them — which is how gain can be presented
	 * in decibels without hard-coding a range that may vary by console model.
	 * Returns null for the many parameters that publish no range.
	 */
	getParameterRange(
		path: string | string[],
	): { min: number; max: number; def?: number; units?: string; curve?: string } | null {
		if (!this.zlibData) return null;
		let cur: any = this.zlibData;
		for (const token of simplifyPathTokens(tokenisePath(path))) {
			cur = cur?.[token];
			if (!cur) return null;
		}
		return cur[ZlibRangeSymbol] ?? null;
	}

	/**
	 * @internal Preamp gain is stored as a 0-1 fraction of the console's own
	 * gain range, so the decibel conversion needs that range. 0-60 dB matches
	 * every StudioLive III preamp seen so far and is the fallback when the
	 * console has not published one.
	 */
	private _getGainRange(selector: ChannelSelector) {
		const range = this.getParameterRange(`${parseChannelString(selector)}/preampgain`);
		return { min: range?.min ?? 0, max: range?.max ?? 60 };
	}

	/**
	 * Read preamp gain in decibels, or null if the console has not reported it.
	 */
	getPreampGain(selector: ChannelSelector): number | null {
		let value = this.state.get(`${parseChannelString(selector)}/preampgain`);
		if (value === null || value === undefined) return null;
		if (Buffer.isBuffer(value)) {
			if (value.length < 4) return null;
			value = value.readFloatLE(0);
		}
		const { min, max } = this._getGainRange(selector);
		return min + Number(value) * (max - min);
	}

	/**
	 * Set preamp gain in decibels. Values outside the console's range are
	 * clamped rather than sent — an out-of-range float here is a very loud
	 * mistake.
	 */
	setPreampGain(selector: ChannelSelector, decibels: number) {
		const { min, max } = this._getGainRange(selector);
		const clamped = Math.min(max, Math.max(min, Number(decibels) || 0));
		const fraction = max === min ? 0 : (clamped - min) / (max - min);
		const targetString = `${parseChannelString(selector)}/preampgain`;

		this._sendPacket(
			MessageCode.ParamValue,
			Buffer.concat([Buffer.from(`${targetString}\x00\x00\x00`), toFloat(fraction)]),
		);
		this.state.set(targetString, fraction);
	}

	setColor(selector: ChannelSelector, hex: string, alpha = 0xff) {
		this._sendPacket(
			MessageCode.ParamChars,
			Buffer.concat([
				Buffer.from(`${parseChannelString(selector)}/color\x00\x00\x00`),
				Buffer.from(hex, "hex"),
				Buffer.from([alpha]),
			]),
		);
	}

	setColour(...args: Parameters<this["setColor"]>) {
		return this.setColor.apply(this, args);
	}

	getColor(selector: ChannelSelector) {
		return this.state.get(`${parseChannelString(selector)}/color`);
	}

	getColour(...args: Parameters<this["getColor"]>) {
		return this.getColor.apply(this, args);
	}

	/**
	 * For a mono channel, the pan value is the pan value from 0 (hard left) to 100 (hard right)
	 * For a stereo channel, the pan value is the width from 0 to 100 (stereo)
	 */
	setPan(selector: ChannelSelector, pan: number) {
		/*
    When channels are grouped
    link = 1
    panlinkstate = 1

    initiator
    linkmaster = 1
    */

		let channelString = parseChannelString(selector);

		const isStereo = this.state.get(channelString + "/link");

		if (selector.mixType) {
			switch (selector.mixType) {
				case "AUX": {
					const odd = (selector.mixNumber - 1) | 1;
					channelString += `/aux${odd}${odd + 1}_`;
					if (this.state.get(`aux.ch${selector.mixNumber}.link`)) {
						channelString += isStereo ? "stpan" : "pan";
					} else {
						// No need to pan a mono aux
						return;
					}
					break;
				}
				default:
					throw new Error("Unexpected mix type");
			}
		} else {
			channelString += "/" + (isStereo ? "stereopan" : "pan");
		}

		this._sendPacket(
			MessageCode.ParamValue,
			Buffer.concat([Buffer.from(`${channelString}\x00\x00\x00`), toFloat(pan / 100)]),
		);
	}

	/**
	 * @internal By original nature, only an odd numbered channel is targeted (& ~1)
	 */
	setLink(selector: ChannelSelector, link: boolean) {
		this._sendPacket(
			MessageCode.ParamValue,
			Buffer.concat([Buffer.from(`${parseChannelString(selector)}/link\x00\x00\x00`), toBoolean(link)]),
		);
	}

	private _getLevelString(selector: ChannelSelector) {
		let targetString = parseChannelString(selector);

		if (selector.mixType) {
			switch (selector.mixType) {
				case "AUX":
					targetString += `/${Channel[selector.mixType]}${selector.mixNumber}`;
					break;
				case "FX":
					targetString += `/FX${String.fromCharCode(0x40 + selector.mixNumber)}`;
					break;
				default:
					throw new Error("Unexpected mix type");
			}
		} else {
			targetString += "/volume";
		}

		return targetString;
	}

	getLevel(selector: ChannelSelector) {
		return this.state.get(this._getLevelString(selector));
	}

	/**
	 * @internal Send a level command to the target
	 * targetLevel - [0, 100]
	 */
	private _setLevel(this: Client, selector: ChannelSelector, targetLevel, duration = 0): Promise<null> {
		const targetString = this._getLevelString(selector);

		const assertReturn = () => {
			// Additional time to wait for response
			return new Promise<null>((resolve) => {
				// 0ms timeout - queue event loop
				setTimeout(() => {
					this.state.set(targetString, targetLevel);
					resolve(null);
				}, 0);
			});
		};

		const set = (level) => {
			this._sendPacket(
				MessageCode.ParamValue,
				Buffer.concat([Buffer.from(`${targetString}\x00\x00\x00`), toFloat(level / 100)]),
			);
		};

		if (!duration) {
			set(targetLevel);
			return assertReturn();
		}

		const currentLevel = this.getLevel(selector) ?? 0;

		// Don't do anything if we already are on the same level
		if (currentLevel === targetLevel) {
			return assertReturn();
		}

		return new Promise((resolve) => {
			transitionValue(
				currentLevel,
				targetLevel,
				duration,
				(v) => set(v),
				async () => {
					resolve(await assertReturn());
				},
			);
		});
	}

	/**
	 * Set volume (decibels)
	 *
	 * @param channel
	 * @param level range: -84 dB to 10 dB
	 */
	async setChannelVolumeLogarithmic(selector: ChannelSelector, decibel: number, duration?: number) {
		return this._setLevel(selector, logVolumeToLinear(decibel), duration);
	}

	/**
	 * Set volume (pseudo intensity)
	 *
	 * @description Sound is difficult, so this function attempts to provide a "what-you-see-is-what-you-get" interface to control the volume levels.
	 *              `100` Sets the fader to the top (aka +10 dB)
	 *              `72` Sets the fader to unity (aka 0 dB) or a value close enough
	 *              `0` Sets the fader to the bottom (aka -84 dB)
	 * @see http://www.sengpielaudio.com/calculator-levelchange.htm
	 */
	async setChannelVolumeLinear(selector: ChannelSelector, linearLevel: number, duration?: number) {
		return this._setLevel(selector, linearLevel, duration);
	}

	/**
	 * Look at metering data and adjust channel fader so that the level is of a certain loudness
	 * NOTE: This is not perceived loudness. Not very practical, but useful in a pinch?
	 *
	 * @param channel
	 * @param level
	 * @param duration
	 */
	async normaliseChannelTo(channel, level, duration?: number) {
		// TODO:
		throw new Error("Not implemented yet");
	}
}

export default Client;
