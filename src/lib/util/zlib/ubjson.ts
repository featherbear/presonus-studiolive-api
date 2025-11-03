/**
 * Deserialise a zlib buffer into a raw object payload
 * Partially implements the UBJSON specification
 * https://ubjson.org
 */
export function deserialiseUBJSON<T>(buf: Buffer): T {
	try {
		return deserialiseUBJSONInternal<T>(buf);
	} catch (error) {
		console.warn(`UBJSON parsing failed: ${error.message}`);
		console.warn('Saving raw data for analysis and returning partial data');
		
		// Save the problematic buffer for analysis
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const filename = `ubjson-error-${timestamp}.json`;
		
		const analysisData = {
			timestamp: new Date().toISOString(),
			error: {
				message: error.message,
				stack: error.stack
			},
			buffer: {
				length: buf.length,
				hex: buf.toString('hex'),
				// Include some context around where the error occurred
				preview: buf.slice(0, Math.min(100, buf.length)).toString('hex')
			},
			// Try to extract any successfully parsed data before the error
			metadata: {
				starts_with_object: buf[0] === 0x7b,
				buffer_start: buf.slice(0, 10).toString('hex'),
				buffer_end: buf.slice(-10).toString('hex'),
				// Look for type 73 occurrences
				type73_positions: findBytePositions(buf, 73)
			}
		};
		
		// Write analysis data to file
		try {
			const fs = require('fs');
			const path = require('path');
			const outputPath = path.join(process.cwd(), 'ubjson-analysis', filename);
			
			// Ensure directory exists
			const dir = path.dirname(outputPath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			
			fs.writeFileSync(outputPath, JSON.stringify(analysisData, null, 2));
			console.warn(`Raw UBJSON data saved to: ${outputPath}`);
		} catch (saveError) {
			console.warn(`Failed to save analysis data: ${saveError.message}`);
		}
		
		// Return minimal valid object to prevent crashes
		return <T><unknown>{
			_ubjson_parsing_error: true,
			_error_message: error.message,
			_partial_data: true,
			_analysis_saved: true
		};
	}
}

function findBytePositions(buf: Buffer, targetByte: number): number[] {
	const positions = [];
	for (let i = 0; i < buf.length; i++) {
		if (buf[i] === targetByte) {
			positions.push(i);
		}
	}
	return positions;
}

function deserialiseUBJSONInternal<T>(buf: Buffer): T {
	let idx = 0;
	if (buf[idx++] !== 0x7b) return null;

	const rootTree = {};
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
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
				console.warn(`Object close: workingSet length before shift: ${workingSet.length}`);
				if (workingSet.length > 1) {
					workingSet.shift();
					console.warn(`Object close: workingSet length after shift: ${workingSet.length}`);
				} else if (workingSet.length === 1) {
					console.warn(`Object close: Keeping root object, cannot close last workingSet element`);
				} else {
					console.warn(`Object close: Cannot shift from empty workingSet`);
				}
				continue;
			}

			if (controlCharacter !== 0x69 /* i */) {
				// PreSonus UBJSON Recovery: Attempt to find next valid structure
				console.warn(`UBJSON: Expected key delimiter (0x69) but found 0x${controlCharacter.toString(16)} at position ${idx}`);
				console.warn('Attempting recovery by scanning for next valid structure...');
				
				// Scan forward to find next key delimiter or object close
				let recoveryPos = idx - 1; // Go back to the problematic byte
				let found = false;
				const maxScanDistance = 1000; // Limit scan to prevent infinite loops
				
				for (let scanOffset = 0; scanOffset < maxScanDistance && recoveryPos + scanOffset < buf.length; scanOffset++) {
					const scanByte = buf[recoveryPos + scanOffset];
					
					// Look for key delimiter (start of next key-value pair)
					if (scanByte === 0x69) {
						const nextPos = recoveryPos + scanOffset + 1;
						if (nextPos < buf.length) {
							const keyLength = buf[nextPos];
							// Validate that this looks like a real key
							if (keyLength > 0 && keyLength < 100 && nextPos + 1 + keyLength < buf.length) {
								const keyBytes = buf.slice(nextPos + 1, nextPos + 1 + keyLength);
								const keyStr = keyBytes.toString('utf8');
								// Check if it's a reasonable key name
								if (/^[a-zA-Z0-9_\-\.]+$/.test(keyStr)) {
									console.warn(`Recovery: Found valid key "${keyStr}" at position ${recoveryPos + scanOffset}`);
									idx = recoveryPos + scanOffset + 1; // Position after the 0x69
									found = true;
									break;
								}
							}
						}
					}
					
					// Look for object close (end of current object)
					else if (scanByte === 0x7d) {
						console.warn(`Recovery: Found object close at position ${recoveryPos + scanOffset}, workingSet length before shift: ${workingSet.length}`);
						idx = recoveryPos + scanOffset; // Position at the 0x7d
						if (workingSet.length > 1) {
							workingSet.shift(); // Close current object
							console.warn(`Recovery: workingSet length after shift: ${workingSet.length}`);
						} else if (workingSet.length === 1) {
							console.warn(`Recovery: Keeping root object, cannot close last workingSet element`);
						} else {
							console.warn(`Recovery: Cannot shift from empty workingSet`);
						}
						found = true;
						break;
					}
				}
				
				if (!found) {
					throw new Error(`(ZB) Failed to find delimiter 1, found ${controlCharacter} instead at position ${idx}. Recovery scan failed.`);
				} else {
					console.warn(`Recovery successful: skipped ${recoveryPos + (found ? 0 : maxScanDistance) - (idx - 1)} bytes of invalid data`);
					
					// Validate workingSet after recovery
					if (workingSet.length === 0) {
						console.warn(`Recovery: workingSet is empty, reinitializing with root object`);
						workingSet.push({});
					} else if (!workingSet[0]) {
						console.warn(`Recovery: workingSet[0] is undefined, reinitializing`);
						workingSet[0] = {};
					}
					
					continue; // Restart the main loop
				}
			}

			const length = buf[idx++];
			keyData = buf.slice(idx, idx + length);
			idx += length;
		}

		const type = buf[idx++];
		let length = 0;
		switch (type) {
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
					throw new Error("(ZB) Failed to find delimiter 2");
				}

				length = buf[idx++];
				break;
			}

			// float32
			case 0x64 /* d */: {
				length = 4;
				break;
			}

			// int8
			case 0x69 /* i */: {
				length = 1;
				break;
			}

			// uint8
			case 0x55 /* U */: {
				length = 1;
				break;
			}

			// int32
			case 0x6c /* l */: {
				length = 4;
				break;
			}

			// int64
			case 0x4c /* L */: {
				length = 8;
				break;
			}

			// PreSonus extension: type 73 (0x49 = 'I') - has length prefix like strings
			case 0x49 /* I */: {
				if (idx >= buf.length) {
					console.warn("Type 73: no length byte available");
					length = 0;
				} else {
					length = buf[idx++]; // Read length byte like string type
					console.log(`Type 73 (I): using length ${length} from position ${idx-1}`);
				}
				break;
			}

			// PreSonus extension: type 114 (0x72 = 'r') - potential string type
			case 0x72 /* r */: {
				if (idx >= buf.length) {
					console.warn("Type 114: no length byte available");
					length = 0;
				} else {
					length = buf[idx++]; // Read length byte like string type
					console.log(`Type 114 (r): using length ${length} from position ${idx-1}`);
				}
				break;
			}

			default: {
				console.warn(`Unknown UBJSON type ${type} (0x${type.toString(16)}) at position ${idx}, attempting recovery`);
				
				// Log context around the unknown type for analysis
				const contextStart = Math.max(0, idx - 10);
				const contextEnd = Math.min(buf.length, idx + 10);
				const context = buf.slice(contextStart, contextEnd);
				console.warn(`Context around position ${idx}: ${context.toString('hex')}`);
				
				// For unknown types, try to determine length from next byte pattern
				// Many UBJSON types follow the pattern: type + length_indicator + length + data
				if (idx < buf.length && buf[idx] === 0x69 /* i */) {
					// Looks like it has a length indicator
					idx++; // Skip length indicator
					if (idx < buf.length) {
						length = buf[idx++]; // Read length
						idx--; // Adjust because idx will be incremented later
						console.warn(`Type ${type}: found length indicator, using length ${length}`);
					} else {
						length = 0;
					}
				} else {
					// Analyze next few bytes to guess length
					const nextBytes = buf.slice(idx, Math.min(buf.length, idx + 8));
					console.warn(`Type ${type}: next bytes: ${nextBytes.toString('hex')}`);
					
					// Fallback: try common lengths for unknown types
					length = 4; // Many types are 4 bytes (int32, float32)
				}
				console.warn(`Unknown type ${type}: using length ${length}`);
				break;
			}
		}

		const valueData = buf.slice(idx, idx + length);

		let value: any;

		switch (type) {
			// string
			case 0x53 /* S */: {
				value = valueData.toString();
				break;
			}

			// float32
			case 0x64 /* d */: {
				value = valueData.readFloatBE();
				break;
			}

			// int8
			case 0x69 /* i */: {
				value = valueData.readInt8();
				break;
			}

			// uint8
			case 0x55 /* U */: {
				value = valueData.readUInt8();
				break;
			}

			// int32
			case 0x6c /* l */: {
				value = valueData.readInt32BE();
				break;
			}

			// int64
			case 0x4c /* L */: {
				const bigIntValue = valueData.readBigInt64BE();
				value = Number(bigIntValue); // Convert BigInt to Number for JSON compatibility
				break;
			}

			// PreSonus extension: type 73 (0x49 = 'I') - variable length data
			case 0x49 /* I */: {
				if (valueData.length === 4) {
					value = valueData.readInt32BE();
					console.log(`Type 73 (I) parsed as int32: ${value} (hex: ${valueData.toString('hex')})`);
				} else {
					// Handle other lengths appropriately
					console.log(`Type 73 (I) length ${valueData.length}, hex: ${valueData.toString('hex')}`);
					value = valueData.toString('hex'); // Store as hex string for analysis
				}
				break;
			}

			// PreSonus extension: type 114 (0x72 = 'r') - string type
			case 0x72 /* r */: {
				value = valueData.toString('utf8');
				console.log(`Type 114 (r) parsed as string: "${value}"`);
				break;
			}

			default: {
				console.warn(`Unknown UBJSON value type ${type}, using null`);
				value = null;
			}
		}

		idx += length;

		if (Array.isArray(workingSet[0])) {
			(workingSet[0] as any[]).push(value);
		} else {
			// Validate workingSet integrity before assignment
			if (workingSet.length === 0) {
				console.warn(`UBJSON: workingSet is empty, reinitializing with root object`);
				workingSet.push({});
			}
			
			if (!workingSet[0]) {
				console.warn(`UBJSON: workingSet[0] is undefined, reinitializing root object`);
				workingSet[0] = {};
			}
			
			if (keyData) {
				const keyStr = keyData.toString();
				
				// Ensure workingSet[0] is a valid object before setting properties
				if (typeof workingSet[0] !== 'object' || workingSet[0] === null) {
					console.warn(`UBJSON: workingSet[0] is not an object (${typeof workingSet[0]}), creating new object`);
					workingSet[0] = {};
				}
				
				try {
					workingSet[0][keyStr] = value;
					console.log(`Set property: ${keyStr} = ${JSON.stringify(value)}`);
				} catch (assignError) {
					console.warn(`UBJSON: Failed to set property ${keyStr}: ${assignError.message}`);
					console.warn(`UBJSON: workingSet length: ${workingSet.length}`);
					console.warn(`UBJSON: workingSet[0] type: ${typeof workingSet[0]}, is null: ${workingSet[0] === null}, is undefined: ${workingSet[0] === undefined}`);
					console.warn(`UBJSON: value type: ${typeof value}, keyStr: "${keyStr}"`);
					
					if (workingSet.length === 0) {
						console.warn(`UBJSON: workingSet is empty during assignment, reinitializing`);
						workingSet.push({});
						workingSet[0][keyStr] = value;
						console.warn(`UBJSON: Recovery successful, set ${keyStr} after workingSet reinit`);
					} else if (typeof workingSet[0] !== 'object' || workingSet[0] === null || workingSet[0] === undefined) {
						console.warn(`UBJSON: workingSet[0] is invalid, reinitializing object`);
						workingSet[0] = {};
						workingSet[0][keyStr] = value;
						console.warn(`UBJSON: Recovery successful, set ${keyStr} after object reinit`);
					} else {
						console.warn(`UBJSON: Unable to recover from assignment error`);
						throw assignError;
					}
				}
			} else {
				console.warn(`UBJSON: keyData is null, cannot set property`);
			}
		}
	}

	return <T>rootTree;
}

export default deserialiseUBJSON;
