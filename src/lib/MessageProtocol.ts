import { PacketHeader } from './constants'

export function analysePacket(
  packet /* Buffer */,
  ignoreLengthMismatch = false
) {
  if (!PacketHeader.matches(packet)) {
    console.warn('Ignoring irrelevant packet', packet)
    return [null, null]
  }

  const note = false
  const payloadLength = packet.slice(4, 6).readUInt16LE()
  if (payloadLength + 6 !== packet.length) {
    if (!ignoreLengthMismatch) {
      console.warn(
        `Packet is meant to be ${payloadLength +
        6} bytes long, but is actually ${packet.length} bytes long`
      )
      return [null, null]
    }
  }

  const messageCode = packet.slice(6, 8).toString()
  // Skip bytes 8-11 (pair)
  const data = packet.slice(12)

  return [messageCode, data, note]
}

export interface SubscriptionOptions {
  /**
   * Application name
   */
  clientName?: string

  /**
   * Application internal name
   */
  clientInternalName?: string

  /**
   * Device name
   */
  clientDescription?: string // Name

  /**
   * Device ID
   */
  clientIdentifier?: string

  /**
   * ???
   */
  clientOptions?: string
}

export function craftSubscribe(overrides: SubscriptionOptions = {}) {
  const data = {
    id: 'Subscribe',
    clientName: 'UC-Surface',
    clientInternalName: 'ucremoteapp',
    clientType: 'StudioLive API',

    clientDescription: 'User', // Name of the client
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
