import { describe, it, expect } from "vitest";
import { analysePacket, createPacket } from "../src/lib/util/messageProtocol";
import { MessageCode, PacketHeader } from "../src/lib/constants";

describe("messageProtocol", () => {
	describe("createPacket", () => {
		it("creates a valid packet with header", () => {
			const packet = createPacket(MessageCode.KeepAlive);
			expect(PacketHeader.matches(packet)).toBe(true);
		});

		it("creates a packet with correct message code", () => {
			const packet = createPacket(MessageCode.KeepAlive);
			const messageCode = packet.slice(6, 8).toString();
			expect(messageCode).toBe("KA");
		});

		it("includes payload data", () => {
			const payload = Buffer.from("test data");
			const packet = createPacket(MessageCode.ParamValue, payload);
			// Payload should be at offset 12 (4 header + 2 length + 2 code + 4 cbyte)
			expect(packet.slice(12).toString()).toBe("test data");
		});

		it("sets correct length field", () => {
			const payload = Buffer.from("data");
			const packet = createPacket(MessageCode.ParamValue, payload);
			const length = packet.readUInt16LE(4);
			// length = 2 (code) + 4 (cbyte) + payload.length
			expect(length).toBe(2 + 4 + payload.length);
		});
	});

	describe("analysePacket", () => {
		it("roundtrips with createPacket", () => {
			const payload = Buffer.from("hello\x00\x00\x00world");
			const packet = createPacket(MessageCode.ParamValue, payload);

			const [code, data] = analysePacket(packet);
			expect(code).toBe(MessageCode.ParamValue);
			// data starts after cbyte (offset 12), so it's the payload
			expect(data.toString()).toBe("hello\x00\x00\x00world");
		});

		it("returns null for invalid header", () => {
			const bad = Buffer.from([0xff, 0xff, 0xff, 0xff, 0x06, 0x00, 0x4b, 0x41]);
			const [code, data] = analysePacket(bad);
			expect(code).toBeNull();
			expect(data).toBeNull();
		});

		it("returns null for length mismatch", () => {
			const packet = createPacket(MessageCode.KeepAlive);
			// Truncate it
			const truncated = packet.slice(0, packet.length - 2);
			const [code] = analysePacket(truncated);
			expect(code).toBeNull();
		});

		it("ignores length mismatch when flag is set", () => {
			const packet = createPacket(MessageCode.KeepAlive);
			const truncated = packet.slice(0, packet.length - 1);
			const [code] = analysePacket(truncated, true);
			expect(code).toBe(MessageCode.KeepAlive);
		});
	});
});
