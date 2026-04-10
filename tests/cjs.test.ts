/**
 * CJS build import tests.
 *
 * Verifies that dist/ CJS output loads without errors and exposes the
 * expected named exports from both entry points.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const dist = path.resolve(__dirname, "..", "dist");

let main: Record<string, any>;
let simple: Record<string, any>;

beforeAll(() => {
	main = require(path.join(dist, "api.cjs"));
	simple = require(path.join(dist, "simple", "index.cjs"));
});

describe("CJS: main entry (dist/api.cjs)", () => {
	it("loads without error", () => {
		expect(main).toBeDefined();
	});

	it.each([
		"Client",
		"Discovery",
		"MeterServer",
		"Channel",
		"MessageCode",
		"ConnectionState",
		"CByte",
		"PacketHeader",
		"parseChannelString",
	])("exports %s", (name) => {
		expect(main[name]).toBeDefined();
	});
});

describe("CJS: simple subpath (dist/simple/index.cjs)", () => {
	it("loads without error", () => {
		expect(simple).toBeDefined();
	});

	it.each(["SimpleClient", "settingsPathToChannelSelector"])("exports %s", (name) => {
		expect(simple[name]).toBeDefined();
	});
});
