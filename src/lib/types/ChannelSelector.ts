import { ChannelTypes } from '../constants'

type MixSelector = {
    mixType: ChannelTypes & ('AUX' | 'FX')
    mixNumber: number
}

type ChannelSelector = ({
    type: ChannelTypes
    channel: number
} | {
    type: 'MAIN' | 'TALKBACK'
    channel?: 1
}) & (MixSelector | {[_ in keyof MixSelector]?: never})

export default ChannelSelector
