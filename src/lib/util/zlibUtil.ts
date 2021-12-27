/**
 * Parse Zlib packets
 */

import ZlibPayload from '../types/ZlibPayload'

export default function zlibParser(buf: Buffer): ZlibPayload {
  let idx = 0
  if (buf[idx++] !== 0x7b) return null

  const rootTree = {}
  const workingSet: Array<[] | {}> = [rootTree]

  while (idx !== buf.length) {
    let keyData: Buffer | null
    if (Array.isArray(workingSet[0])) {
      // nested !important
      if (buf[idx] === 0x5D /* ] */) {
        idx++
        workingSet.shift()
        continue
      }
    } else {
      const controlCharacter = buf[idx++]

      if (controlCharacter === 0x7D /* } */) {
        // Exit leaf node
        workingSet.shift()
        continue
      }

      if (controlCharacter !== 0x69 /* i */) {
        throw new Error('(A) failed to find delimiter')
      }

      const length = buf[idx++]
      keyData = buf.slice(idx, idx + length)
      idx += length
    }

    const type = buf[idx++]
    let length = 0
    switch (type) {
      case 0x7B /* { */: {
        // Create new leaf dictionary
        const leaf = {}

        if (Array.isArray(workingSet[0])) {
          (workingSet[0] as any[]).push(leaf)
        } else {
          workingSet[0][keyData.toString()] = leaf
        }
        workingSet.unshift(leaf)
        continue
      }

      case 0x5B /* [ */: {
        // Create new leaf array
        const leaf = []

        if (Array.isArray(workingSet[0])) {
          (workingSet[0] as any[]).push(leaf)
        } else {
          workingSet[0][keyData.toString()] = leaf
        }

        workingSet.unshift(leaf)
        continue
      }

      case 0x53 /* S */: {
        if (buf[idx++] !== 0x69) {
          throw new Error('(B) failed to find delimiter')
        }

        // Possibly a zero-length (aka null) string
        length = buf[idx++]
        break
      }

      case 0x64 /* d */: {
        length = 4
        break
      }

      case 0x69 /* i */: {
        // Single byte?
        length = 1
        break
      }

      default: {
        throw new Error('Unknown type ' + type)
      }
    }

    const valueData = buf.slice(idx, idx + length)

    let value

    switch (type) {
      case 0x53 /* S */: {
        value = valueData.toString()
        break
      }
      case 0x64 /* d */: {
        // FIXME: ?
        value = valueData.readUInt32LE()
        break
      }

      case 0x69 /* i */: {
        // FIXME: Single byte?
        value = valueData.readUInt8()
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
