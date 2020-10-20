import { PacketHeader } from './constants'

let MessageTypes = {
  KeepAlive: 'KA',
  Hello: 'UM',
  JSON: 'JM',
  Setting: 'PV',
  Settings2: 'PL',
  FileResource: 'FR',
  FileResource2: 'FD',
  UNKNOWN_REPLY: 'BO',
  CompressedUnknown: 'CK'
}
for (let str in MessageTypes) MessageTypes[MessageTypes[str]] = str
export { MessageTypes }

export function analysePacket (
  packet /* Buffer */,
  ignoreLengthMismatch = false
) {
  if (!PacketHeader.matches(packet)) {
    console.warn('Ignoring irrelevant packet', packet)
    return [null, null]
  }

  let note = false
  let payloadLength = packet.slice(4, 6).readUInt16LE()
  if (payloadLength + 6 != packet.length) {
    if (!ignoreLengthMismatch) {
      console.warn(
        `Packet is meant to be ${payloadLength +
          6} bytes long, but is actually ${packet.length} bytes long`
      )
      return [null, null]
    }
  }

  let messageCode = packet.slice(6, 8).toString()
  let data = packet.slice(8)

  return [messageCode, data, note]
}

export function onOffCode (bool) {
  return bool ? '\x80\x3f' : '\x00\x00'
}
