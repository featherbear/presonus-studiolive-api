import { it, expect, vi, afterEach } from "vitest";
import "../src/lib/util/logging";
import KeepAliveHelper from "../src/lib/util/KeepAliveHelper";

afterEach(() => vi.useRealTimers());

it("stop() halts packets and the fail callback", () => {
	vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
	const helper = new KeepAliveHelper(3000);
	const check = vi.fn();
	const fail = vi.fn();
	helper.start(check, fail);
	vi.advanceTimersByTime(1000);
	expect(check).toHaveBeenCalledTimes(1);
	helper.stop();
	vi.advanceTimersByTime(10000);
	expect(check).toHaveBeenCalledTimes(1);
	expect(fail).not.toHaveBeenCalled();
});

it("stop() before start() and twice is harmless", () => {
	const helper = new KeepAliveHelper();
	expect(() => { helper.stop(); helper.stop(); }).not.toThrow();
});
