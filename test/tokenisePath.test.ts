import { describe, it, expect } from "vitest";
import { tokenisePath, simplifyPathTokens } from "../src/lib/util/treeUtil";

describe("tokenisePath", () => {
	it("splits dot-delimited strings", () => {
		expect(tokenisePath("this.is.a.key")).toEqual(["this", "is", "a", "key"]);
	});

	it("splits slash-delimited strings", () => {
		expect(tokenisePath("this/is/a/key")).toEqual(["this", "is", "a", "key"]);
	});

	it("passes through arrays unchanged", () => {
		const arr = ["already", "tokenised"];
		expect(tokenisePath(arr)).toBe(arr);
	});

	it("handles single-segment paths", () => {
		expect(tokenisePath("volume")).toEqual(["volume"]);
	});

	it("returns correct result for repeated string input (cached)", () => {
		const path = "cache.test.path";
		const first = tokenisePath(path);
		const second = tokenisePath(path);
		expect(first).toEqual(second);
		// Returned arrays should be independent copies (safe from mutation)
		first.shift();
		expect(tokenisePath(path)).toEqual(["cache", "test", "path"]);
	});

	it("slash takes priority over dot when both present", () => {
		// A path like "line/ch1/volume" with dots would use slash
		expect(tokenisePath("a/b.c")).toEqual(["a", "b.c"]);
	});

	it("handles empty string", () => {
		expect(tokenisePath("")).toEqual([""]);
	});
});

describe("simplifyPathTokens", () => {
	it("removes dca prefix from path", () => {
		const result = simplifyPathTokens("filtergroup/dca/ch1");
		// dca is removed, ch1 remains
		expect(result).toEqual(["filtergroup", "ch1"]);
	});

	it("leaves non-dca paths unchanged", () => {
		const result = simplifyPathTokens("line/ch1/volume");
		expect(result).toEqual(["line", "ch1", "volume"]);
	});
});
