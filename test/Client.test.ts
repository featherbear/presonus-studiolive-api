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
});
