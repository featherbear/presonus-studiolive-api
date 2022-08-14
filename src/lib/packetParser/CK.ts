import Client from '../Client'
import * as zlib from 'zlib'
// import * as bjd from 'bjd'

const chunkBuffer: Buffer[] = []

export default function handleCKPacket(this: Client, data: Buffer) {
  data = data.slice(4)

  const chunkOffset = data.readUInt32LE(0)
  const totalSize = data.readUInt32LE(4)
  const chunkSize = data.readUInt32LE(8)

  const chunkData = data.slice(12)
  chunkBuffer.push(chunkData)

  if (chunkOffset + chunkSize === totalSize) {
    const fullData = Buffer.concat(chunkBuffer)
    const unzip = zlib.inflateSync(fullData)
    // const data = bjd.decode(unzip)
    console.log(data)
  }
}
