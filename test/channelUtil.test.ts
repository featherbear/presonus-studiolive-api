import { describe, it, expect } from "vitest";
import { parseChannelString, setCounts } from "../src/lib/util/channelUtil";

describe("parseChannelString", () => {
	it("generates correct path for LINE channel", () => {
		const result = parseChannelString({ type: "LINE", channel: 1 });
		expect(result).toBe("line/ch1");
	});

	it("generates correct path for AUX channel", () => {
		const result = parseChannelString({ type: "AUX", channel: 3 });
		expect(result).toBe("aux/ch3");
	});

	it("generates correct path for FX channel", () => {
		const result = parseChannelString({ type: "FX", channel: 2 });
		expect(result).toBe("fxbus/ch2");
	});

	it("generates correct path for MAIN", () => {
		const result = parseChannelString({ type: "MAIN", channel: 99 });
		// MAIN forces channel = 1
		expect(result).toBe("main/ch1");
	});

	it("generates correct path for TALKBACK", () => {
		const result = parseChannelString({ type: "TALKBACK", channel: 5 });
		// TALKBACK forces channel = 1
		expect(result).toBe("talkback/ch1");
	});

	it("throws on invalid channel type", () => {
		expect(() => parseChannelString({ type: "INVALID" as any, channel: 1 })).toThrow(
			"Invalid channel type provided",
		);
	});

	it("throws on channel 0", () => {
		expect(() => parseChannelString({ type: "LINE", channel: 0 })).toThrow("Invalid channel provided");
	});

	it("throws on negative channel", () => {
		expect(() => parseChannelString({ type: "LINE", channel: -1 })).toThrow("Invalid channel provided");
	});

	it("throws on fractional channel", () => {
		expect(() => parseChannelString({ type: "LINE", channel: 1.5 })).toThrow("Invalid channel provided");
	});

	describe("with counts set", () => {
		it("validates channel is within range", () => {
			setCounts({
				LINE: 16,
				AUX: 10,
				FX: 4,
				FXRETURN: 4,
				RETURN: 2,
				TALKBACK: 1,
				MAIN: 1,
				DCA: 8,
				SUB: 4,
			});

			expect(parseChannelString({ type: "LINE", channel: 16 })).toBe("line/ch16");
			expect(() => parseChannelString({ type: "LINE", channel: 17 })).toThrow("Invalid channel provided");
		});

		it("validates mix type and number", () => {
			setCounts({
				LINE: 16,
				AUX: 10,
				FX: 4,
				FXRETURN: 4,
				RETURN: 2,
				TALKBACK: 1,
				MAIN: 1,
				DCA: 8,
				SUB: 4,
			});

			// Valid AUX mix
			expect(parseChannelString({ type: "LINE", channel: 1, mixType: "AUX", mixNumber: 5 })).toBe("line/ch1");

			// AUX mix number out of range
			expect(() =>
				parseChannelString({ type: "LINE", channel: 1, mixType: "AUX", mixNumber: 11 }),
			).toThrow("Invalid mix channel provided");

			// Invalid mix number
			expect(() =>
				parseChannelString({ type: "LINE", channel: 1, mixType: "AUX", mixNumber: 0 }),
			).toThrow("Invalid mix channel provided");
		});

		// Reset counts so other tests aren't affected
		setCounts(undefined);
	});
});
