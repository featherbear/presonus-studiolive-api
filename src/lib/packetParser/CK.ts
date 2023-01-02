import type Client from '../Client'
import { createFragment, PacketParser } from '../types/PacketParser'
import { parseCompressed } from '../util/zlib/zlibUtil'

let chunkBuffer: Buffer[] = []

export default <PacketParser>function handleCKPacket(this: Client, data: Buffer) {

  data = data.slice(4)

  const chunkOffset = data.readUInt32LE(0)
  const totalSize = data.readUInt32LE(4)
  const chunkSize = data.readUInt32LE(8)

  const chunkData = data.slice(12)
  chunkBuffer.push(chunkData)

  if (chunkOffset + chunkSize === totalSize) {
    // Delink the chunkBuffer and work on the chunks locally
    const fullBuffer = chunkBuffer
    chunkBuffer = []

    return [
      createFragment(null, parseCompressed(Buffer.concat(fullBuffer)))
    ]
  }
}
