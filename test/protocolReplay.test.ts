/**
 * Protocol Replay Tests
 *
 * Spins up a real TCP server on localhost, connects a real Client instance,
 * and replays realistic UCNet packet sequences to verify the full pipeline:
 *   TCP framing → packet parsing → event emission → state cache
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as net from "node:net";
import * as zlib from "node:zlib";

// ── Packet construction helpers ──────────────────────────────────────────

const PacketHeader = Buffer.from([0x55, 0x43, 0x00, 0x01]);
const CByte = { A: 0x68, B: 0x65 };

/** Build a fully-framed UCNet packet (header + length + code + cbytes + payload) */
function buildPacket(messageCode: string, payload: Buffer = Buffer.alloc(0)): Buffer {
	const codeBytes = Buffer.from(messageCode, "ascii");
	const connIdentity = Buffer.from([CByte.A, 0x00, CByte.B, 0x00]);
	const payloadLength = Buffer.alloc(2);
	payloadLength.writeUInt16LE(codeBytes.length + connIdentity.length + payload.length);
	return Buffer.concat([PacketHeader, payloadLength, codeBytes, connIdentity, payload]);
}

/** Build a PV (ParamValue) packet: key\0\0\0 + float32LE */
function buildPVPacket(key: string, value: number): Buffer {
	const keyBuf = Buffer.from(key + "\0", "utf8");
	const padding = Buffer.from([0x00, 0x00]);
	const floatBuf = Buffer.alloc(4);
	floatBuf.writeFloatLE(value);
	return buildPacket("PV", Buffer.concat([keyBuf, padding, floatBuf]));
}

/** Build a PS (ParamString) packet: key\0 + 3 padding bytes + string\0 */
function buildPSPacket(key: string, value: string): Buffer {
	const keyBuf = Buffer.from(key + "\0", "utf8");
	const padding = Buffer.from([0x00, 0x00]);
	const valueBuf = Buffer.from(value + "\0", "utf8");
	return buildPacket("PS", Buffer.concat([keyBuf, padding, valueBuf]));
}

/** Build a JM (JSON) packet: uint16LE length + 0x00 0x00 + JSON string */
function buildJMPacket(json: object): Buffer {
	const jsonStr = JSON.stringify(json, null, " ");
	const jsonBuf = Buffer.from(jsonStr, "utf8");
	const lengthBuf = Buffer.alloc(2);
	lengthBuf.writeUInt16LE(jsonBuf.length);
	const padding = Buffer.from([0x00, 0x00]);
	return buildPacket("JM", Buffer.concat([lengthBuf, padding, jsonBuf]));
}

/**
 * Build a minimal UBJSON "Synchronize" payload that zlibParse can handle.
 * Creates a device tree with line/ch1, aux/ch1, main/ch1 nodes.
 */
function buildMinimalZlibPayload(): Buffer {
	// We need a valid UBJSON that deserialises to { id: "Synchronize", children: [...] }
	// Rather than implementing UBJSON encoding, we'll build the compressed buffer
	// from a known-good structure by compressing it with zlib.
	//
	// The zlibParse function does: deserialiseUBJSON(zlib.inflateSync(data))
	// So we need: zlib.deflateSync(serialiseUBJSON({ id: "Synchronize", ... }))
	//
	// For testing, we'll use a ZB packet with pre-built compressed UBJSON.
	// Let's import the UBJSON serialiser to build a correct payload.

	// Minimal UBJSON encoding by hand for { id: "Synchronize", children: [] }
	// This is enough to pass zlibParse's "id === Synchronize" check
	const ubjson = encodeUBJSON({
		id: "Synchronize",
		children: [
			{
				id: "line",
				children: [
					{ id: "ch1", children: [{ id: "volume", value: 0.5, min: 0, max: 1 }] },
				],
			},
			{
				id: "aux",
				children: [
					{ id: "ch1", children: [{ id: "volume", value: 0.7, min: 0, max: 1 }] },
				],
			},
			{
				id: "main",
				children: [
					{ id: "ch1", children: [{ id: "volume", value: 0.8, min: 0, max: 1 }] },
				],
			},
		],
	});

	return zlib.deflateSync(ubjson);
}

/**
 * Minimal UBJSON encoder — just enough for our test payloads.
 * Supports: object, array, string, number (float32), int.
 */
function encodeUBJSON(value: unknown): Buffer {
	if (typeof value === "string") {
		const strBuf = Buffer.from(value, "utf8");
		// S i <len> <string>
		return Buffer.concat([
			Buffer.from([0x53]), // S = string type
			encodeUBJSONInt(strBuf.length),
			strBuf,
		]);
	}
	if (typeof value === "number") {
		if (Number.isInteger(value) && value >= -128 && value <= 127) {
			// i <byte>
			const buf = Buffer.alloc(2);
			buf[0] = 0x69; // 'i' = int8
			buf.writeInt8(value, 1);
			return buf;
		}
		// d <float32>
		const buf = Buffer.alloc(5);
		buf[0] = 0x64; // 'd' = float32
		buf.writeFloatBE(value, 1);
		return buf;
	}
	if (Array.isArray(value)) {
		const parts = [Buffer.from([0x5b])]; // '['
		for (const item of value) {
			parts.push(encodeUBJSON(item));
		}
		parts.push(Buffer.from([0x5d])); // ']'
		return Buffer.concat(parts);
	}
	if (typeof value === "object" && value !== null) {
		const parts = [Buffer.from([0x7b])]; // '{'
		for (const [k, v] of Object.entries(value)) {
			// key: i <len> <string>
			const keyBuf = Buffer.from(k, "utf8");
			parts.push(encodeUBJSONInt(keyBuf.length));
			parts.push(keyBuf);
			parts.push(encodeUBJSON(v));
		}
		parts.push(Buffer.from([0x7d])); // '}'
		return Buffer.concat(parts);
	}
	// null
	return Buffer.from([0x5a]); // 'Z'
}

function encodeUBJSONInt(n: number): Buffer {
	if (n >= 0 && n <= 127) {
		return Buffer.from([0x69, n]); // i <uint8>
	}
	const buf = Buffer.alloc(3);
	buf[0] = 0x55; // U = uint8 (for values 128-255) - actually use I for int16
	buf.writeInt16BE(n, 1);
	buf[0] = 0x49; // I = int16
	return buf;
}

/** Build a ZB (zlib) packet with the 4-byte unknown prefix + compressed data */
function buildZBPacket(compressedData: Buffer): Buffer {
	const prefix = Buffer.alloc(4); // 4 unknown bytes
	return buildPacket("ZB", Buffer.concat([prefix, compressedData]));
}

/** Build CK (chunk) packets from compressed data, splitting into specified chunk size */
function buildCKPackets(compressedData: Buffer, chunkSize: number): Buffer[] {
	const packets: Buffer[] = [];
	let offset = 0;
	while (offset < compressedData.length) {
		const end = Math.min(offset + chunkSize, compressedData.length);
		const chunk = compressedData.slice(offset, end);

		const prefix = Buffer.alloc(4); // 4 unknown bytes
		const offsetBuf = Buffer.alloc(4);
		offsetBuf.writeUInt32LE(offset);
		const totalBuf = Buffer.alloc(4);
		totalBuf.writeUInt32LE(compressedData.length);
		const sizeBuf = Buffer.alloc(4);
		sizeBuf.writeUInt32LE(chunk.length);

		packets.push(buildPacket("CK", Buffer.concat([prefix, offsetBuf, totalBuf, sizeBuf, chunk])));
		offset = end;
	}
	return packets;
}

// ── Mock TCP Server ─────────────────────────────────────────────────────

interface MockServer {
	port: number;
	server: net.Server;
	/** Queue of actions to perform when a client connects */
	onConnection: (socket: net.Socket) => void;
	close: () => Promise<void>;
}

async function createMockServer(): Promise<MockServer> {
	return new Promise((resolve) => {
		const server = net.createServer();
		const mock: MockServer = {
			port: 0,
			server,
			onConnection: () => {},
			close: () => new Promise<void>((res) => server.close(() => res())),
		};

		server.on("connection", (socket) => mock.onConnection(socket));
		server.listen(0, "127.0.0.1", () => {
			const addr = server.address() as net.AddressInfo;
			mock.port = addr.port;
			resolve(mock);
		});
	});
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Wait for an event with a timeout */
function waitForEvent(emitter: any, event: string, timeoutMs = 5000): Promise<any> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(`Timeout waiting for '${event}'`)), timeoutMs);
		emitter.once(event, (...args: any[]) => {
			clearTimeout(timer);
			resolve(args.length === 1 ? args[0] : args);
		});
	});
}

/** Small delay to let I/O flush */
const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));

// ── Mock SleepWakeDetector (must be registered before Client import) ────

vi.mock("../src/lib/util/SleepWakeDetector", () => {
	const { EventEmitter } = require("node:events");
	return {
		default: class extends EventEmitter {
			start() {}
			stop() {}
		},
	};
});

// ── Import Client after mocks ───────────────────────────────────────────

import { Client } from "../src/lib/Client";
import { MessageCode } from "../src/lib/constants";

// ── Tests ───────────────────────────────────────────────────────────────

describe("Protocol Replay", () => {
	let mockServer: MockServer;
	let client: Client;

	beforeEach(async () => {
		mockServer = await createMockServer();
	});

	afterEach(async () => {
		// Force-destroy client socket to prevent hanging after timeout tests
		try { (client as any)?.conn?.destroy(); } catch {}
		// Force-close the server, closing all active connections
		if (mockServer?.server) {
			mockServer.server.close();
			// Destroy any lingering sockets
			mockServer.server.unref();
		}
	});

	/**
	 * Helper: set up a server that performs the full handshake
	 * (send ZB + SubscriptionReply) when a client connects
	 */
	function setupHandshakeServer(extraPackets?: Buffer[]) {
		const compressedPayload = buildMinimalZlibPayload();
		const zbPacket = buildZBPacket(compressedPayload);
		const subReply = buildJMPacket({ id: "SubscriptionReply" });

		mockServer.onConnection = (socket) => {
			// Wait briefly for the subscribe request, then send handshake
			socket.once("data", () => {
				socket.write(zbPacket);
				socket.write(subReply);
				if (extraPackets) {
					for (const pkt of extraPackets) {
						socket.write(pkt);
					}
				}
			});
		};
	}

	// ── Handshake Tests ────────────────────────────────────────────────

	describe("handshake", () => {
		it("completes full handshake: connect → subscribe → ZB → SubscriptionReply → connected", async () => {
			setupHandshakeServer();
			client = new Client({ host: "127.0.0.1", port: mockServer.port });

			const connectedPromise = waitForEvent(client, "connected");
			await client.connect();
			await connectedPromise;

			// If we get here without timeout, handshake succeeded
			expect(client.serverHost).toBe("127.0.0.1");
		});

		it("completes handshake via CK (chunked) packets instead of ZB", async () => {
			const compressedPayload = buildMinimalZlibPayload();
			// Split into small chunks to force multi-CK reassembly
			const ckPackets = buildCKPackets(compressedPayload, 64);
			const subReply = buildJMPacket({ id: "SubscriptionReply" });

			mockServer.onConnection = (socket) => {
				socket.once("data", () => {
					for (const pkt of ckPackets) {
						socket.write(pkt);
					}
					socket.write(subReply);
				});
			};

			client = new Client({ host: "127.0.0.1", port: mockServer.port });
			const connectedPromise = waitForEvent(client, "connected");
			await client.connect();
			await connectedPromise;
			expect(client.serverHost).toBe("127.0.0.1");
		});

		it("times out when server never sends ZB packet", async () => {
			// Server connects but sends nothing
			mockServer.onConnection = () => {};

			client = new Client({ host: "127.0.0.1", port: mockServer.port });
			await expect(client.connect()).rejects.toThrow(/timeout/i);
		}, 20_000);

		it("times out when server sends ZB but no SubscriptionReply", async () => {
			const compressedPayload = buildMinimalZlibPayload();
			const zbPacket = buildZBPacket(compressedPayload);

			mockServer.onConnection = (socket) => {
				socket.once("data", () => {
					socket.write(zbPacket);
					// Never send SubscriptionReply
				});
			};

			client = new Client({ host: "127.0.0.1", port: mockServer.port });
			await expect(client.connect()).rejects.toThrow(/timeout/i);
		}, 20_000);

		it("client sends JM Subscribe as first packet", async () => {
			let receivedData: Buffer | null = null;

			mockServer.onConnection = (socket) => {
				socket.once("data", (data) => {
					receivedData = Buffer.from(data);
					// Complete handshake so client doesn't hang
					const compressedPayload = buildMinimalZlibPayload();
					socket.write(buildZBPacket(compressedPayload));
					socket.write(buildJMPacket({ id: "SubscriptionReply" }));
				});
			};

			client = new Client({ host: "127.0.0.1", port: mockServer.port });
			await client.connect();
			await tick();

			// Verify the sent packet starts with UCNet header and contains JM code
			expect(receivedData).not.toBeNull();
			expect(receivedData![0]).toBe(0x55); // U
			expect(receivedData![1]).toBe(0x43); // C
			expect(receivedData![6]).toBe(0x4a); // J
			expect(receivedData![7]).toBe(0x4d); // M

			// Verify the payload contains the Subscribe JSON
			const str = receivedData!.toString("utf8");
			expect(str).toContain('"id"');
			expect(str).toContain('"Subscribe"');
			expect(str).toContain('"clientName"');
			expect(str).toContain('"UC-Surface"');
		});
	});

	// ── PV (ParamValue) flow ───────────────────────────────────────────

	describe("PV (ParamValue) flow", () => {
		it("PV packet updates state cache with float value", async () => {
			const pvPacket = buildPVPacket("line/ch1/volume", 0.75);
			setupHandshakeServer([pvPacket]);

			client = new Client({ host: "127.0.0.1", port: mockServer.port });
			await client.connect();
			await tick(200);

			expect(client.state.get("line/ch1/volume")).toBeCloseTo(0.75, 2);
		});

		it("multiple PV packets update different state paths", async () => {
			const packets = [
				buildPVPacket("line/ch1/volume", 0.5),
				buildPVPacket("line/ch2/volume", 0.8),
				buildPVPacket("aux/ch1/volume", 0.3),
				buildPVPacket("line/ch1/mute", 1.0),
			];
			setupHandshakeServer(packets);

			client = new Client({ host: "127.0.0.1", port: mockServer.port });
			await client.connect();
			await tick(200);

			expect(client.state.get("line/ch1/volume")).toBeCloseTo(0.5, 2);
			expect(client.state.get("line/ch2/volume")).toBeCloseTo(0.8, 2);
			expect(client.state.get("aux/ch1/volume")).toBeCloseTo(0.3, 2);
			expect(client.state.get("line/ch1/mute")).toBeCloseTo(1.0, 2);
		});

		it("emits PV event with parsed name and value", async () => {
			let serverSocket: net.Socket | null = null;
			const compressedPayload = buildMinimalZlibPayload();

			mockServer.onConnection = (socket) => {
				serverSocket = socket;
				socket.once("data", () => {
					socket.write(buildZBPacket(compressedPayload));
					socket.write(buildJMPacket({ id: "SubscriptionReply" }));
				});
			};

			client = new Client({ host: "127.0.0.1", port: mockServer.port });

			const pvData = new Promise<any>((resolve) => {
				client.on(MessageCode.ParamValue, (data) => {
					if (data.name === "line/ch3/volume") resolve(data);
				});
			});

			await client.connect();
			await tick(100);

			serverSocket!.write(buildPVPacket("line/ch3/volume", 0.42));
			const result = await pvData;
			expect(result.name).toBe("line/ch3/volume");
		});

		it("PV zero value correctly sets state to 0", async () => {
			setupHandshakeServer([buildPVPacket("line/ch1/volume", 0)]);

			client = new Client({ host: "127.0.0.1", port: mockServer.port });
			await client.connect();
			await tick(200);

			expect(client.state.get("line/ch1/volume")).toBe(0);
		});
	});

	// ── PS (ParamString) flow ──────────────────────────────────────────

	describe("PS (ParamString) flow", () => {
		it("PS packet updates state cache with string value", async () => {
			const psPacket = buildPSPacket("line/ch1/username", "Lead Vocal");
			setupHandshakeServer([psPacket]);

			client = new Client({ host: "127.0.0.1", port: mockServer.port });
			await client.connect();
			await tick(200);

			expect(client.state.get("line/ch1/username")).toBe("Lead Vocal");
		});

		it("multiple PS packets set independent channel names", async () => {
			const packets = [
				buildPSPacket("line/ch1/username", "Kick"),
				buildPSPacket("line/ch2/username", "Snare"),
				buildPSPacket("aux/ch1/username", "Monitor 1"),
			];
			setupHandshakeServer(packets);

			client = new Client({ host: "127.0.0.1", port: mockServer.port });
			await client.connect();
			await tick(200);

			expect(client.state.get("line/ch1/username")).toBe("Kick");
			expect(client.state.get("line/ch2/username")).toBe("Snare");
			expect(client.state.get("aux/ch1/username")).toBe("Monitor 1");
		});

		it("PS with empty string value stores empty string", async () => {
			setupHandshakeServer([buildPSPacket("line/ch1/username", "")]);

			client = new Client({ host: "127.0.0.1", port: mockServer.port });
			await client.connect();
			await tick(200);

			expect(client.state.get("line/ch1/username")).toBe("");
		});
	});

	// ── Mixed packet stream ────────────────────────────────────────────

	describe("mixed packet stream", () => {
		it("interleaved PV and PS packets all reach state correctly", async () => {
			const packets = [
				buildPVPacket("line/ch1/volume", 0.65),
				buildPSPacket("line/ch1/username", "Guitar"),
				buildPVPacket("line/ch1/mute", 0.0),
				buildPSPacket("line/ch2/username", "Bass"),
				buildPVPacket("line/ch2/volume", 0.9),
				buildPVPacket("main/ch1/volume", 1.0),
			];
			setupHandshakeServer(packets);

			client = new Client({ host: "127.0.0.1", port: mockServer.port });
			await client.connect();
			await tick(300);

			expect(client.state.get("line/ch1/volume")).toBeCloseTo(0.65, 2);
			expect(client.state.get("line/ch1/username")).toBe("Guitar");
			expect(client.state.get("line/ch1/mute")).toBeCloseTo(0.0, 2);
			expect(client.state.get("line/ch2/username")).toBe("Bass");
			expect(client.state.get("line/ch2/volume")).toBeCloseTo(0.9, 2);
			expect(client.state.get("main/ch1/volume")).toBeCloseTo(1.0, 2);
		});

		it("packets sent in a single TCP write (concatenated) are parsed correctly", async () => {
			// Concatenate multiple packets into a single buffer to test TCP framing
			const pv1 = buildPVPacket("line/ch1/volume", 0.33);
			const pv2 = buildPVPacket("line/ch2/volume", 0.66);
			const ps1 = buildPSPacket("line/ch1/username", "Keys");
			const combined = Buffer.concat([pv1, pv2, ps1]);

			const compressedPayload = buildMinimalZlibPayload();
			mockServer.onConnection = (socket) => {
				socket.once("data", () => {
					socket.write(buildZBPacket(compressedPayload));
					socket.write(buildJMPacket({ id: "SubscriptionReply" }));
					setTimeout(() => socket.write(combined), 50);
				});
			};

			client = new Client({ host: "127.0.0.1", port: mockServer.port });
			await client.connect();
			await tick(300);

			expect(client.state.get("line/ch1/volume")).toBeCloseTo(0.33, 2);
			expect(client.state.get("line/ch2/volume")).toBeCloseTo(0.66, 2);
			expect(client.state.get("line/ch1/username")).toBe("Keys");
		});

		it("data event fires for every packet with code and parsed data", async () => {
			let serverSocket: net.Socket | null = null;
			const compressedPayload = buildMinimalZlibPayload();

			mockServer.onConnection = (socket) => {
				serverSocket = socket;
				socket.once("data", () => {
					socket.write(buildZBPacket(compressedPayload));
					socket.write(buildJMPacket({ id: "SubscriptionReply" }));
				});
			};

			client = new Client({ host: "127.0.0.1", port: mockServer.port });

			const dataEvents: Array<{ code: string; data: any }> = [];
			client.on("data", (evt) => dataEvents.push(evt));

			await client.connect();
			await tick(200);

			serverSocket!.write(buildPVPacket("line/ch5/volume", 0.5));
			serverSocket!.write(buildPSPacket("line/ch5/username", "Violin"));
			await tick(200);

			const pvEvents = dataEvents.filter((e) => e.code === MessageCode.ParamValue);
			const psEvents = dataEvents.filter((e) => e.code === MessageCode.ParamString);
			expect(pvEvents.length).toBeGreaterThanOrEqual(1);
			expect(psEvents.length).toBeGreaterThanOrEqual(1);
		});
	});

	// ── Connection lifecycle ───────────────────────────────────────────

	describe("connection lifecycle", () => {
		it("close() sends Unsubscribe and disconnects cleanly", async () => {
			let lastReceivedData: Buffer | null = null;

			const compressedPayload = buildMinimalZlibPayload();
			mockServer.onConnection = (socket) => {
				socket.on("data", (data) => {
					lastReceivedData = Buffer.from(data);
				});
				// Auto-handshake on first data
				let handshook = false;
				socket.on("data", () => {
					if (!handshook) {
						handshook = true;
						socket.write(buildZBPacket(compressedPayload));
						socket.write(buildJMPacket({ id: "SubscriptionReply" }));
					}
				});
			};

			client = new Client({ host: "127.0.0.1", port: mockServer.port });
			await client.connect();
			await tick(100);

			await client.close();
			await tick(100);

			// Last sent packet should contain "Unsubscribe"
			expect(lastReceivedData).not.toBeNull();
			const str = lastReceivedData!.toString("utf8");
			expect(str).toContain("Unsubscribe");
		});

		it("close() resets state so reconnection is possible", async () => {
			setupHandshakeServer();
			client = new Client({ host: "127.0.0.1", port: mockServer.port });

			await client.connect();
			await tick(100);

			await client.close();
			await tick(100);

			// Reconnect with fresh handshake server
			setupHandshakeServer();
			await client.connect();
			await tick(100);

			// Successfully reconnected
			expect(client.serverHost).toBe("127.0.0.1");
		});
	});

	// ── Post-connection streaming ──────────────────────────────────────

	describe("post-connection streaming", () => {
		it("receives PV updates sent after handshake completes", async () => {
			let serverSocket: net.Socket | null = null;
			const compressedPayload = buildMinimalZlibPayload();

			mockServer.onConnection = (socket) => {
				serverSocket = socket;
				socket.once("data", () => {
					socket.write(buildZBPacket(compressedPayload));
					socket.write(buildJMPacket({ id: "SubscriptionReply" }));
				});
			};

			client = new Client({ host: "127.0.0.1", port: mockServer.port });
			await client.connect();
			await tick(200);

			// Now send a batch of updates like a real mixer would
			serverSocket!.write(buildPVPacket("line/ch1/pan", 0.25));
			serverSocket!.write(buildPVPacket("line/ch2/pan", 0.75));
			serverSocket!.write(buildPSPacket("line/ch1/username", "Vocal"));
			await tick(200);

			expect(client.state.get("line/ch1/pan")).toBeCloseTo(0.25, 2);
			expect(client.state.get("line/ch2/pan")).toBeCloseTo(0.75, 2);
			expect(client.state.get("line/ch1/username")).toBe("Vocal");
		});

		it("handles rapid burst of packets without dropping data", async () => {
			let serverSocket: net.Socket | null = null;
			const compressedPayload = buildMinimalZlibPayload();

			mockServer.onConnection = (socket) => {
				serverSocket = socket;
				socket.once("data", () => {
					socket.write(buildZBPacket(compressedPayload));
					socket.write(buildJMPacket({ id: "SubscriptionReply" }));
				});
			};

			client = new Client({ host: "127.0.0.1", port: mockServer.port });
			await client.connect();
			await tick(200);

			// Send 50 PV packets in rapid succession
			const count = 50;
			for (let i = 0; i < count; i++) {
				serverSocket!.write(buildPVPacket(`line/ch${i + 1}/volume`, i / count));
			}
			await tick(500);

			// Verify all 50 values arrived
			for (let i = 0; i < count; i++) {
				const val = client.state.get(`line/ch${i + 1}/volume`);
				expect(val).toBeCloseTo(i / count, 1);
			}
		});

		it("state is overwritten when same path receives new value", async () => {
			let serverSocket: net.Socket | null = null;
			const compressedPayload = buildMinimalZlibPayload();

			mockServer.onConnection = (socket) => {
				serverSocket = socket;
				socket.once("data", () => {
					socket.write(buildZBPacket(compressedPayload));
					socket.write(buildJMPacket({ id: "SubscriptionReply" }));
				});
			};

			client = new Client({ host: "127.0.0.1", port: mockServer.port });
			await client.connect();
			await tick(200);

			serverSocket!.write(buildPVPacket("line/ch1/volume", 0.1));
			await tick(100);
			expect(client.state.get("line/ch1/volume")).toBeCloseTo(0.1, 2);

			serverSocket!.write(buildPVPacket("line/ch1/volume", 0.9));
			await tick(100);
			expect(client.state.get("line/ch1/volume")).toBeCloseTo(0.9, 2);
		});
	});

	// ── JM (JSON) events ───────────────────────────────────────────────

	describe("JM (JSON) events", () => {
		it("emits JSON events for non-subscription messages", async () => {
			let serverSocket: net.Socket | null = null;
			const compressedPayload = buildMinimalZlibPayload();

			mockServer.onConnection = (socket) => {
				serverSocket = socket;
				socket.once("data", () => {
					socket.write(buildZBPacket(compressedPayload));
					socket.write(buildJMPacket({ id: "SubscriptionReply" }));
				});
			};

			client = new Client({ host: "127.0.0.1", port: mockServer.port });

			const jsonEvents: any[] = [];
			client.on(MessageCode.JSON, (data) => jsonEvents.push(data));

			await client.connect();
			await tick(200);

			// Send a project recall event like the mixer would
			serverSocket!.write(buildJMPacket({
				id: "Notify",
				action: "ProjectLoaded",
				projFile: "01.ShowFile.proj",
			}));
			await tick(200);

			const notify = jsonEvents.find((e) => e.id === "Notify");
			expect(notify).toBeDefined();
			expect(notify.action).toBe("ProjectLoaded");
			expect(notify.projFile).toBe("01.ShowFile.proj");
		});
	});

	// ── Client command sending ─────────────────────────────────────────

	describe("client commands", () => {
		it("mute() sends a PV packet to the server", async () => {
			let receivedPackets: Buffer[] = [];
			const compressedPayload = buildMinimalZlibPayload();

			mockServer.onConnection = (socket) => {
				let handshook = false;
				socket.on("data", (data) => {
					if (!handshook) {
						handshook = true;
						socket.write(buildZBPacket(compressedPayload));
						socket.write(buildJMPacket({ id: "SubscriptionReply" }));
					} else {
						receivedPackets.push(Buffer.from(data));
					}
				});
			};

			client = new Client({ host: "127.0.0.1", port: mockServer.port });
			await client.connect();
			await tick(200);

			// Set channel counts so channel validation passes
			client.channelCounts = { LINE: 32, AUX: 16, FX: 4, FXRETURN: 4, RETURN: 2, TALKBACK: 1, MAIN: 1, DCA: 8, SUB: 8, MASTER: 0, MONO: 0 };
			const { setCounts } = await import("../src/lib/util/channelUtil");
			setCounts(client.channelCounts);

			// Clear any keepalive packets that may have been captured
			receivedPackets = [];

			client.mute({ type: "LINE", channel: 1 });
			await tick(200);

			// Should have received at least one packet containing "PV"
			const pvPackets = receivedPackets.filter((p) => {
				const str = p.toString("ascii");
				return str.includes("PV");
			});
			expect(pvPackets.length).toBeGreaterThanOrEqual(1);

			// The PV packet should contain "mute" in the path
			const mutePacket = pvPackets.find((p) => p.toString("utf8").includes("mute"));
			expect(mutePacket).toBeDefined();
		});

		it("setChannelVolumeLinear() sends a PV packet with volume path", async () => {
			let receivedPackets: Buffer[] = [];
			const compressedPayload = buildMinimalZlibPayload();

			mockServer.onConnection = (socket) => {
				let handshook = false;
				socket.on("data", (data) => {
					if (!handshook) {
						handshook = true;
						socket.write(buildZBPacket(compressedPayload));
						socket.write(buildJMPacket({ id: "SubscriptionReply" }));
					} else {
						receivedPackets.push(Buffer.from(data));
					}
				});
			};

			client = new Client({ host: "127.0.0.1", port: mockServer.port });
			await client.connect();
			await tick(200);

			// Set channel counts so channel validation passes
			client.channelCounts = { LINE: 32, AUX: 16, FX: 4, FXRETURN: 4, RETURN: 2, TALKBACK: 1, MAIN: 1, DCA: 8, SUB: 8, MASTER: 0, MONO: 0 };
			const { setCounts } = await import("../src/lib/util/channelUtil");
			setCounts(client.channelCounts);

			receivedPackets = [];
			client.setChannelVolumeLinear({ type: "LINE", channel: 1 }, 0.5);
			await tick(200);

			const pvPackets = receivedPackets.filter((p) => p.toString("ascii").includes("PV"));
			expect(pvPackets.length).toBeGreaterThanOrEqual(1);

			const volumePacket = pvPackets.find((p) => p.toString("utf8").includes("volume"));
			expect(volumePacket).toBeDefined();
		});
	});

	// ── Two-client isolation ───────────────────────────────────────────

	describe("multi-client isolation", () => {
		it("two clients connected to different ports maintain independent state", async () => {
			const mockServer2 = await createMockServer();

			try {
				const compressed = buildMinimalZlibPayload();

				// Server 1 sends ch1 volume = 0.3
				mockServer.onConnection = (socket) => {
					socket.once("data", () => {
						socket.write(buildZBPacket(compressed));
						socket.write(buildJMPacket({ id: "SubscriptionReply" }));
						setTimeout(() => socket.write(buildPVPacket("line/ch1/volume", 0.3)), 50);
					});
				};

				// Server 2 sends ch1 volume = 0.9
				mockServer2.onConnection = (socket) => {
					socket.once("data", () => {
						socket.write(buildZBPacket(compressed));
						socket.write(buildJMPacket({ id: "SubscriptionReply" }));
						setTimeout(() => socket.write(buildPVPacket("line/ch1/volume", 0.9)), 50);
					});
				};

				client = new Client({ host: "127.0.0.1", port: mockServer.port });
				const client2 = new Client({ host: "127.0.0.1", port: mockServer2.port });

				await Promise.all([client.connect(), client2.connect()]);
				await tick(300);

				// Each client should have its own state
				expect(client.state.get("line/ch1/volume")).toBeCloseTo(0.3, 2);
				expect(client2.state.get("line/ch1/volume")).toBeCloseTo(0.9, 2);

				await client2.close();
			} finally {
				await mockServer2.close();
			}
		});
	});
});
