/**
 * Tests for the per-channel switch and preamp gain accessors.
 *
 * The socket is mocked so no console is needed. Where a test pins a specific
 * byte layout or a specific normalisation, the behaviour was confirmed against
 * a StudioLive 16R.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";
import type { Socket } from "node:net";

let mockSocket: Socket & EventEmitter;

function createMockSocket() {
	const s = new EventEmitter() as Socket & EventEmitter;
	s.connect = vi.fn() as any;
	s.destroy = vi.fn() as any;
	s.write = vi.fn((_data: any, _encoding: any, cb: any) => {
		if (cb) cb(null);
		return true;
	}) as any;
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

import { Client } from "../src/lib/Client";

/** The packet body written by the most recent send. */
function lastPacket(): Buffer {
	const calls = (mockSocket.write as any).mock.calls;
	return calls[calls.length - 1][0];
}

describe("channel switches", () => {
	const selector = { type: "LINE", channel: 3 } as const;

	beforeEach(() => {
		mockSocket = createMockSocket();
	});

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

	// The console pushes a change back as a ParamValue packet whose payload
	// lands in the cache as a Buffer. Number(buffer) is NaN, so without this
	// a switch appears to revert shortly after being set.
	it("getSwitch() decodes the Buffer form the console echoes", () => {
		const client = new Client({ host: "192.168.0.1" });
		const on = Buffer.alloc(4);
		on.writeFloatLE(1);
		client.state.set("line/ch3/polarity", on);
		expect(client.getSwitch(selector, "polarity")).toBe(true);
	});

	it("getSwitch() returns null for a truncated Buffer rather than reading out of bounds", () => {
		const client = new Client({ host: "192.168.0.1" });
		client.state.set("line/ch3/polarity", Buffer.from([0x00, 0x00]));
		expect(client.getSwitch(selector, "polarity")).toBeNull();
	});

	it("setSwitch() writes the channel's parameter path and a float payload", () => {
		const client = new Client({ host: "192.168.0.1" });
		client.setSwitch(selector, "polarity", true);

		const packet = lastPacket();
		expect(packet.includes(Buffer.from("line/ch3/polarity"))).toBe(true);
		expect(packet.subarray(-4).readFloatLE(0)).toBe(1);
	});

	it("setSwitch() addresses nested processor switches", () => {
		const client = new Client({ host: "192.168.0.1" });
		client.setSwitch(selector, "limiter", true);
		expect(lastPacket().includes(Buffer.from("line/ch3/limit/limiteron"))).toBe(true);
	});

	it('setSwitch() with "toggle" inverts the reported state', () => {
		const client = new Client({ host: "192.168.0.1" });
		client.state.set("line/ch3/gate/on", 1);
		client.setSwitch(selector, "gate", "toggle");
		expect(lastPacket().subarray(-4).readFloatLE(0)).toBe(0);
	});

	it('setSwitch() with "toggle" treats an unreported switch as off', () => {
		const client = new Client({ host: "192.168.0.1" });
		client.setSwitch(selector, "phantom", "toggle");
		expect(lastPacket().subarray(-4).readFloatLE(0)).toBe(1);
	});

	it("setSwitch() seeds local state so a read before the console echo is correct", () => {
		const client = new Client({ host: "192.168.0.1" });
		client.setSwitch(selector, "polarity", true);
		expect(client.getSwitch(selector, "polarity")).toBe(true);

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

	beforeEach(() => {
		mockSocket = createMockSocket();
	});

	it("returns null when the console has not reported a gain", () => {
		const client = new Client({ host: "192.168.0.1" });
		expect(client.getPreampGain(selector)).toBeNull();
	});

	// The wire value is a 0-1 fraction of the console's own gain range, which
	// the state dump publishes as 0-60 dB on a StudioLive III.
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

		const packet = lastPacket();
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

	it("treats a non-numeric request as the range minimum rather than sending NaN", () => {
		const client = new Client({ host: "192.168.0.1" });
		client.setPreampGain(selector, "loud" as any);
		expect(client.getPreampGain(selector)).toBe(0);
	});

	it("getParameterRange returns null without a state dump", () => {
		const client = new Client({ host: "192.168.0.1" });
		expect(client.getParameterRange("line/ch4/preampgain")).toBeNull();
	});
});
