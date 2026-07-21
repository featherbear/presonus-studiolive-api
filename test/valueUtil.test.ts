import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logVolumeToLinear, clamp, transitionValue } from "../src/lib/util/valueUtil";

describe("logVolumeToLinear", () => {
	it("maps -84 dB to 0", () => {
		expect(logVolumeToLinear(-84)).toBe(0);
	});

	it("maps +10 dB to 100", () => {
		expect(logVolumeToLinear(10)).toBe(100);
	});

	it("maps 0 dB to approximately 72 (unity)", () => {
		const result = logVolumeToLinear(0);
		expect(result).toBeGreaterThanOrEqual(70);
		expect(result).toBeLessThanOrEqual(75);
	});

	it("clamps below -84 to 0", () => {
		expect(logVolumeToLinear(-100)).toBe(0);
	});

	it("clamps above +10 to 100", () => {
		expect(logVolumeToLinear(20)).toBe(100);
	});

	it("is monotonically increasing", () => {
		let prev = logVolumeToLinear(-84);
		for (let db = -83; db <= 10; db++) {
			const curr = logVolumeToLinear(db);
			expect(curr).toBeGreaterThanOrEqual(prev);
			prev = curr;
		}
	});
});

describe("clamp", () => {
	it("returns value when within bounds", () => {
		expect(clamp(5, [0, 10])).toBe(5);
	});

	it("clamps to min", () => {
		expect(clamp(-5, [0, 10])).toBe(0);
	});

	it("clamps to max", () => {
		expect(clamp(15, [0, 10])).toBe(10);
	});
});

describe("transitionValue", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("calls fn immediately with target when duration is 0", () => {
		const fn = vi.fn();
		const callback = vi.fn();
		transitionValue(0, 100, 0, fn, callback);

		expect(fn).toHaveBeenCalledWith(100);
		expect(callback).toHaveBeenCalled();
	});

	it("calls fn immediately with target when from === to", () => {
		const fn = vi.fn();
		transitionValue(50, 50, 1000, fn);
		expect(fn).toHaveBeenCalledWith(50);
	});

	it("transitions over time and calls callback when done", () => {
		const fn = vi.fn();
		const callback = vi.fn();

		transitionValue(0, 100, 1000, fn, callback);

		// Should have been called at least once immediately (tick())
		expect(fn).toHaveBeenCalled();

		// Run through the full transition
		vi.advanceTimersByTime(1500);
		expect(callback).toHaveBeenCalled();

		// Final value should be 100
		const lastCall = fn.mock.calls[fn.mock.calls.length - 1][0];
		expect(lastCall).toBeCloseTo(100, 0);
	});

	it("cancel function stops the transition", () => {
		const fn = vi.fn();
		const callback = vi.fn();

		const cancel = transitionValue(0, 100, 1000, fn, callback);
		const callCountBefore = fn.mock.calls.length;

		cancel();
		vi.advanceTimersByTime(2000);

		// Should not have been called more after cancel
		expect(fn.mock.calls.length).toBe(callCountBefore);
		expect(callback).not.toHaveBeenCalled();
	});
});
