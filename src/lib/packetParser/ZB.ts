import zlibParser from "../util/zlibUtil"
import zlib from 'zlib'

export default function handleZBPacket(data) {
    return zlibParser(zlib.inflateSync(data.slice(4)))
}