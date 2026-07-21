import { tokenisePath } from "./treeUtil";
import { inspect } from "node:util";

export type ValueTransformer = (value: unknown, key?: string[]) => any;

export type ValueTransformerLookup = {
	[prefix: string]: ValueTransformer;
};

/**
 * Lookup - Transformer key
 * Symbol - Reference key
 */
export const doesLookupMatch = (lookup: string | string[], symbolPath: string[]) => {
	const lookupPath = Array.isArray(lookup) ? lookup : tokenisePath(lookup);
	const lastIdx = lookupPath.length;

	let lookupIdx = 0;
	let symbolIdx = 0;

	while (symbolIdx < lastIdx) {
		if (symbolIdx >= symbolPath.length) return false;

		const currentSymbol = symbolPath[symbolIdx];
		const currentToken = lookupPath[lookupIdx];

		if ([currentSymbol, "*"].includes(currentToken)) {
			// Path matches, or wildcard match
			symbolIdx++;
			lookupIdx++;
		} else if (currentToken === "**") {
			// Double wildcard on last token, accept all
			if (lookupIdx === lastIdx) break;

			lookupIdx++;

			return doesLookupMatch(lookupPath.slice(lookupIdx).reverse(), symbolPath.slice(symbolIdx).reverse());
		} else if (
			currentToken.endsWith("*") &&
			currentSymbol.startsWith(currentToken.slice(0, currentToken.indexOf("*")))
		) {
			symbolIdx++;
			lookupIdx++;
		} else {
			// Token doesn't match
			return false;
		}
	}

	// you reached the end, nice!
	return true;
};

/**
 * Value transformers allow values to be processed different depending on their key
 */
export function valueTransform(
	path: string | string[],
	value: any,
	valueTransformers: ValueTransformerLookup,
): typeof value {
	const symbolPath = tokenisePath(path);

	for (const [lookup, transformer] of Object.entries(valueTransformers)) {
		if (doesLookupMatch(lookup, symbolPath)) {
			const old = value;
			value = transformer(value, symbolPath);
			if (old !== value) {
				try {
					logger.trace(
						{
							key: symbolPath.join("."),
							transformer: lookup,
							oldValue: old instanceof Buffer ? inspect(old) : old,
							newValue: value,
						},
						"Value transformed",
					);
				} catch (e) {
					logger.warn(
						{
							key: symbolPath.join("."),
							transformer: lookup,
							error: e.toString(),
						},
						"Value transformed, but could not serialise values",
					);
				}
			}
			break;
		}
	}

	return value;
}

export const DEFAULT_TRANSFORMS = {
	integer: {
		boolean(value) {
			if (value === 1) {
				return true;
			} else if (value === 0) {
				return false;
			}

			throw new Error("Unexpected value converting " + value);
		},
	},
	buffer: {
		boolean(bytes: Buffer) {
			if (bytes.equals(new Uint8Array([0x00, 0x00, 0x80, 0x3f]))) {
				return true;
			} else if (bytes.equals(new Uint8Array([0x00, 0x00, 0x00, 0x00]))) {
				return false;
			}

			throw new Error("Unexpected value converting " + bytes);
		},
		float(bytes: Buffer) {
			return bytes.readFloatLE();
		},
	},
} as const;

export const IGNORE = Symbol("Ignore");
