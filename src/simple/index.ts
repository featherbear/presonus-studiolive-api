import StudioLiveAPI, {
  ChannelSelector,
  Channel,
  MessageCode
} from '@'
import type { ChannelTypes } from '@'

import LevelEvent from './types/LevelEvent'
import MuteEvent from './types/MuteEvent'
import SoloEvent from './types/SoloEvent'

export * from '@'

type CallbackWithData<T> = (data: T) => any;

const channelLookup = Object.entries(Channel).reduce(
  (obj, [key, val]) => ({ ...obj, [val]: key }),
  {}
)

export function settingsPathToChannelSelector(
  path: string | string[]
): ChannelSelector {
  if (!Array.isArray(path)) path = path.split('/')

  let [type, channel] = path

  type = channelLookup[type]
  if (!type) {
    console.warn('Could not resolve type lookup for', path)
    return null
  }

  channel = /(\d+)$/.exec(channel)[1]

  return {
    type: <ChannelTypes>type,
    channel: Number.parseInt(channel)
  }
}
type ExtendedEvents<T> = StudioLiveAPI['on'] & {
  (event: 'level', listener: CallbackWithData<LevelEvent>): T;
  (event: 'mute', listener: CallbackWithData<MuteEvent>): T;
  (event: 'solo', listener: CallbackWithData<SoloEvent>): T;
  (event, listener: CallbackWithData<any>): T;
};

declare interface Client extends StudioLiveAPI {
  on: ExtendedEvents<this>;
  addListener: ExtendedEvents<this>;
  once: ExtendedEvents<this>;
  off: ExtendedEvents<this>;
  removeListener: ExtendedEvents<this>;
}

// eslint-disable-next-line no-redeclare
class Client extends StudioLiveAPI {
  #MS_last: {};

  constructor(...args: ConstructorParameters<typeof StudioLiveAPI>) {
    super(...args)
    this.#MS_last = {}

    this.on(MessageCode.FaderPosition, (MS: { [s: string]: number[] }) => {
      // For each channel type
      for (const [type, values] of Object.entries(MS)) {
        // For each channel of a given type
        for (let idx = 0; idx < values.length; idx++) {
          // Store the new value
          const newValue = values[idx]

          // Check if stored value is different to the new value
          if (this.#MS_last?.[type]?.[idx] !== newValue) {
            this.emit('level', {
              channel: {
                type: type,
                channel: idx + 1 // idx count starts from zero, but channels are one-based
              },
              level: newValue,
              type: 'level'
            } as LevelEvent)
          }
        }
      }

      this.#MS_last = MS
    })

    this.on(MessageCode.ParamValue, (PV) => {
      let { name, value } = PV
      name = name.split('/')
      const trailingToken: string = name[name.length - 1]

      if (value instanceof Buffer) {
        const read = value.readFloatLE()
        console.log(PV.name, value, read)
      } else {
        console.log(PV.name, value)
      }

      switch (trailingToken) {
        case 'mute': {
          const selector = settingsPathToChannelSelector(name)
          if (!selector) return

          this.emit('mute', {
            channel: selector,
            status: value,
            type: 'mute'
          } as MuteEvent)
          return
        }

        case 'solo': {
          const selector = settingsPathToChannelSelector(name)
          if (!selector) return

          this.emit('solo', {
            channel: selector,
            status: value,
            type: 'solo'
          } as SoloEvent)
          return
        }
      }

      if (trailingToken.startsWith('assign_')) {
        const selector = settingsPathToChannelSelector(name)
        if (!selector) return

        const [, type, channel] = /assign_(\w+)(\d+)$/.exec(trailingToken)
        selector.mixType = channelLookup[type] ?? type.toUpperCase()
        selector.mixNumber = Number.parseInt(channel)

        this.emit('mute', {
          channel: selector,
          status: value,
          type: 'mute'
        } as MuteEvent)
      }

      if (trailingToken.startsWith('aux')) {
        if (name.includes('dca')) {
          // TODO: reason?
          return
        }

        const selector = settingsPathToChannelSelector(name)
        if (!selector) return

        const propertyToken = /(\w+)(\d+)(?:_(\w+))?$/.exec(trailingToken)

        if (!propertyToken) {
          console.log({
            channel: selector,
            value: value,
            type: trailingToken
          })
          this.emit('propertyChange', {
            channel: selector,
            value: value,
            type: trailingToken
          })
          return
        }

        let [, type, channel, property] = propertyToken

        selector.mixType = channelLookup[type]
        selector.mixNumber = Number.parseInt(channel)

        if (!property) {
          property = 'level'
        }

        this.emit(property, {
          channel: selector,
          level: value,
          type: property
        } as LevelEvent)
      }

      if (trailingToken.startsWith('FX')) {
        if (name.includes('dca')) return

        const selector = settingsPathToChannelSelector(name)
        if (!selector) return

        const [, type, channel] = /(\w+)(\w)$/.exec(trailingToken)
        selector.mixType = channelLookup[type] ?? type.toUpperCase()
        selector.mixNumber = channel.charCodeAt(0) - 0x40

        this.emit('level', {
          channel: selector,
          level: value,
          type: 'level'
        } as LevelEvent)
      }
    })
  }

  connect(...args: Parameters<StudioLiveAPI['connect']>) {
    return super
      .connect(...args)
      .then(() => {
        // Slightly nudge a fader in order to receive the MS packet

        // TODO: do we get all values?
        const shouldGetMS = false

        if (shouldGetMS) {
          const volume: number = this.state.get('fxbus.ch1.volume')
          if (volume === null) { throw new Error('Unexpected mixer state during setup') }
          const newVolume = volume + 0.01 * (volume === 0 ? 1 : -1)
          this.setChannelVolumeLinear(
            {
              type: 'FX',
              channel: 1
            },
            newVolume
          )

          // Set the volume back
          this.setChannelVolumeLinear(
            {
              type: 'FX',
              channel: 1
            },
            volume
          )
        }
      })
      .then(() => this)
  }
}

export default Client
