import { describe, it, expect } from "vitest";
import KVTree from "../src/lib/util/KVTree";

describe("KVTree", () => {
	it("registers and retrieves a simple value", () => {
		const tree = new KVTree();
		tree.register("volume", 0.75);
		expect(tree.get("volume")).toBe(0.75);
	});

	it("registers and retrieves nested values with slash delimiter", () => {
		const tree = new KVTree();
		tree.register("line/ch1/volume", 0.5);
		expect(tree.get("line/ch1/volume")).toBe(0.5);
	});

	it("registers and retrieves nested values with dot delimiter", () => {
		const tree = new KVTree();
		tree.register("line.ch1.mute", true);
		expect(tree.get("line.ch1.mute")).toBe(true);
	});

	it("returns undefined for non-existent paths", () => {
		const tree = new KVTree();
		expect(tree.get("nonexistent/path")).toBeUndefined();
	});

	it("overwrites existing values", () => {
		const tree = new KVTree();
		tree.register("line/ch1/volume", 0.5);
		tree.register("line/ch1/volume", 0.8);
		expect(tree.get("line/ch1/volume")).toBe(0.8);
	});

	it("supports multiple paths in same subtree", () => {
		const tree = new KVTree();
		tree.register("line/ch1/volume", 0.5);
		tree.register("line/ch1/mute", true);
		tree.register("line/ch2/volume", 0.7);

		expect(tree.get("line/ch1/volume")).toBe(0.5);
		expect(tree.get("line/ch1/mute")).toBe(true);
		expect(tree.get("line/ch2/volume")).toBe(0.7);
	});

	it("get on intermediate node returns a KVTree", () => {
		const tree = new KVTree();
		tree.register("line/ch1/volume", 0.5);

		const ch1 = tree.get("line/ch1");
		expect(ch1).toBeDefined();
		expect(ch1.get("volume")).toBe(0.5);
	});

	it("toJSON serializes the tree", () => {
		const tree = new KVTree();
		tree.register("a/b", 1);
		tree.register("a/c", 2);

		const json = tree.toJSON();
		expect(json).toEqual({ a: { b: 1, c: 2 } });
	});

	it("accepts array paths", () => {
		const tree = new KVTree();
		tree.register(["line", "ch1", "volume"], 0.5);
		expect(tree.get(["line", "ch1", "volume"])).toBe(0.5);
	});
});
