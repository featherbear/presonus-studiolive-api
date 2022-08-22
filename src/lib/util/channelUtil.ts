import { Channel } from '../constants'
import ChannelCount from '../types/ChannelCount'
import ChannelSelector from '../types/ChannelSelector'

let counts: ChannelCount;

export function setCounts(channelCount: ChannelCount) {
  counts = channelCount
}

export function parseChannelString(
  selector: ChannelSelector
) {
  let { type, channel } = selector
  let { mixType, mixNumber } = selector

  if (counts && mixType) {
    if (!mixNumber || mixNumber < 1) {
      throw new Error('Invalid mix channel provided')
    }

    switch (mixType) {
      case 'AUX':
      case 'FX':
        if (!(mixNumber <= counts[mixType])) throw new Error('Invalid mix channel provided')
        break
      default:
        throw new Error('Invalid mix type provided')
    }
  }




  // `type` must be a valid enum key
  if (!Object.keys(Channel).includes(type)) {
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

    // `channel` must also be less than the known maximum (if a max is provided)
    (counts && !(counts[type] && counts[type] > channel))
  ) {
    throw new Error('Invalid channel provided')
  }

  return `${Channel[type]}/ch${channel}`
}
