import { describe, it, expect, vi, afterEach } from "vitest";
import net from "node:net";
import { Client } from "../src/lib/Client";
import KeepAliveHelper from "../src/lib/util/KeepAliveHelper";
import { createPacket } from "../src/lib/util/messageProtocol";
import { unsubscribePacket } from "../src/lib/util/subscriptionUtil";
import { MessageCode } from "../src/lib/constants";

const fakeTimers = () =>
	vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
const stubDial = () =>
	vi.spyOn(net.Socket.prototype, "connect").mockImplementation(function (this: any) {
		return this;
	} as any);
const stubWrite = () =>
	vi.spyOn(net.Socket.prototype, "write").mockImplementation((() => true) as any);
const within = <T>(p: Promise<T>, ms: number) =>
	Promise.race([
		p.then(
			() => "settled" as const,
			() => "settled" as const,
		),
		new Promise<"timeout">((r) => setTimeout(() => r("timeout"), ms)),
	]);
const newClient = () => new Client({ host: "127.0.0.1", port: 1 });

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("Client.close()", () => {
	it("no further dial after close()", async () => {
		fakeTimers();
		const dial = stubDial();
		const client = newClient();
		client.connect().catch(() => {});
		expect(dial).toHaveBeenCalledTimes(1);
		await client.close();
		vi.advanceTimersByTime(10_000);
		expect(dial).toHaveBeenCalledTimes(1);
	});

	it("keeps retrying while not closed", async () => {
		fakeTimers();
		const dial = stubDial();
		const client = newClient();
		client.connect().catch(() => {});
		vi.advanceTimersByTime(6_000);
		expect(dial).toHaveBeenCalledTimes(4);
		await client.close();
	});

	it("pending connect() rejects after close()", async () => {
		stubDial();
		const client = newClient();
		const p = client.connect();
		await client.close();
		await expect(p).rejects.toThrow("Client closed before it connected.");
	});

	it("close() resolves promptly on a never-connected client", async () => {
		stubDial();
		stubWrite();
		const client = newClient();
		client.connect().catch(() => {});
		expect(await within(client.close(), 500)).toBe("settled");
	});

	it("close() twice is harmless", async () => {
		stubDial();
		const client = newClient();
		client.connect().catch(() => {});
		await client.close();
		await client.close();
		const c2 = newClient();
		c2.connect().catch(() => {});
		await Promise.all([c2.close(), c2.close()]);
	});

	it("close before connect", async () => {
		const dial = stubDial();
		const client = newClient();
		await client.close();
		expect(dial).not.toHaveBeenCalled();
	});

	it("connect after close rejects", async () => {
		const dial = stubDial();
		const client = newClient();
		await client.close();
		await expect(client.connect()).rejects.toThrow("Client is closed.");
		expect(dial).not.toHaveBeenCalled();
	});

	it("late connect event after close does nothing", async () => {
		stubDial();
		const write = stubWrite();
		const client = newClient();
		client.connect().catch(() => {});
		await client.close();
		write.mockClear();
		(client as any).conn.emit("connect");
		expect(write).not.toHaveBeenCalled();
		expect((client as any).keepAliveHelper).toBeUndefined();
	});

	it("sends unsubscribe when connected", async () => {
		const chunks: Buffer[] = [];
		let first!: () => void;
		const gotFirst = new Promise<void>((r) => (first = r));
		let serverClosed!: () => void;
		const closedP = new Promise<void>((r) => (serverClosed = r));
		const server = net.createServer((sock) => {
			sock.on("data", (d) => {
				chunks.push(d);
				first();
			});
			sock.on("error", () => {});
			sock.on("close", () => serverClosed());
		});
		await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
		try {
			const port = (server.address() as net.AddressInfo).port;
			const client = new Client({ host: "127.0.0.1", port });
			const p = client.connect();
			p.catch(() => {});
			await gotFirst;
			await client.close();
			expect(await within(closedP, 1000)).toBe("settled");
			const received = Buffer.concat(chunks);
			expect(received.includes(createPacket(MessageCode.JSON, unsubscribePacket))).toBe(true);
			await expect(p).rejects.toThrow("Client closed before it connected.");
		} finally {
			server.close();
		}
	});

	it("in-flight handshake after close does not start a session", async () => {
		stubDial();
		stubWrite();
		const start = vi.spyOn(KeepAliveHelper.prototype, "start");
		const client = newClient();
		const connected = vi.fn();
		client.on("connected", connected);
		client.connect().catch(() => {});
		(client as any).conn.emit("connect");
		await client.close();
		(client as any).emit(MessageCode.ZLIB, {});
		(client as any).emit(MessageCode.JSON, { id: "SubscriptionReply" });
		await new Promise((r) => setImmediate(r));
		expect(connected).not.toHaveBeenCalled();
		expect(start).not.toHaveBeenCalled();
	});
});
