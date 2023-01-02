import { createFragment, PacketParser } from '../types/PacketParser'
import { parseCompressed } from '../util/zlib/zlibUtil'

export default <PacketParser>function handleZBPacket(data) {
  return [
    createFragment(null, parseCompressed(data.slice(4)), {
      index: 4,
      count: data.length - 4,
    })
  ]

}
