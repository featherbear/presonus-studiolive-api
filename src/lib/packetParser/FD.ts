/* eslint no-unused-vars: "off" */

import { createFragment, PacketParser } from '../types/PacketParser'
import { UniqueRandom } from '../util/valueUtil'

interface ChunkSet {
  /**
   * Total size of the chunk set
   */
  max: number

  /**
   * Data
   */
  data: Buffer
}

/**
 * Piece chunks of the same ID together
 */
const BufferCollector = new class {
  #ids = UniqueRandom.get(16)
  #files: { [id: number]: ChunkSet } = {}

  /**
   * Collect a chunk
   * @returns Completed chunk if available, else nothing
   */
  put(data: Buffer) {
    let ret: {
      id: number
      data: Buffer
    }

    const chunk = parseChunk(data)

    // TODO: Invalid chunk check

    if (!this.#ids.active.includes(chunk.id)) {
      logger.warn({ id: chunk.id }, 'Received unexpected FD chunk')
      return
    }

    if (chunk.totalSize === chunk.payloadSize) {
      // No need to buffer it
      ret = {
        id: chunk.id,
        data: chunk.data
      }
    } else {
      let currChunkSet: ChunkSet
      if (!(currChunkSet = this.#files[chunk.id])) {
        // Create new entry for the chunk set
        currChunkSet = this.#files[chunk.id] = {
          max: chunk.totalSize,
          data: Buffer.allocUnsafe(0)
        }
      }

      // Ensure the data buffer matches the chunk size
      if (chunk.payloadSize !== chunk.data.length) {
        logger.warn({ id: chunk.id, expected: chunk.payloadSize, size: chunk.data.length }, 'FD chunk was inconsistent in size')
        return
      }

      // Ensure consistent state
      if (chunk.totalSize !== currChunkSet.max ||
        chunk.bytesRead !== currChunkSet.data.length
      ) {
        logger.warn({ id: chunk.id }, 'FD chunk was not consistent with the chunk set information')
        return
      }

      currChunkSet.data = Buffer.concat([currChunkSet.data, chunk.data])

      if (currChunkSet.max === currChunkSet.data.length) {
        ret = {
          id: chunk.id,
          data: currChunkSet.data
        }
      }
    }

    if (!ret) return

    if (this.#files[ret.id]) {
      delete this.#files[ret.id]
    }
    this.#ids.release(ret.id)
    return ret
  }
}()

function parseChunk(data: Buffer) {
  let header = data.slice(0, 14)

  const id = header.readUInt16BE()
  header = header.slice(2)

  const bytesRead = header.readUInt16LE()
  header = header.slice(2)

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const unknown1 = header.slice(0, 2)
  header = header.slice(2)

  const totalSize = header.readUInt16LE()
  header = header.slice(2)

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const unknown2 = header.slice(0, 4)
  header = header.slice(4)

  const payloadSize = header.readUInt16LE()

  data = data.slice(14)

  return {
    /**
     * Chunk ID
     */
    id,

    /**
     * Data buffer
     */
    data,

    /**
     * Current position / Number of previous bytes in the chunk set
     */
    bytesRead,

    /**
     * Total size of the chunk set
     */
    totalSize,

    /**
     * Size of the current chunk
     **/
    payloadSize
  }
}

export default <PacketParser>function handleFDPacket(data: Buffer) {
  const result = BufferCollector.put(data)

  if (result) {
    try {
      data = JSON.parse(result.data.toString())
    } catch { }

    return [
      createFragment(
        'id', result.id),
      createFragment('data', data)
    ]
  }
}
