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
// for (let str in MessageTypes) MessageTypes[MessageTypes[str]] = str
for (let [k, v] of Object.entries(MessageTypes)) MessageTypes[v] = k
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
  // Skip bytes 8-11 (pair)
  let data = packet.slice(12)

  return [messageCode, data, note]
}

export function craftSubscribe (overrides = {}) {
  let data = {
    id: 'Subscribe',
    clientName: 'UC-Surface',
    clientInternalName: 'ucremoteapp',
    clientType: 'Android',

    clientDescription: 'StudioLive API',  // Name of the client
    clientIdentifier: '133d066a919ea0ea', // ID of the client
    clientOptions: 'perm users levl redu rtan',
    clientEncoding: 23106,
    ...overrides
  }

  return Buffer.concat([
    Buffer.from([0xf2, 0x00, 0x00, 0x00]),
    Buffer.from(JSON.stringify(data, null, ' '))
  ])
}

export function onOffCode (bool) {
  return Buffer.from(bool ? [0x80, 0x3f] : [0x00, 0x00])
}
