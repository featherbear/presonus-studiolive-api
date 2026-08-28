import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "events";
import { Socket } from "net";

// Mock DataClient to return a controllable mock socket
let mockSocket: Socket & EventEmitter;

function createMockSocket() {
	const s = new EventEmitter() as Socket & EventEmitter;
	s.connect = vi.fn();
	s.destroy = vi.fn();
	s.write = vi.fn((_data, _encoding, cb) => {
		if (cb) cb(null);
		return true;
	});
	(s as any).destroyed = false;
	(s as any).writable = true;
	return s;
}

vi.mock("../src/lib/util/DataClient", () => ({
	default: (callback: any) => {
		(mockSocket as any)._packetCallback = callback;
		return mockSocket;
	},
}));

// Mock SleepWakeDetector
vi.mock("../src/lib/util/SleepWakeDetector", () => ({
	default: class extends EventEmitter {
		start() {}
		stop() {}
	},
}));

import { Client } from "../src/lib/Client";
import { MessageCode } from "../src/lib/constants";

describe("Client", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		mockSocket = createMockSocket();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("constructor", () => {
		it("throws when host is not provided", () => {
			expect(() => new Client({ host: "" })).toThrow("Host address not supplied");
		});

		it("defaults to port 53000", () => {
			const client = new Client({ host: "192.168.0.1" });
			expect(client.serverPort).toBe(53000);
		});

		it("uses provided port", () => {
			const client = new Client({ host: "192.168.0.1", port: 12345 });
			expect(client.serverPort).toBe(12345);
		});

		it("initializes per-client idPool and bufferCollector", () => {
			const client = new Client({ host: "192.168.0.1" });
			expect(client._idPool).toBeDefined();
			expect(client._bufferCollector).toBeDefined();
		});

		it("two clients have independent ID pools", () => {
			const client1 = new Client({ host: "192.168.0.1" });
			mockSocket = createMockSocket(); // fresh socket for second client
			const client2 = new Client({ host: "192.168.0.2" });
			expect(client1._idPool).not.toBe(client2._idPool);
		});
	});

	describe("connect()", () => {
		it("rejects with timeout when server is unreachable", async () => {
			const client = new Client({ host: "192.168.0.1" });
			const connectPromise = client.connect();

			// Advance past the 15s connection timeout
			vi.advanceTimersByTime(16_000);

			await expect(connectPromise).rejects.toThrow("Connection timeout");
		});

		it("does not create multiple connection attempts on duplicate connect() calls", () => {
			const client = new Client({ host: "192.168.0.1" });
			client.connect();
			client.connect();
			// connect() should only call doConnect once (which calls socket.connect)
			expect(mockSocket.connect).toHaveBeenCalledTimes(1);
		});
	});

	describe("close()", () => {
		it("stops keepAliveHelper and sleepWakeDetector", async () => {
			const client = new Client({ host: "192.168.0.1" });
			await client.close();
			expect(mockSocket.destroy).toHaveBeenCalled();
		});

		it("resets connectPromise so reconnection is possible", async () => {
			const client = new Client({ host: "192.168.0.1" });

			const p1 = client.connect();
			await client.close();

			// connectPromise should be reset — new connect() should return a new promise
			const p2 = client.connect();
			expect(p2).not.toBe(p1);
		});
	});

	describe("_writeBytes guard", () => {
		it("does not write to destroyed socket", () => {
			const client = new Client({ host: "192.168.0.1" });
			(mockSocket as any).destroyed = true;

			client.mute({ type: "LINE", channel: 1 });
			expect(mockSocket.write).not.toHaveBeenCalled();
		});

		it("does not write to non-writable socket", () => {
			const client = new Client({ host: "192.168.0.1" });
			(mockSocket as any).writable = false;

			client.mute({ type: "LINE", channel: 1 });
			expect(mockSocket.write).not.toHaveBeenCalled();
		});
	});

	describe("state management", () => {
		it("caches values via state.set and retrieves them", () => {
			const client = new Client({ host: "192.168.0.1" });
			client.state.set("line/ch1/volume", 0.75);
			expect(client.state.get("line/ch1/volume")).toBe(0.75);
		});

		it("state.get returns null for missing paths", () => {
			const client = new Client({ host: "192.168.0.1" });
			expect(client.state.get("nonexistent/path")).toBeNull();
		});

		it("PV event handler caches values into state", () => {
			const client = new Client({ host: "192.168.0.1" });

			// The constructor registers: this.on(MessageCode.ParamValue, ({name, value}) => { ... state.set(name, value) })
			// Trigger that listener through the protected emit
			const emitFn = client["emit"].bind(client);
			emitFn(MessageCode.ParamValue, { name: "line/ch1/volume", value: 0.75 });

			expect(client.state.get(["line", "ch1", "volume"])).toBe(0.75);
		});

		it("PS event handler caches values into state", () => {
			const client = new Client({ host: "192.168.0.1" });

			const emitFn = client["emit"].bind(client);
			emitFn(MessageCode.ParamString, { name: "line/ch1/username", value: "Guitar" });

			expect(client.state.get("line/ch1/username")).toBe("Guitar");
		});
	});

	describe("channel control methods", () => {
		it("mute() sends a PV packet", () => {
			const client = new Client({ host: "192.168.0.1" });
			client.mute({ type: "LINE", channel: 1 });
			expect(mockSocket.write).toHaveBeenCalled();
		});

		it("getMute() returns null when state is empty", () => {
			const client = new Client({ host: "192.168.0.1" });
			expect(client.getMute({ type: "LINE", channel: 1 })).toBeNull();
		});

		it("getLevel() returns null when state is empty", () => {
			const client = new Client({ host: "192.168.0.1" });
			expect(client.getLevel({ type: "LINE", channel: 1 })).toBeNull();
		});

		it("recallProject returns a promise", () => {
			const client = new Client({ host: "192.168.0.1" });
			const result = client.recallProject("01.Showfile.proj");
			expect(result).toBeInstanceOf(Promise);
		});
	});

	describe("channel switches", () => {
		const selector = { type: "LINE", channel: 3 } as const;

		it("getSwitch() returns null when the console has not reported the value", () => {
			const client = new Client({ host: "192.168.0.1" });
			expect(client.getSwitch(selector, "phantom")).toBeNull();
		});

		it("getSwitch() normalises the boolean the console uses for 48v", () => {
			const client = new Client({ host: "192.168.0.1" });
			client.state.set("line/ch3/48v", true);
			expect(client.getSwitch(selector, "phantom")).toBe(true);
		});

		it("getSwitch() normalises the 1/0 numbers used by the other switches", () => {
			const client = new Client({ host: "192.168.0.1" });
			client.state.set("line/ch3/polarity", 1);
			client.state.set("line/ch3/comp/on", 0);
			expect(client.getSwitch(selector, "polarity")).toBe(true);
			expect(client.getSwitch(selector, "compressor")).toBe(false);
		});

		it("setSwitch() writes the channel's parameter path and a float payload", () => {
			const client = new Client({ host: "192.168.0.1" });
			client.setSwitch(selector, "polarity", true);

			expect(mockSocket.write).toHaveBeenCalled();
			const packet: Buffer = (mockSocket.write as any).mock.calls[0][0];
			expect(packet.includes(Buffer.from("line/ch3/polarity"))).toBe(true);
			// toBoolean is toFloat(1|0) — four bytes, little-endian.
			expect(packet.subarray(-4).readFloatLE(0)).toBe(1);
		});

		it("setSwitch() addresses nested processor switches", () => {
			const client = new Client({ host: "192.168.0.1" });
			client.setSwitch(selector, "limiter", true);

			const packet: Buffer = (mockSocket.write as any).mock.calls[0][0];
			expect(packet.includes(Buffer.from("line/ch3/limit/limiteron"))).toBe(true);
		});

		it("setSwitch() with \"toggle\" inverts the reported state", () => {
			const client = new Client({ host: "192.168.0.1" });
			client.state.set("line/ch3/gate/on", 1);
			client.setSwitch(selector, "gate", "toggle");

			const packet: Buffer = (mockSocket.write as any).mock.calls[0][0];
			expect(packet.subarray(-4).readFloatLE(0)).toBe(0);
		});

		it("setSwitch() with \"toggle\" treats an unreported switch as off", () => {
			const client = new Client({ host: "192.168.0.1" });
			client.setSwitch(selector, "phantom", "toggle");

			const packet: Buffer = (mockSocket.write as any).mock.calls[0][0];
			expect(packet.subarray(-4).readFloatLE(0)).toBe(1);
		});

		it("getSwitch() decodes the Buffer the console pushes in a ParamValue echo", () => {
			const client = new Client({ host: "192.168.0.1" });
			const on = Buffer.alloc(4);
			on.writeFloatLE(1);
			const off = Buffer.alloc(4);
			off.writeFloatLE(0);

			client.state.set("line/ch3/polarity", on);
			expect(client.getSwitch(selector, "polarity")).toBe(true);

			client.state.set("line/ch3/polarity", off);
			expect(client.getSwitch(selector, "polarity")).toBe(false);
		});

		it("getSwitch() returns null for a truncated Buffer rather than reading out of bounds", () => {
			const client = new Client({ host: "192.168.0.1" });
			client.state.set("line/ch3/polarity", Buffer.from([0x00, 0x00]));
			expect(client.getSwitch(selector, "polarity")).toBeNull();
		});

		it("setSwitch() seeds local state so a read before the console echo is correct", () => {
			const client = new Client({ host: "192.168.0.1" });
			client.setSwitch(selector, "polarity", true);
			expect(client.getSwitch(selector, "polarity")).toBe(true);

			// And a follow-up toggle reads from that updated value.
			client.setSwitch(selector, "polarity", "toggle");
			expect(client.getSwitch(selector, "polarity")).toBe(false);
		});

		it("rejects an unknown switch name", () => {
			const client = new Client({ host: "192.168.0.1" });
			expect(() => client.getSwitch(selector, "nope" as any)).toThrow(/Unknown channel switch/);
		});
	});

	describe("preamp gain", () => {
		const selector = { type: "LINE", channel: 4 } as const;

		it("returns null when the console has not reported a gain", () => {
			const client = new Client({ host: "192.168.0.1" });
			expect(client.getPreampGain(selector)).toBeNull();
		});

		// The wire value is a 0-1 fraction of the console's own gain range,
		// which the state dump publishes as 0-60 dB on a StudioLive III.
		it("converts the 0-1 wire value to decibels", () => {
			const client = new Client({ host: "192.168.0.1" });
			client.state.set("line/ch4/preampgain", 0.5);
			expect(client.getPreampGain(selector)).toBeCloseTo(30, 5);
		});

		it("decodes the Buffer form the console echoes", () => {
			const client = new Client({ host: "192.168.0.1" });
			const buf = Buffer.alloc(4);
			buf.writeFloatLE(1 / 3);
			client.state.set("line/ch4/preampgain", buf);
			expect(client.getPreampGain(selector)).toBeCloseTo(20, 3);
		});

		it("sends decibels as a fraction of the range", () => {
			const client = new Client({ host: "192.168.0.1" });
			client.setPreampGain(selector, 20);

			const packet: Buffer = (mockSocket.write as any).mock.calls[0][0];
			expect(packet.includes(Buffer.from("line/ch4/preampgain"))).toBe(true);
			expect(packet.subarray(-4).readFloatLE(0)).toBeCloseTo(1 / 3, 5);
		});

		// An out-of-range float here would be a very loud mistake.
		it("clamps above the range maximum", () => {
			const client = new Client({ host: "192.168.0.1" });
			client.setPreampGain(selector, 999);
			expect(client.getPreampGain(selector)).toBe(60);
		});

		it("clamps below the range minimum", () => {
			const client = new Client({ host: "192.168.0.1" });
			client.setPreampGain(selector, -40);
			expect(client.getPreampGain(selector)).toBe(0);
		});

		it("treats a non-numeric request as the range minimum rather than NaN", () => {
			const client = new Client({ host: "192.168.0.1" });
			client.setPreampGain(selector, "loud" as any);
			expect(client.getPreampGain(selector)).toBe(0);
		});

		it("getParameterRange returns null without a state dump", () => {
			const client = new Client({ host: "192.168.0.1" });
			expect(client.getParameterRange("line/ch4/preampgain")).toBeNull();
		});
	});

});
