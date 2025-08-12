import type Event from './Event'
import type { ChannelSelector } from '@'

export default interface LevelEvent extends Event {
    type: 'level'
    channel: ChannelSelector
    level: number
}
