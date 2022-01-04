import { CHANNELS, CHANNELTYPES } from '../constants'

type ChannelSelector = {
    type: keyof typeof CHANNELTYPES
    channel: CHANNELS.CHANNELS
} | {
    type: 'MAIN' | 'TALKBACK'
    channel?: 1
}

export default ChannelSelector
