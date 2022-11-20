import SubscriptionOptions, { _InternalSubscriptionOptions } from '../types/SubscriptionOptions'
import { JSONtoPacketBuffer } from './jsonPacketUtil'

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

  return JSONtoPacketBuffer(data)
}

export const unsubscribePacket = JSONtoPacketBuffer({ id: 'Unsubscribe' })
