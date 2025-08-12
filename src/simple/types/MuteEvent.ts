import type Event from './Event'
import type { ChannelSelector } from '@'

export default interface MuteEvent extends Event {
    type: 'mute'
    channel: ChannelSelector
    status: boolean
}
