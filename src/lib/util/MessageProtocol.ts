import { PacketHeader } from '../constants'

type MessageCode = string
/**
 * Decode packet buffer
 * @returns message code
 * @returns buffer
 */
export function analysePacket(
  packet: Buffer,
  ignoreLengthMismatch = false
): [MessageCode, Buffer] {
  if (!PacketHeader.matches(packet)) {
    console.warn('Ignoring irrelevant packet', packet)
    return [null, null]
  }

  const payloadLength = packet.slice(4, 6).readUInt16LE()
  if (payloadLength + 6 !== packet.length) {
    if (!ignoreLengthMismatch) {
      console.warn(`Packet is meant to be ${payloadLength + 6} bytes long, but is actually ${packet.length} bytes long`)
      return [null, null]
    }
  }

  const messageCode = packet.slice(6, 8).toString()
  
  // Skip bytes 8-11 (identifier pair)
  const data = packet.slice(12)

  return [messageCode, data]
}

export function onOff_encode(bool) {
  return Buffer.from(bool ? [0x00, 0x00, 0x80, 0x3f] : [0x00, 0x00, 0x00, 0x00])
}

export function onOff_decode(bytes) {
  if (bytes.equals(new Uint8Array([0x00, 0x00, 0x80, 0x3f]))) {
    return true
  } else if (bytes.equals(new Uint8Array([0x00, 0x00, 0x00, 0x00]))) {
    return false
  }
  return bytes
}
