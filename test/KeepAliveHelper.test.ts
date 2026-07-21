import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import KeepAliveHelper from "../src/lib/util/KeepAliveHelper";
import { UniqueRandom } from "../src/lib/util/valueUtil";

describe("KeepAliveHelper", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("sends keep-alive packets every second", () => {
		const pool = new UniqueRandom(16);
		const helper = new KeepAliveHelper(pool, 3000);
		const checkFn = vi.fn();
		const failFn = vi.fn();

		helper.start(checkFn, failFn);

		vi.advanceTimersByTime(1000);
		expect(checkFn).toHaveBeenCalledTimes(1);
		expect(checkFn).toHaveBeenCalledWith(expect.any(Array));
		expect(checkFn.mock.calls[0][0].length).toBe(2); // KA + FR packets

		// Simulate response to keep alive
		helper.updateTime();
		vi.advanceTimersByTime(1000);
		expect(checkFn).toHaveBeenCalledTimes(2);
	});

	it("calls failFn when timeout exceeded", () => {
		const pool = new UniqueRandom(16);
		const helper = new KeepAliveHelper(pool, 2000);
		const checkFn = vi.fn();
		const failFn = vi.fn();

		helper.start(checkFn, failFn);

		// Don't call updateTime — let it timeout
		vi.advanceTimersByTime(3000);
		expect(failFn).toHaveBeenCalledTimes(1);
	});

	it("stop() clears the interval", () => {
		const pool = new UniqueRandom(16);
		const helper = new KeepAliveHelper(pool, 3000);
		const checkFn = vi.fn();
		const failFn = vi.fn();

		helper.start(checkFn, failFn);
		helper.stop();

		vi.advanceTimersByTime(5000);
		expect(checkFn).not.toHaveBeenCalled();
		expect(failFn).not.toHaveBeenCalled();
	});

	it("start() stops previous interval before starting new one", () => {
		const pool = new UniqueRandom(16);
		const helper = new KeepAliveHelper(pool, 3000);
		const checkFn1 = vi.fn();
		const checkFn2 = vi.fn();
		const failFn = vi.fn();

		helper.start(checkFn1, failFn);
		helper.start(checkFn2, failFn);

		vi.advanceTimersByTime(1000);
		expect(checkFn1).not.toHaveBeenCalled(); // old loop was cleared
		expect(checkFn2).toHaveBeenCalledTimes(1);
	});

	it("intercept() filters keepalive response IDs and updates time", () => {
		const pool = new UniqueRandom(16);
		const helper = new KeepAliveHelper(pool, 3000);
		const checkFn = vi.fn();
		const failFn = vi.fn();

		helper.start(checkFn, failFn);

		// Trigger a keepalive to register an ID
		vi.advanceTimersByTime(1000);

		// Create an interceptor
		const mockFDHandler = vi.fn((data: Buffer) => ({ id: 42, data: "test" }));
		const intercepted = helper.intercept(mockFDHandler);

		// Non-keepalive ID passes through
		const result = intercepted(Buffer.from("test"));
		expect(mockFDHandler).toHaveBeenCalled();
		expect(result).toEqual({ id: 42, data: "test" });
	});
});
