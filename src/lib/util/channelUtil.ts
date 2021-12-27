import { CHANNELS, CHANNELTYPES } from '../constants'

export function parseChannelString(
  type: keyof typeof CHANNELTYPES,
  channel: CHANNELS.CHANNELS
) {
  // `type` must be a valid enum key
  if (!Object.keys(CHANNELTYPES).includes(type as CHANNELTYPES)) {
    throw new Error('Invalid channel type provided')
  }

  if (
    // `channel` must be a whole number larger than zero
    !(Math.trunc(channel) > 0) ||
    (channel !== (channel = Math.trunc(channel))) ||

    // `channel` must also exist for a given `type`
    !Object.values(CHANNELS[type]).includes(channel)
  ) {
    throw new Error('Invalid channel provided')
  }

  return `${CHANNELTYPES[type]}/ch${channel}`
}
