import { describe, expect, it } from "vitest";

import { deserialiseUBJSON } from "../src/lib/util/zlib/ubjson";

describe("ubjson", () => {
	it("parses int16 (type 0x49) as a 2-byte signed big-endian value", () => {
		const buf = Buffer.from([0x7b, 0x69, 0x01, 0x78, 0x49, 0x00, 0x01, 0x7d]);
		expect(deserialiseUBJSON(buf)).toEqual({ x: 1 });
	});

	it("parses negative int16 (type 0x49) values", () => {
		const buf = Buffer.from([0x7b, 0x69, 0x01, 0x79, 0x49, 0xff, 0xfe, 0x7d]);
		expect(deserialiseUBJSON(buf)).toEqual({ y: -2 });
	});
});
