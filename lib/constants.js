export const PacketHeader = Buffer.from([0x55, 0x43, 0x00, 0x01]) // UC..
PacketHeader.matches = function (buffer) {
  return buffer.length >= this.length
    ? this.compare(buffer, 0, this.length) === 0
    : false
}

// These values might come from the broadcast discovery
export const CByte = {
  A: 0x68,
  B: 0x65
}
