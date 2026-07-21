import { describe, it, expect } from "vitest";
import handleJMPacket from "../src/lib/packetParser/JM";
import handlePSPacket from "../src/lib/packetParser/PS";
import handlePVPacket from "../src/lib/packetParser/PV";

describe("JM (JSON) packet parser", () => {
	it("parses a JSON payload after 4-byte prefix", () => {
		const json = { id: "SubscriptionReply", clientId: "abc" };
		const jsonStr = JSON.stringify(json);
		const data = Buffer.concat([Buffer.alloc(4), Buffer.from(jsonStr)]);

		const result = handleJMPacket(data);
		expect(result).toEqual(json);
	});

	it("throws on invalid JSON", () => {
		const data = Buffer.concat([Buffer.alloc(4), Buffer.from("not json")]);
		expect(() => handleJMPacket(data)).toThrow();
	});
});

describe("PS (ParamString) packet parser", () => {
	it("parses a key-value string pair", () => {
		// Format: key\x00\x00\x00value\x00 (null-terminated key, 2 pad bytes, value, trailing null)
		const key = "line.ch1.username";
		const value = "Guitar";
		const data = Buffer.concat([
			Buffer.from(key),
			Buffer.from([0x00, 0x00, 0x00]),
			Buffer.from(value),
			Buffer.from([0x00]),
		]);

		const result = handlePSPacket(data);
		expect(result.name).toBe(key);
		expect(result.value).toBe(value);
	});

	it("returns raw data when no null terminator found", () => {
		const data = Buffer.from([0x01, 0x02, 0x03]); // no null byte
		const result = handlePSPacket(data);
		expect(Buffer.isBuffer(result)).toBe(true);
	});
});

describe("PV (ParamValue) packet parser", () => {
	it("parses a key and float value", () => {
		const key = "line/ch1/volume";
		const valueBuf = Buffer.alloc(4);
		valueBuf.writeFloatLE(0.5);
		const data = Buffer.concat([Buffer.from(key), Buffer.from([0x00, 0x00, 0x00]), valueBuf]);

		const result = handlePVPacket(data);
		expect(result.name).toBe(key);
		expect(result.partB).toBeDefined();
	});

	it("returns raw data when no null terminator found", () => {
		const data = Buffer.from([0x01, 0x02, 0x03]); // no null byte
		const result = handlePVPacket(data);
		expect(Buffer.isBuffer(result)).toBe(true);
	});
});
