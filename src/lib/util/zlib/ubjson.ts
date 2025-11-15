/**
 * Deserialise a zlib buffer into a raw object payload
 * Partially implements the UBJSON specification
 * https://ubjson.org
 */

enum CharacterMap {
	"{" = 0x7b,
	"}" = 0x7d,
	"[" = 0x5b,
	"]" = 0x5d,

	I = 0x49,
	L = 0x4c,
	S = 0x53,
	U = 0x55,

	d = 0x64,
	i = 0x69,
	l = 0x6c,
}

export function deserialiseUBJSON<T>(buf: Buffer): T {
	let idx = 0;
	if (buf[idx++] !== CharacterMap["{"]) return null;

	const rootTree = {};
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	const workingSet: Array<[] | {}> = [rootTree];

	while (idx !== buf.length) {
		let keyData: Buffer | null;
		if (Array.isArray(workingSet[0])) {
			// Close leaf array
			if (buf[idx] === CharacterMap["]"]) {
				idx++;
				workingSet.shift();
				continue;
			}
		} else {
			const controlCharacter = buf[idx++];

			// Close leaf dictionary
			if (controlCharacter === CharacterMap["}"]) {
				workingSet.shift();
				continue;
			}

			if (controlCharacter !== CharacterMap.i) {
				throw new Error(`(ZB) Failed to find delimiter 1, found ${controlCharacter} instead at position ${idx}`);
			}

			const length = buf[idx++];
			keyData = buf.slice(idx, idx + length);
			idx += length;
		}

		const type = buf[idx++];

		const SkipSymbol = Symbol();
		function getNextValue(): typeof SkipSymbol | any {
			switch (type) {
				// New leaf dictionary
				case CharacterMap["{"]: {
					const leaf = {};

					if (Array.isArray(workingSet[0])) {
						(workingSet[0] as any[]).push(leaf);
					} else {
						workingSet[0][keyData.toString()] = leaf;
					}
					workingSet.unshift(leaf);
					return SkipSymbol;
				}

				// New leaf array
				case CharacterMap["["]: {
					const leaf = [];

					if (Array.isArray(workingSet[0])) {
						(workingSet[0] as any[]).push(leaf);
					} else {
						workingSet[0][keyData.toString()] = leaf;
					}

					workingSet.unshift(leaf);
					return SkipSymbol;
				}

				// int16
				case CharacterMap.I: {
					const dataLength = 2;
					const valueData = buf.slice(idx, idx + dataLength);
					idx += dataLength;
					return valueData.readInt16BE();
				}

				// int64
				case CharacterMap.L: {
					const dataLength = 8;
					const valueData = buf.slice(idx, idx + dataLength);
					idx += dataLength;
					return valueData.readBigInt64BE();
				}

				// string
				case CharacterMap.S: {
					if (buf[idx++] !== CharacterMap.i) {
						// UBJSON specifications say to read this value as the length type,
						// but I've yet to see a non-0x69 (i) value in the received payloads
						throw new Error("(ZB) Failed to find delimiter 2");
					}

					const dataLength = buf[idx++]
					const valueData = buf.slice(idx, idx + dataLength);
					idx += dataLength;
					return valueData.toString();
				}

				// uint8
				case CharacterMap.U: {
					const dataLength = 1;
					const valueData = buf.slice(idx, idx + dataLength);
					idx += dataLength;
					return valueData.readUInt8();
				}

				// float32
				case CharacterMap.d: {
					const dataLength = 4;
					const valueData = buf.slice(idx, idx + dataLength);
					idx += dataLength;
					return valueData.readFloatBE();
				}

				// int8
				case CharacterMap.i: {
					const dataLength = 1;
					const valueData = buf.slice(idx, idx + dataLength);
					idx += dataLength;
					return valueData.readInt8();
				}

				// int32
				case CharacterMap.l: {
					const dataLength = 4;
					const valueData = buf.slice(idx, idx + dataLength);
					idx += dataLength;
					return valueData.readInt32BE();
				}

				default: {
					throw new Error(`Unknown type ${type} at position ${idx}`);
				}
			}
		}

		const value = getNextValue();
		if (value === SkipSymbol) {
			continue;
		}

		if (Array.isArray(workingSet[0])) {
			(workingSet[0] as any[]).push(value);
		} else {
			workingSet[0][keyData.toString()] = value;
		}
	}

	return <T>rootTree;
}

export default deserialiseUBJSON;
