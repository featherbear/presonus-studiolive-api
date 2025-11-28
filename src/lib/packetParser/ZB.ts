import zlib from "node:zlib";
import zlibParse from "../util/zlib/zlibUtil";
import type { ZlibNode } from "../util/zlib/zlibNodeParser";

export default function handleZBPacket(data: Buffer): ZlibNode {
	return parseCompressed(data.slice(4));
}

export function parseCompressed(data: Buffer): ZlibNode {
	return zlibParse(zlib.inflateSync(data));
}