import { ChannelTypes } from '../constants'

type ChannelSelector = {
    type: ChannelTypes
    channel: number
} | {
    type: 'MAIN' | 'TALKBACK'
    channel?: 1
}

export default ChannelSelector
