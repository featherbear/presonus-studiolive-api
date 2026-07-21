import { describe, it, expect } from "vitest";
import { parseDataFrame, MeterGroups } from "../src/lib/MeterServer";
import { PacketHeader, MessageCode } from "../src/lib/constants";

/**
 * Build a minimal metering packet for testing
 */
function buildLevelPacket(groupNumber: number, values: number[]): Buffer {
	const header = Buffer.alloc(12);
	// PacketHeader at offset 0
	PacketHeader.copy(header, 0);
	// Length at offset 4 (LE) — we'll fix this after building the full packet
	// MessageCode "MS" at offset 6
	header.write(MessageCode.Meter16, 6);

	// Payload starts at offset 12
	const typeStr = Buffer.from("levl");

	// 2 bytes padding + valueCount (u16 LE)
	const meta = Buffer.alloc(6);
	meta.writeUInt16LE(values.length, 6 - 2); // offset 4 within meta (position 18 in full packet)

	// Value data
	const valueData = Buffer.alloc(values.length * 2);
	for (let i = 0; i < values.length; i++) {
		valueData.writeUInt16LE(values[i], i * 2);
	}

	// Descriptor count (1 group)
	const descriptorCount = Buffer.alloc(1);
	descriptorCount[0] = 1;

	// Descriptor: groupNumber (i16 BE), offset (u16 LE), count (u16 LE)
	const descriptor = Buffer.alloc(6);
	descriptor.writeInt16BE(groupNumber, 0);
	descriptor.writeUInt16LE(0, 2); // offset into values
	descriptor.writeUInt16LE(values.length, 4); // count

	const payload = Buffer.concat([typeStr, meta, valueData, descriptorCount, descriptor]);

	// Fix the length field: everything after the first 6 bytes (header + length)
	const totalLen = 6 + payload.length; // code(2) + cbyte-area(4) + payload
	header.writeUInt16LE(payload.length + 6, 4); // length includes msgcode + cbyte area

	return Buffer.concat([header, payload]);
}

describe("MeterServer", () => {
	describe("parseDataFrame", () => {
		it("returns undefined for non-packet data", () => {
			const bad = Buffer.from([0xff, 0xff, 0xff, 0xff]);
			expect(parseDataFrame(bad)).toBeUndefined();
		});

		it("returns undefined for non-MS message code", () => {
			const pkt = Buffer.alloc(20);
			PacketHeader.copy(pkt, 0);
			pkt.write("PV", 6); // not MS
			expect(parseDataFrame(pkt)).toBeUndefined();
		});
	});

	describe("createServer", () => {
		it("rejects invalid port numbers", async () => {
			const { default: createServer } = await import("../src/lib/MeterServer");
			await expect(() => createServer(-1, () => {})).toThrow("Invalid port number");
			await expect(() => createServer(70000, () => {})).toThrow("Invalid port number");
			await expect(() => createServer("abc" as any, () => {})).toThrow("Invalid port number");
		});
	});
});
