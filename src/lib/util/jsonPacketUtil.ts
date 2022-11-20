import { toShort } from './bufferUtil'

/**
 * Add length metadata
 * @param buffer 
 * @returns length16LE 0x00 0x00 DATA
 */
export function prependLengthData(buffer: Buffer) {
  return Buffer.concat([
    toShort(buffer.length), Buffer.from([0, 0]), // TODO: Perhaps the length can be 32LE 
    buffer
  ])
}

export function jsonStringifyPack(json) {
  return JSON.stringify(json, null, ' ')
}

export function JSONtoPacketBuffer(json) {
  return prependLengthData(Buffer.from(jsonStringifyPack(json)))
}
