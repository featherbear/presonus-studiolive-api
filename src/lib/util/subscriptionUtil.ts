import SubscriptionOptions, { _InternalSubscriptionOptions } from '../types/SubscriptionOptions'

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

  return Buffer.concat([
    Buffer.from([0xf2, 0x00, 0x00, 0x00]),
    Buffer.from(JSON.stringify(data, null, ' '))
  ])
}
