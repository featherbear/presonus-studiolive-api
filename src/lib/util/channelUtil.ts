import { CHANNELS, CHANNELTYPES } from '../constants'
import ChannelSelector from '../types/ChannelSelector'

export function parseChannelString(
  selector: ChannelSelector
) {
  let { type, channel } = selector

  // `type` must be a valid enum key
  if (!Object.keys(CHANNELTYPES).includes(type)) {
    throw new Error('Invalid channel type provided')
  }

  if (['MAIN', 'TALKBACK'].includes(type)) {
    // Force channel = 1 for main and talkback channels
    channel = 1
  }

  if (
    // `channel` must be a whole number larger than zero
    !(Math.trunc(channel) > 0) ||
    (channel != (channel = Math.trunc(channel))) || // eslint-disable-line eqeqeq

    // `channel` must also exist for a given `type`
    !Object.values(CHANNELS[type]).includes(channel)
  ) {
    throw new Error('Invalid channel provided')
  }

  return `${CHANNELTYPES[type]}/ch${channel}`
}
