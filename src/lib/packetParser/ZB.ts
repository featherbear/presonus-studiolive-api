import zlib from 'zlib'
import zlibParse from '../util/zlibUtil'

export default function handleZBPacket(data) {
  return zlibParse(zlib.inflateSync(data.slice(4)))
}
