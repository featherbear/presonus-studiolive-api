import { Client as StudioLiveAPI, type ChannelSelector, Channel, MessageCode } from "../api";
import type { ChannelTypes } from "../api";

import type LevelEvent from "./types/LevelEvent";
import type MuteEvent from "./types/MuteEvent";
import type SoloEvent from "./types/SoloEvent";

const channelLookup = Object.entries(Channel).reduce((obj, [key, val]) => ({ ...obj, [val]: key }), {});

export function settingsPathToChannelSelector(path: string | string[]): ChannelSelector {
	if (!Array.isArray(path)) path = path.split("/");

	let [type, channel] = path;

	type = channelLookup[type];
	if (!type) {
		return null;
	}

	channel = /(\d+)$/.exec(channel)[1];

	return {
		type: <ChannelTypes>type,
		channel: Number.parseInt(channel, 10),
	};
}

type SimpleAPIEventMap = {
	level: [LevelEvent];
	mute: [MuteEvent];
	solo: [SoloEvent];
	propertyChange: [
		{
			channel: ChannelSelector;
			value: any;
			type: any;
		},
	];
};

type ExtendedEvents = StudioLiveAPI["on"] &
	(<K extends keyof SimpleAPIEventMap>(event: K, listener: (...arg: SimpleAPIEventMap[K]) => void) => any);

declare interface SimpleClient extends StudioLiveAPI {
	on: ExtendedEvents;
	once: ExtendedEvents;
	off: ExtendedEvents;
	addListener: ExtendedEvents;
	removeListener: ExtendedEvents;
}

// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: idk
class SimpleClient extends StudioLiveAPI {
	#MS_last: unknown;

	declare emit: StudioLiveAPI["emit"] &
		(<K extends keyof SimpleAPIEventMap>(event: K, ...args: SimpleAPIEventMap[K]) => any);

	constructor(...args: ConstructorParameters<typeof StudioLiveAPI>) {
		super(...args);
		this.#MS_last = {};

		this.on(MessageCode.FaderPosition, (MS: { [s: string]: number[] }) => {
			// For each channel type
			for (const [type, values] of Object.entries(MS)) {
				// For each channel of a given type
				for (let idx = 0; idx < values.length; idx++) {
					// Store the new value
					const newValue = values[idx];

					// Check if stored value is different to the new value
					if (this.#MS_last?.[type]?.[idx] !== newValue) {
						this.emit("level", {
							channel: {
								type: type,
								channel: idx + 1, // idx count starts from zero, but channels are one-based
							},
							level: newValue,
							type: "level",
						} as LevelEvent);
					}
				}
			}

			this.#MS_last = MS;
		});

		// Temporary debugging for ParamString and ParamChars
		this.on(MessageCode.ParamString, (PS) => {
			// Only log icon IDs for channels 10-14 to reduce noise
			const nameParts = PS.name.split("/");
			const trailingToken = nameParts[nameParts.length - 1];

			if (trailingToken === "iconid") {
				// iconid path, no additional handling needed
			}

			// Handle property changes that come via ParamString (e.g., channel names)
			if (trailingToken === "username" || trailingToken === "name") {
				const selector = settingsPathToChannelSelector(nameParts);
				if (selector) {
					this.emit("propertyChange", {
						channel: selector,
						value: PS.value,
						type: "name",
					});
				}
			}
		});

		this.on(MessageCode.ParamChars, (PC) => {
			// Handle property changes that come via ParamChars (alternative for channel names)
			const nameParts = PC.name.split("/");
			const trailingToken = nameParts[nameParts.length - 1];

			if (trailingToken === "username" || trailingToken === "name") {
				const selector = settingsPathToChannelSelector(nameParts);
				if (selector) {
					this.emit("propertyChange", {
						channel: selector,
						value: PC.value,
						type: "name",
					});
				}
			}
		});

		this.on(MessageCode.ParamValue, (PV) => {
			let { name, value } = PV;
			name = name.split("/");
			const trailingToken: string = name[name.length - 1];

			switch (trailingToken) {
				case "mute": {
					const selector = settingsPathToChannelSelector(name);
					if (!selector) return;

					this.emit("mute", {
						channel: selector,
						status: value,
						type: "mute",
					} as MuteEvent);
					return;
				}

				case "solo": {
					const selector = settingsPathToChannelSelector(name);
					if (!selector) return;

					this.emit("solo", {
						channel: selector,
						status: value,
						type: "solo",
					} as SoloEvent);
					return;
				}

				case "lr": {
					const selector = settingsPathToChannelSelector(name);
					if (!selector) return;

					// Convert Buffer to boolean
					const boolValue = value instanceof Buffer
						? value.equals(Buffer.from([0x00, 0x00, 0x80, 0x3f]))
						: Boolean(value);

					this.emit("propertyChange", {
						channel: selector,
						value: boolValue,
						type: "lr",
					});
					return;
				}

				case "inputsrc": {
					const selector = settingsPathToChannelSelector(name);
					if (!selector) return;

					// Convert Buffer to float, then map to discrete values
					let inputSrcValue = value;
					if (value instanceof Buffer) {
						const floatValue = value.readFloatLE();
						// Map float values to discrete input source numbers
						// 0.0 = Analog/LINE (0), ~0.333 = Network (1), ~0.667 = USB (2), 1.0 = SD Card (3)
						if (floatValue < 0.2) inputSrcValue = 0;
						else if (floatValue < 0.5) inputSrcValue = 1;
						else if (floatValue < 0.85) inputSrcValue = 2;
						else inputSrcValue = 3;
					}

					this.emit("propertyChange", {
						channel: selector,
						value: inputSrcValue,
						type: "inputsrc",
					});
					return;
				}

				case "icon": {
					const selector = settingsPathToChannelSelector(name);
					if (!selector) return;

					// Convert Buffer to float/number
					const iconValue = value instanceof Buffer ? value.readFloatLE() : value;

					this.emit("propertyChange", {
						channel: selector,
						value: iconValue,
						type: "icon",
					});
					return;
				}

				case "name": {
					const selector = settingsPathToChannelSelector(name);
					if (!selector) return;

					// Name should be a string (comes via ParamString/ParamChars)
					this.emit("propertyChange", {
						channel: selector,
						value: value,
						type: "name",
					});
					return;
				}

				case "link": {
					const selector = settingsPathToChannelSelector(name);
					if (!selector) return;

					// Convert Buffer to boolean
					const linkValue = value instanceof Buffer
						? value.equals(Buffer.from([0x00, 0x00, 0x80, 0x3f]))
						: Boolean(value);

					this.emit("propertyChange", {
						channel: selector,
						value: linkValue,
						type: "link",
					});
					return;
				}
			}

			if (trailingToken.startsWith("assign_")) {
				const selector = settingsPathToChannelSelector(name);
				if (!selector) return;

				const [, type, channel] = /assign_(\w+)(\d+)$/.exec(trailingToken);
				selector.mixType = channelLookup[type] ?? type.toUpperCase();
				selector.mixNumber = Number.parseInt(channel, 10);

				this.emit("mute", {
					channel: selector,
					status: value,
					type: "mute",
				} as MuteEvent);
			}

			if (trailingToken.startsWith("aux")) {
				if (name.includes("dca")) {
					// TODO: reason?
					return;
				}

				const selector = settingsPathToChannelSelector(name);
				if (!selector) return;

				const propertyToken = /(\w+)(\d+)(?:_(\w+))?$/.exec(trailingToken);

				if (!propertyToken) {
					// TODO: Confirm what changes appear here
					this.emit("propertyChange", {
						channel: selector,
						value: value,
						type: trailingToken,
					});
					return;
				}

				let [, type, channel, property] = propertyToken;

				selector.mixType = channelLookup[type];
				selector.mixNumber = Number.parseInt(channel, 10);

				if (!property) {
					property = "level";
				}
				// this.emit(property, {
				//   channel: selector,
				//   value,
				//   level: value,
				//   type: property
				// } as LevelEvent)
			}

			if (trailingToken.startsWith("FX")) {
				if (name.includes("dca")) return;

				const selector = settingsPathToChannelSelector(name);
				if (!selector) return;

				const [, type, channel] = /(\w+)(\w)$/.exec(trailingToken);
				selector.mixType = channelLookup[type] ?? type.toUpperCase();
				selector.mixNumber = channel.charCodeAt(0) - 0x40;

				this.emit("level", {
					channel: selector,
					level: value,
					type: "level",
				} as LevelEvent);
			}
		});
	}

	connect(...args: Parameters<StudioLiveAPI["connect"]>) {
		return super
			.connect(...args)
			.then(() => {
				// Slightly nudge a fader in order to receive the MS packet

				// TODO: do we get all values?
				const shouldGetMS = false;

				if (shouldGetMS) {
					const volume: number = this.state.get("fxbus.ch1.volume");
					if (volume === null) {
						throw new Error("Unexpected mixer state during setup");
					}
					const newVolume = volume + 0.01 * (volume === 0 ? 1 : -1);
					this.setChannelVolumeLinear(
						{
							type: "FX",
							channel: 1,
						},
						newVolume,
					);

					// Set the volume back
					this.setChannelVolumeLinear(
						{
							type: "FX",
							channel: 1,
						},
						volume,
					);
				}
			})
			.then(() => this);
	}
}

export { SimpleClient };
