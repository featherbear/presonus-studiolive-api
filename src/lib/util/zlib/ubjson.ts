/** biome-ignore-all lint/complexity/useSimpleNumberKeys: Easier to read */

interface TypeDecoder {
	readonly length: number
	readonly read: (buf: Buffer) => any
}

const decodeMap = {
	0x69: {
		// ASCII: i
		// type: int8
		length: 1,
		read: (buf: Buffer) => buf.readInt8()
	},
	0x55: {
		// ASCII: U
		// type: uint8
		length: 1,
		read: (buf: Buffer) => buf.readUint8()
	},
	0x49: {
		// ASCII: I
		// type: int16
		length: 2,
		read: (buf: Buffer) => buf.readInt16BE()
	},
	0x6c: {
		// ASCII: l
		// type: int32
		length: 4,
		read: (buf: Buffer) => buf.readInt32BE()
	},
	0x4c: {
		// ASCII: L
		// type: int64
		length: 8,
		read: (buf: Buffer) => buf.readBigInt64BE()
	},
	0x64: {
		// ASCII: d
		// type: float32
		length: 4,
		read: (buf: Buffer) => buf.readFloatBE()
	},
} as const satisfies Readonly<Record<number, TypeDecoder>>




/**
 * Deserialise a zlib buffer into a raw object payload
 * Partially implements the UBJSON specification
 * https://ubjson.org
 */
export function deserialiseUBJSON<T>(buf: Buffer): T {
	let idx = 0;
	if (buf[idx++] !== 0x7b) return null;

	const rootTree = {};
	const workingSet: Array<[] | {}> = [rootTree];

	while (idx !== buf.length) {
		let keyData: Buffer | null;
		if (Array.isArray(workingSet[0])) {
			// Close leaf array
			if (buf[idx] === 0x5d /* ] */) {
				idx++;
				workingSet.shift();
				continue;
			}
		} else {
			const controlCharacter = buf[idx++];

			// Close leaf dictionary
			if (controlCharacter === 0x7d /* } */) {
				workingSet.shift();
				continue;
			}

			if (controlCharacter !== 0x69 /* i */) {
				throw new Error(`(ZB) Failed to find delimiter 1, found ${controlCharacter} instead at position ${idx}`);
			}

			const length = buf[idx++];
			keyData = buf.subarray(idx, idx + length);
			idx += length;
		}

		const typeByte = buf[idx++];
		let valueProcessor: TypeDecoder

		switch (typeByte) {
			// New leaf dictionary
			case 0x7b /* { */: {
				const leaf = {};

				if (Array.isArray(workingSet[0])) {
					(workingSet[0] as any[]).push(leaf);
				} else {
					workingSet[0][keyData.toString()] = leaf;
				}
				workingSet.unshift(leaf);
				continue;
			}

			// New leaf array
			case 0x5b /* [ */: {
				const leaf = [];

				if (Array.isArray(workingSet[0])) {
					(workingSet[0] as any[]).push(leaf);
				} else {
					workingSet[0][keyData.toString()] = leaf;
				}

				workingSet.unshift(leaf);
				continue;
			}

			// string
			case 0x53 /* S */: {
				if (buf[idx++] !== 0x69) {
					// UBJSON specifications say to read this value as the length type,
					// but I've yet to see a non-0x69 (i) value in the received payloads
					// so we'll skip that processing
					throw new Error("(ZB) Unexpected length type when reading string");
				}

				valueProcessor = {
					length: buf[idx++],
					read: (buf: Buffer) => buf.toString()
				}
				break;
			}

			default: {
				valueProcessor = decodeMap[typeByte]
				break
			}
		}

		if (!valueProcessor) {
			throw new Error(`Unknown type ${typeByte} at position ${idx}`);
		}

		const valueBuffer = buf.subarray(idx, idx + valueProcessor.length);
		const value = valueProcessor.read(valueBuffer)

		idx += valueProcessor.length;

		if (Array.isArray(workingSet[0])) {
			(workingSet[0] as any[]).push(value);
		} else {
			workingSet[0][keyData.toString()] = value;
		}
	}

	return <T>rootTree;
}

export default deserialiseUBJSON;
