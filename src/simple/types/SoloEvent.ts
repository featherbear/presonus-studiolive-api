import type Event from './Event'
import type { ChannelSelector } from '@'

export default interface SoloEvent extends Event {
    type: 'solo'
    channel: ChannelSelector
    status: boolean
}
