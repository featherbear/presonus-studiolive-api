import zlib from "node:zlib";
import zlibParse from "../util/zlib/zlibUtil";
import type { ZlibNode } from "../util/zlib/zlibNodeParser";

export default function handleZBPacket(data: Buffer): ZlibNode {
	try {
		return parseCompressed(data.slice(4));
	} catch (error) {
		console.warn(`ZB packet handling failed: ${error.message}`);
		return null;
	}
}

export function parseCompressed(data: Buffer): ZlibNode {
	try {
		const inflated = zlib.inflateSync(data);
		return zlibParse(inflated);
	} catch (error) {
		console.warn(`ZB packet parsing failed: ${error.message}`);
		return null;
	}
}