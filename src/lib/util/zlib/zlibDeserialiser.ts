import ZlibPayload from '../../types/ZlibPayload'

/**
 * Deserialise a zlib buffer into a raw object payload
 * Partially implements the UBJSON specification
 * https://ubjson.org
 */
export function zlibDeserialiseBuffer(buf: Buffer): ZlibPayload {
  let idx = 0
  if (buf[idx++] !== 0x7b) return null

  const rootTree = {}
  const workingSet: Array<[] | {}> = [rootTree]

  while (idx !== buf.length) {
    let keyData: Buffer | null
    if (Array.isArray(workingSet[0])) {
      // Close leaf array
      if (buf[idx] === 0x5D /* ] */) {
        idx++
        workingSet.shift()
        continue
      }
    } else {
      const controlCharacter = buf[idx++]

      // Close leaf dictionary
      if (controlCharacter === 0x7D /* } */) {
        workingSet.shift()
        continue
      }

      if (controlCharacter !== 0x69 /* i */) {
        throw new Error(`(ZB) Failed to find delimiter 1, found ${controlCharacter} instead at position ${idx}`)
      }

      const length = buf[idx++]
      keyData = buf.slice(idx, idx + length)
      idx += length
    }

    const type = buf[idx++]
    let length = 0
    switch (type) {
      // New leaf dictionary
      case 0x7B /* { */: {
        const leaf = {}

        if (Array.isArray(workingSet[0])) {
          (workingSet[0] as any[]).push(leaf)
        } else {
          workingSet[0][keyData.toString()] = leaf
        }
        workingSet.unshift(leaf)
        continue
      }

      // New leaf array
      case 0x5B /* [ */: {
        const leaf = []

        if (Array.isArray(workingSet[0])) {
          (workingSet[0] as any[]).push(leaf)
        } else {
          workingSet[0][keyData.toString()] = leaf
        }

        workingSet.unshift(leaf)
        continue
      }

      // string
      case 0x53 /* S */: {
        if (buf[idx++] !== 0x69) {
          // UBJSON specifications say to read this value as the length type,
          // but I've yet to see a non-0x69 (i) value in the received payloads
          throw new Error('(ZB) Failed to find delimiter 2')
        }

        length = buf[idx++]
        break
      }

      // float32
      case 0x64 /* d */: {
        length = 4
        break
      }

      // int8
      case 0x69 /* i */: {
        length = 1
        break
      }

      // uint8
      case 0x55 /* U */: {
        length = 1
        break
      }

      // int32
      case 0x6c /* l */: {
        length = 4
        break
      }

      // int64
      case 0x4c /* L */: {
        length = 8
        break
      }

      default: {
        throw new Error(`Unknown type ${type} at position ${idx}`)
      }
    }

    const valueData = buf.slice(idx, idx + length)

    let value

    switch (type) {
      // string
      case 0x53 /* S */: {
        value = valueData.toString()
        break
      }

      // float32
      case 0x64 /* d */: {
        value = valueData.readFloatBE()
        break
      }

      // int8
      case 0x69 /* i */: {
        value = valueData.readInt8()
        break
      }

      // uint8
      case 0x55 /* U */: {
        value = valueData.readUInt8()
        break
      }

      // int32
      case 0x6c /* l */: {
        value = valueData.readInt32BE()
        break
      }

      // int64
      case 0x4c /* L */: {
        value = valueData.readBigInt64BE()
        break
      }

      default: {
        value = valueData.toString()
      }
    }

    idx += length

    if (Array.isArray(workingSet[0])) {
      (workingSet[0] as any[]).push(value)
    } else {
      workingSet[0][keyData.toString()] = value
    }
  }

  return rootTree as ZlibPayload
}

export default zlibDeserialiseBuffer
