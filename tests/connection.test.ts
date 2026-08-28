/**
 * Tests for connection lifecycle and per-client isolation.
 *
 * The socket is mocked, so no console is needed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import type { Socket } from "node:net";

let mockSocket: Socket & EventEmitter;

function createMockSocket() {
	const s = new EventEmitter() as Socket & EventEmitter;
	s.connect = vi.fn() as any;
	s.destroy = vi.fn() as any;
	s.write = vi.fn((_d: any, _e: any, cb: any) => {
		if (cb) cb(null);
		return true;
	}) as any;
	(s as any).destroyed = false;
	(s as any).writable = true;
	return s;
}

vi.mock("../src/lib/util/DataClient", () => ({
	default: () => mockSocket,
}));

vi.mock("../src/lib/util/SleepWakeDetector", () => ({
	default: class extends EventEmitter {
		start() {}
		stop() {}
	},
}));

import { Client } from "../src/lib/Client";

describe("per-client isolation", () => {
	beforeEach(() => {
		mockSocket = createMockSocket();
	});

	// The chunk buffer and the file-request ID pool used to be module-level
	// singletons shared by every Client in the process, so two concurrent
	// connections corrupted each other's reassembly.
	it("gives each client its own chunk buffer", () => {
		const a = new Client({ host: "192.168.0.1" });
		const b = new Client({ host: "192.168.0.2" });

		a._chunkBuffer.push(Buffer.from("a"));
		expect(a._chunkBuffer).toHaveLength(1);
		expect(b._chunkBuffer).toHaveLength(0);
	});

	it("gives each client its own file-request ID pool", () => {
		const a = new Client({ host: "192.168.0.1" });
		const b = new Client({ host: "192.168.0.2" });
		expect(a._idPool).not.toBe(b._idPool);
	});

	it("gives each client its own buffer collector", () => {
		const a = new Client({ host: "192.168.0.1" });
		const b = new Client({ host: "192.168.0.2" });
		expect(a._bufferCollector).not.toBe(b._bufferCollector);
	});

	it("keeps state trees separate", () => {
		const a = new Client({ host: "192.168.0.1" });
		const b = new Client({ host: "192.168.0.2" });

		a.state.set("line/ch1/mute", true);
		expect(a.state.get("line/ch1/mute")).toBe(true);
		expect(b.state.get("line/ch1/mute")).toBeNull();
	});
});

describe("connect()", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		mockSocket = createMockSocket();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	// Previously a console that accepted TCP but never completed the handshake
	// left the promise pending forever.
	it("rejects rather than hanging when the console never completes a handshake", async () => {
		const client = new Client({ host: "192.168.0.1" });
		const promise = client.connect();
		const assertion = expect(promise).rejects.toThrow(/timeout/i);

		await vi.advanceTimersByTimeAsync(20_000);
		await assertion;
	});
});

describe("_writeBytes", () => {
	beforeEach(() => {
		mockSocket = createMockSocket();
	});

	// Writing to a destroyed socket used to throw from deep in the send path.
	it("does not throw when the socket is already destroyed", async () => {
		const client = new Client({ host: "192.168.0.1" });
		(mockSocket as any).destroyed = true;
		(mockSocket as any).writable = false;

		await expect(client._writeBytes(Buffer.from("x"))).resolves.toBeUndefined();
		expect(mockSocket.write).not.toHaveBeenCalled();
	});
});
