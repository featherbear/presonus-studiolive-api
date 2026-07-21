import { describe, it, expect } from "vitest";
import { BufferCollector } from "../src/lib/packetParser/FD";
import { UniqueRandom } from "../src/lib/util/valueUtil";

function makeChunk(id: number, bytesRead: number, totalSize: number, payload: Buffer): Buffer {
	const header = Buffer.alloc(14);
	header.writeUInt16BE(id, 0);
	header.writeUInt16LE(bytesRead, 2);
	// unknown1 at offset 4-5
	header.writeUInt16LE(totalSize, 6);
	// unknown2 at offset 8-11
	header.writeUInt16LE(payload.length, 12);
	return Buffer.concat([header, payload]);
}

describe("BufferCollector", () => {
	it("returns single-chunk payloads immediately", () => {
		const pool = new UniqueRandom(16);
		const collector = new BufferCollector(pool);

		const id = pool.request();
		const payload = Buffer.from("hello world");
		const chunk = makeChunk(id, 0, payload.length, payload);

		const result = collector.put(chunk);
		expect(result).toBeDefined();
		expect(result.id).toBe(id);
		expect(result.data.toString()).toBe("hello world");
	});

	it("reassembles multi-chunk payloads", () => {
		const pool = new UniqueRandom(16);
		const collector = new BufferCollector(pool);

		const id = pool.request();
		const part1 = Buffer.from("hello ");
		const part2 = Buffer.from("world");
		const totalSize = part1.length + part2.length;

		const chunk1 = makeChunk(id, 0, totalSize, part1);
		const result1 = collector.put(chunk1);
		expect(result1).toBeUndefined(); // not complete yet

		const chunk2 = makeChunk(id, part1.length, totalSize, part2);
		const result2 = collector.put(chunk2);
		expect(result2).toBeDefined();
		expect(result2.data.toString()).toBe("hello world");
	});

	it("rejects chunks for unknown IDs", () => {
		const pool = new UniqueRandom(16);
		const collector = new BufferCollector(pool);

		// Don't request an ID from pool — it won't be "active"
		const payload = Buffer.from("sneaky");
		const chunk = makeChunk(12345, 0, payload.length, payload);
		const result = collector.put(chunk);
		expect(result).toBeUndefined();
	});

	it("releases ID from pool after completion", () => {
		const pool = new UniqueRandom(16);
		const collector = new BufferCollector(pool);

		const id = pool.request();
		expect(pool.active).toContain(id);

		const payload = Buffer.from("data");
		const chunk = makeChunk(id, 0, payload.length, payload);
		collector.put(chunk);

		expect(pool.active).not.toContain(id);
	});

	it("rejects chunks with inconsistent size", () => {
		const pool = new UniqueRandom(16);
		const collector = new BufferCollector(pool);

		const id = pool.request();
		// Claim payload is 10 bytes but only provide 5
		const header = Buffer.alloc(14);
		header.writeUInt16BE(id, 0);
		header.writeUInt16LE(0, 2);
		header.writeUInt16LE(20, 6); // totalSize
		header.writeUInt16LE(10, 12); // payloadSize claims 10

		const payload = Buffer.from("short"); // only 5 bytes
		const chunk = Buffer.concat([header, payload]);

		const result = collector.put(chunk);
		expect(result).toBeUndefined();
	});

	it("two collectors with separate pools are independent", () => {
		const poolA = new UniqueRandom(16);
		const poolB = new UniqueRandom(16);
		const collectorA = new BufferCollector(poolA);
		const collectorB = new BufferCollector(poolB);

		const idA = poolA.request();
		const idB = poolB.request();

		const payloadA = Buffer.from("dataA");
		const payloadB = Buffer.from("dataB");

		const resultA = collectorA.put(makeChunk(idA, 0, payloadA.length, payloadA));
		const resultB = collectorB.put(makeChunk(idB, 0, payloadB.length, payloadB));

		expect(resultA.data.toString()).toBe("dataA");
		expect(resultB.data.toString()).toBe("dataB");
	});
});
