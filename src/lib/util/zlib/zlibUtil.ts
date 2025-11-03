/**
 * Parse Zlib packets
 */

import type { ZlibPayload } from "../../types";
import { simplifyPathTokens, tokenisePath } from "../treeUtil";
import deserialiseUBJSON from "./ubjson";
import zlibParseNode, {
	type ZlibInputNode,
	type ZlibNode,
	ZlibRangeSymbol,
	ZlibStringEnumSymbol,
	ZlibValueSymbol,
} from "./zlibNodeParser";

/**
 * Deserialise and parse a zlib buffer into an object tree
 */
export function zlibParse(zlib: Buffer) {
	try {
		const payload = deserialiseUBJSON<ZlibPayload>(zlib);
		
		// Check if payload is valid
		if (!payload || typeof payload !== 'object') {
			console.warn("Invalid zlib payload structure, skipping");
			return null;
		}
		
		// Check for parsing error indicator
		if ((payload as any)._ubjson_parsing_error) {
			console.warn("Skipping packet due to UBJSON parsing error");
			return null;
		}
		
		if (payload.id !== "Synchronize") {
			console.warn("Unexpected zlib payload id", payload.id);
			return null;
		}

		return zlibParseNode(payload as unknown as ZlibInputNode);
		
	} catch (error) {
		console.warn(`Zlib parsing failed: ${error.message}`);
		return null;
	}
}

export default zlibParse;

export function getZlibValue<RType = ZlibNode<unknown>>(node: ZlibNode, key: string | string[]): RType {
	const tokens = [...simplifyPathTokens(tokenisePath(key))];

	let cur: ZlibNode<RType> | RType = node;
	while (cur && tokens.length > 0) {
		const next = tokens.shift();
		cur = cur[next];
	}

	// Peek into value if it has such property
	cur = cur?.[ZlibValueSymbol] ?? cur;

	if (cur === undefined) return null;

	return cur as RType;
}

/**
 *  @deprecated testing
 */
export function getZlibKeyData(
	node: ZlibNode,
	key: string | string[],
	{ value = false, range = true, strings = true } = {},
) {
	const tokens = [...simplifyPathTokens(tokenisePath(key))];

	let cur = node;
	while (cur && tokens.length > 0) {
		const next = tokens.shift();
		cur = cur[next];
	}

	if (cur === undefined) return null;

	const result: {
		value?;
		range?;
		strings?;
	} = {};
	if (value && node[ZlibValueSymbol]) result.value = node[ZlibValueSymbol];
	if (range && node[ZlibRangeSymbol]) result.range = node[ZlibRangeSymbol];
	if (strings && node[ZlibStringEnumSymbol]) result.strings = node[ZlibStringEnumSymbol];

	return result;
}