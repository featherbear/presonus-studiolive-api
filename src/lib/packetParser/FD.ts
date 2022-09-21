export default function handleFDPacket(data: Buffer) {
  const id = data.readUInt16BE()
  data = data.slice(4)
  const size = data.readUInt32LE()
  // ???
  data = data.slice(6)
  return {
    id,
    data
  }
}
