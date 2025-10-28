import type Client from "../Client";
import { parseCompressed } from "./ZB";
import type { ZlibNode } from "../util/zlib/zlibNodeParser";

let chunkBuffer: Buffer[] = [];

export default function handleCKPacket(this: Client, data: Buffer): ZlibNode {
	data = data.slice(4);

	const chunkOffset = data.readUInt32LE(0);
	const totalSize = data.readUInt32LE(4);
	const chunkSize = data.readUInt32LE(8);

	const chunkData = data.slice(12);
	chunkBuffer.push(chunkData);

	if (chunkOffset + chunkSize === totalSize) {
		// Delink the chunkBuffer and work on the chunks locally
		const fullBuffer = chunkBuffer;
		chunkBuffer = [];

		return parseCompressed(Buffer.concat(fullBuffer));
	}
}
