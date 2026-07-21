import { describe, it, expect } from "vitest";
import CacheProvider from "../src/lib/util/CacheProvider";

describe("CacheProvider", () => {
	it("sets and gets values", () => {
		const cache = CacheProvider();
		cache.set("line/ch1/volume", 0.5);
		expect(cache.get("line/ch1/volume")).toBe(0.5);
	});

	it("returns default when path not found", () => {
		const cache = CacheProvider();
		expect(cache.get("missing/path", 42)).toBe(42);
	});

	it("returns null default when no default provided", () => {
		const cache = CacheProvider();
		expect(cache.get("missing/path")).toBeNull();
	});

	it("falls back to fallback provider when not in cache", () => {
		const fallback = {
			get: (path: string | string[]) => {
				if (path === "external/value") return "from_fallback";
				return null;
			},
		};
		const cache = CacheProvider(fallback);
		expect(cache.get("external/value")).toBe("from_fallback");
	});

	it("prefers cache over fallback", () => {
		const fallback = {
			get: () => "fallback_value",
		};
		const cache = CacheProvider(fallback);
		cache.set("key", "cache_value");
		expect(cache.get("key")).toBe("cache_value");
	});

	it("overwrites values", () => {
		const cache = CacheProvider();
		cache.set("key", "old");
		cache.set("key", "new");
		expect(cache.get("key")).toBe("new");
	});
});
