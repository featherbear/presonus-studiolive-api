import zlib from 'zlib'
import zlibParse from '../util/zlib/zlibUtil'

export default function handleZBPacket(data) {
  return parseCompressed(data.slice(4))
}

export function parseCompressed(data: Buffer) {
  return zlibParse(zlib.inflateSync(data))
}
