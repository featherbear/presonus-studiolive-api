import { describe, it, expect } from "vitest";
import { toShort, toInt, toFloat, toBoolean } from "../src/lib/util/bufferUtil";

describe("bufferUtil", () => {
	describe("toShort", () => {
		it("encodes 0 as two zero bytes", () => {
			const buf = toShort(0);
			expect(buf.length).toBe(2);
			expect(buf.readUInt16LE()).toBe(0);
		});

		it("encodes 53000 correctly (little-endian)", () => {
			const buf = toShort(53000);
			expect(buf.readUInt16LE()).toBe(53000);
		});

		it("roundtrips arbitrary values", () => {
			for (const val of [1, 255, 1024, 65535]) {
				expect(toShort(val).readUInt16LE()).toBe(val);
			}
		});
	});

	describe("toInt", () => {
		it("encodes a 32-bit unsigned integer", () => {
			const buf = toInt(123456789);
			expect(buf.length).toBe(4);
			expect(buf.readUInt32LE()).toBe(123456789);
		});
	});

	describe("toFloat", () => {
		it("encodes a float correctly", () => {
			const buf = toFloat(0.5);
			expect(buf.length).toBe(4);
			expect(buf.readFloatLE()).toBeCloseTo(0.5);
		});

		it("encodes 0 and 1", () => {
			expect(toFloat(0).readFloatLE()).toBe(0);
			expect(toFloat(1).readFloatLE()).toBeCloseTo(1);
		});
	});

	describe("toBoolean", () => {
		it("encodes true as float 1.0", () => {
			expect(toBoolean(true).readFloatLE()).toBeCloseTo(1.0);
		});

		it("encodes false as float 0.0", () => {
			expect(toBoolean(false).readFloatLE()).toBe(0);
		});
	});

	describe("Buffer.matches", () => {
		it("returns true when buffer starts with the pattern", () => {
			const pattern = Buffer.from([0x55, 0x43]);
			const data = Buffer.from([0x55, 0x43, 0x00, 0x01, 0xff]);
			expect(pattern.matches(data)).toBe(true);
		});

		it("returns false when buffer does not start with the pattern", () => {
			const pattern = Buffer.from([0x55, 0x43]);
			const data = Buffer.from([0xff, 0x43, 0x00]);
			expect(pattern.matches(data)).toBe(false);
		});

		it("returns false when buffer is shorter than pattern", () => {
			const pattern = Buffer.from([0x55, 0x43, 0x00, 0x01]);
			const data = Buffer.from([0x55, 0x43]);
			expect(pattern.matches(data)).toBe(false);
		});
	});
});
