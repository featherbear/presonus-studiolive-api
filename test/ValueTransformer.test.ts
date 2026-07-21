import { describe, it, expect } from "vitest";
import { doesLookupMatch, valueTransform, DEFAULT_TRANSFORMS } from "../src/lib/util/ValueTransformer";

describe("doesLookupMatch", () => {
	it("matches exact paths", () => {
		expect(doesLookupMatch("line/ch1/volume", ["line", "ch1", "volume"])).toBe(true);
	});

	it("rejects non-matching paths", () => {
		expect(doesLookupMatch("line/ch1/volume", ["line", "ch2", "volume"])).toBe(false);
	});

	it("matches single wildcard *", () => {
		expect(doesLookupMatch("line/*/volume", ["line", "ch1", "volume"])).toBe(true);
		expect(doesLookupMatch("line/*/volume", ["line", "ch99", "volume"])).toBe(true);
	});

	it("matches double wildcard **", () => {
		expect(doesLookupMatch("line/**", ["line", "ch1", "volume"])).toBe(true);
		expect(doesLookupMatch("line/**", ["line", "ch1", "mute"])).toBe(true);
	});

	it("matches prefix wildcard ch*", () => {
		expect(doesLookupMatch("line/ch*", ["line", "ch1"])).toBe(true);
		expect(doesLookupMatch("line/ch*", ["line", "ch99"])).toBe(true);
		expect(doesLookupMatch("line/ch*", ["line", "aux1"])).toBe(false);
	});

	it("rejects when symbol path is shorter than lookup", () => {
		expect(doesLookupMatch("line/ch1/volume", ["line", "ch1"])).toBe(false);
	});
});

describe("DEFAULT_TRANSFORMS", () => {
	it("buffer.boolean converts float 1.0 to true", () => {
		const buf = Buffer.from([0x00, 0x00, 0x80, 0x3f]); // 1.0f LE
		expect(DEFAULT_TRANSFORMS.buffer.boolean(buf)).toBe(true);
	});

	it("buffer.boolean converts float 0.0 to false", () => {
		const buf = Buffer.from([0x00, 0x00, 0x00, 0x00]); // 0.0f LE
		expect(DEFAULT_TRANSFORMS.buffer.boolean(buf)).toBe(false);
	});

	it("buffer.float reads a LE float", () => {
		const buf = Buffer.alloc(4);
		buf.writeFloatLE(0.72);
		expect(DEFAULT_TRANSFORMS.buffer.float(buf)).toBeCloseTo(0.72);
	});

	it("integer.boolean converts 1 to true, 0 to false", () => {
		expect(DEFAULT_TRANSFORMS.integer.boolean(1)).toBe(true);
		expect(DEFAULT_TRANSFORMS.integer.boolean(0)).toBe(false);
	});

	it("integer.boolean throws on unexpected values", () => {
		expect(() => DEFAULT_TRANSFORMS.integer.boolean(2)).toThrow();
	});
});

describe("valueTransform", () => {
	it("applies matching transformer", () => {
		const transformers = {
			"line/*/volume": (value: Buffer) => value.readFloatLE(),
		};
		const buf = Buffer.alloc(4);
		buf.writeFloatLE(0.65);

		const result = valueTransform("line/ch1/volume", buf, transformers);
		expect(result).toBeCloseTo(0.65);
	});

	it("returns original value when no transformer matches", () => {
		const transformers = {
			"line/*/volume": (value: Buffer) => value.readFloatLE(),
		};
		const result = valueTransform("aux/ch1/mute", Buffer.from([1]), transformers);
		expect(Buffer.isBuffer(result)).toBe(true);
	});
});
