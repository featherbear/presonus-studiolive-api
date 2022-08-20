import SubscriptionOptions, { _InternalSubscriptionOptions } from '../types/SubscriptionOptions'
import { toShort } from './bufferUtil'

/**
 * Create subscription packet
 */
export function craftSubscribe(overrides: SubscriptionOptions = {}) {
  const data: _InternalSubscriptionOptions = {
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

  return prependLengthData(
    Buffer.from(JSON.stringify(data, null, ' '))
  )
}

export const unsubscribePacket = prependLengthData(Buffer.from(JSON.stringify({ id: 'Unsubscribe' })))

/**
 * Add length metadata
 * @param buffer 
 * @returns length16LE 0x00 0x00 DATA
 */
function prependLengthData(buffer: Buffer) {
  return Buffer.concat([
    toShort(buffer.length), Buffer.from([0, 0]), // TODO: Perhaps the length can be 32LE 
    buffer
  ])
}
