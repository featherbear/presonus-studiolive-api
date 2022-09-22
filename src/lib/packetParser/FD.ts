/* eslint no-unused-vars: "off" */

/*

Header - first 14 bytes

XX

XX - Message ID

*/

import { UniqueRandom } from '../util/valueUtil'

type Chunk = {
  max: number,
  data: Buffer
}
const BufferCollector = new class {
  #ids = UniqueRandom.get(16)
  #files: {[id: number]: Chunk} = {}

  put(data: Buffer) {
    let ret: {id: number, data: Buffer}

    const chunk = parseChunk(data)

    // TODO: Invalid chunk check

    if (!this.#ids.active.includes(chunk.id)) {
      console.warn('Packet not expected')
      return
    }

    if (chunk.totalSize === chunk.payloadSize) {
      // No need to buffer it
      ret = {
        id: chunk.id,
        data: chunk.data
      }
    } else {
      let curr: Chunk
      if (!(curr = this.#files[chunk.id])) {
        curr = this.#files[chunk.id] = {
          max: chunk.totalSize,
          data: Buffer.allocUnsafe(0)
        }
      }

      if (chunk.payloadSize !== chunk.data.length
      ) {
        console.warn('Packet inconsistent')
        return
      }
      if (chunk.totalSize !== curr.max ||
        chunk.bytesRead !== curr.data.length
      ) {
        console.warn('Packet not expected')
        return
      }

      curr.data = Buffer.concat([curr.data, chunk.data])

      if (curr.max === curr.data.length) {
        ret = {
          id: chunk.id,
          data: curr.data
        }
      }
    }

    if (ret) {
      if (this.#files[ret.id]) { delete this.#files[ret.id] }
      this.#ids.release(ret.id)
      return ret
    }
  }
}()

function parseChunk(data: Buffer) {
  let header = data.slice(0, 14)
  
  const id = header.readUInt16BE()
  header = header.slice(2)
  
  const bytesRead = header.readUInt16LE()
  header = header.slice(2)

  const unknown1 = header.slice(0, 2)
  header = header.slice(2)

  const totalSize = header.readUInt16LE()
  header = header.slice(2)

  const unknown2 = header.slice(0, 4)
  header = header.slice(4)

  const payloadSize = header.readUInt16LE()

  data = data.slice(14)

  return {
    id,
    data,
    
    bytesRead,
    totalSize,
    payloadSize
  }
}

export default function handleFDPacket(data: Buffer) {
  const result = BufferCollector.put(data)
  if (result) {
    return {
      id: result.id,
      data: JSON.parse(result.data.toString())
    }
  }
}
