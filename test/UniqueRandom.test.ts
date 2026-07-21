import { describe, it, expect } from "vitest";
import { UniqueRandom } from "../src/lib/util/valueUtil";

describe("UniqueRandom", () => {
	it("creates an instance with the correct bit range", () => {
		const pool = new UniqueRandom(4);
		// 4-bit range: 0-15
		const ids = new Set<number>();
		for (let i = 0; i < 16; i++) {
			ids.add(pool.request());
		}
		expect(ids.size).toBe(16);
		for (const id of ids) {
			expect(id).toBeGreaterThanOrEqual(0);
			expect(id).toBeLessThanOrEqual(15);
		}
	});

	it("never returns duplicate IDs while active", () => {
		const pool = new UniqueRandom(8);
		const ids: number[] = [];
		for (let i = 0; i < 50; i++) {
			ids.push(pool.request());
		}
		expect(new Set(ids).size).toBe(50);
	});

	it("releases IDs so they can be reused", () => {
		const pool = new UniqueRandom(1); // only 0 and 1
		const a = pool.request();
		const b = pool.request();
		expect(new Set([a, b]).size).toBe(2);

		pool.release(a);
		const c = pool.request();
		expect(c).toBe(a); // only freed slot
	});

	it("active returns a copy of current IDs", () => {
		const pool = new UniqueRandom(8);
		const id1 = pool.request();
		const id2 = pool.request();

		const active = pool.active;
		expect(active).toContain(id1);
		expect(active).toContain(id2);
		expect(active.length).toBe(2);

		// Mutating the returned array should not affect internal state
		active.push(999);
		expect(pool.active.length).toBe(2);
	});

	it("release is idempotent for unknown values", () => {
		const pool = new UniqueRandom(8);
		pool.request();
		pool.release(999); // not in pool
		expect(pool.active.length).toBe(1);
	});

	it("separate instances have independent ID pools", () => {
		const poolA = new UniqueRandom(4);
		const poolB = new UniqueRandom(4);

		const idA = poolA.request();
		const idB = poolB.request();

		// Both can return the same number without collision
		poolA.release(idA);
		poolB.release(idB);

		expect(poolA.active.length).toBe(0);
		expect(poolB.active.length).toBe(0);
	});
});
