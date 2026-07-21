import { describe, it, expect, vi } from "vitest";
import { Socket } from "net";
import { EventEmitter } from "events";
import DataClient from "../src/lib/util/DataClient";
import { PacketHeader } from "../src/lib/constants";

/**
 * Build a valid UCNet packet buffer
 */
function buildPacket(messageCode: string, payload: Buffer = Buffer.alloc(0)): Buffer {
	const connIdentity = Buffer.from([0x68, 0x00, 0x65, 0x00]);
	const totalPayloadLen = messageCode.length + connIdentity.length + payload.length;
	const lenBuf = Buffer.alloc(2);
	lenBuf.writeUInt16LE(totalPayloadLen);

	return Buffer.concat([PacketHeader, lenBuf, Buffer.from(messageCode), connIdentity, payload]);
}

function createMockSocket(): Socket {
	const emitter = new EventEmitter();
	const socket = emitter as unknown as Socket;
	// Add minimal Socket interface
	socket.connect = vi.fn();
	socket.destroy = vi.fn();
	socket.write = vi.fn();
	socket.destroyed = false;
	(socket as any).writable = true;
	return socket;
}

describe("DataClient", () => {
	it("parses a single complete packet", async () => {
		const mockSocket = createMockSocket();
		const callback = vi.fn();
		DataClient(callback, mockSocket);

		const packet = buildPacket("PV", Buffer.from("test\x00\x00\x00data"));
		mockSocket.emit("data", packet);

		// Queue is async, give it a tick
		await new Promise((r) => setTimeout(r, 10));
		expect(callback).toHaveBeenCalledTimes(1);
		expect(Buffer.isBuffer(callback.mock.calls[0][0])).toBe(true);
	});

	it("parses multiple packets in one frame", async () => {
		const mockSocket = createMockSocket();
		const callback = vi.fn();
		DataClient(callback, mockSocket);

		const packet1 = buildPacket("PV", Buffer.from("a\x00\x00\x00b"));
		const packet2 = buildPacket("KA");
		mockSocket.emit("data", Buffer.concat([packet1, packet2]));

		await new Promise((r) => setTimeout(r, 10));
		expect(callback).toHaveBeenCalledTimes(2);
	});

	it("reassembles a packet split across two frames", async () => {
		const mockSocket = createMockSocket();
		const callback = vi.fn();
		DataClient(callback, mockSocket);

		const fullPacket = buildPacket("PV", Buffer.from("hello world\x00\x00\x00value"));

		// Split the packet in half
		const split = Math.floor(fullPacket.length / 2);
		const frame1 = fullPacket.slice(0, split);
		const frame2 = fullPacket.slice(split);

		mockSocket.emit("data", frame1);
		await new Promise((r) => setTimeout(r, 10));
		expect(callback).not.toHaveBeenCalled(); // incomplete

		mockSocket.emit("data", frame2);
		await new Promise((r) => setTimeout(r, 10));
		expect(callback).toHaveBeenCalledTimes(1);
	});

	it("recovers from invalid header instead of crashing", async () => {
		const mockSocket = createMockSocket();
		const callback = vi.fn();
		DataClient(callback, mockSocket);

		// Send garbage data
		mockSocket.emit("data", Buffer.from([0xff, 0xff, 0xff, 0xff, 0x00, 0x00]));
		await new Promise((r) => setTimeout(r, 10));

		// Should not have called callback
		expect(callback).not.toHaveBeenCalled();

		// Should still work after recovery
		const validPacket = buildPacket("KA");
		mockSocket.emit("data", validPacket);
		await new Promise((r) => setTimeout(r, 10));
		expect(callback).toHaveBeenCalledTimes(1);
	});

	it("returns the socket instance", () => {
		const mockSocket = createMockSocket();
		const result = DataClient(vi.fn(), mockSocket);
		expect(result).toBe(mockSocket);
	});
});
