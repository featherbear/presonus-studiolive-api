/**
 * ESM build import tests.
 *
 * Verifies that dist/ ESM output loads without errors and exposes the
 * expected named exports from both entry points.
 */
import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";

const dist = path.resolve(__dirname, "..", "dist");

let main: Record<string, any>;
let simple: Record<string, any>;

beforeAll(async () => {
	main = await import(new URL(`file://${path.join(dist, "api.mjs")}`).href);
	simple = await import(new URL(`file://${path.join(dist, "simple", "index.mjs")}`).href);
});

describe("ESM: main entry (dist/api.mjs)", () => {
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

describe("ESM: simple subpath (dist/simple/index.mjs)", () => {
	it("loads without error", () => {
		expect(simple).toBeDefined();
	});

	it.each(["SimpleClient", "settingsPathToChannelSelector"])("exports %s", (name) => {
		expect(simple[name]).toBeDefined();
	});
});
