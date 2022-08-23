import { EventEmitter } from 'events'

import Discovery from './Discovery'
import type DiscoveryType from './types/DiscoveryType'

import DataClient from './util/DataClient'
import MeterServer from './MeterServer'
import { Channel, ChannelTypes, MessageCode } from './constants'

import {
  analysePacket,
  createPacket
} from './util/MessageProtocol'

import ChannelCount from './types/ChannelCount'
import SubscriptionOptions from './types/SubscriptionOptions'
import ChannelSelector from './types/ChannelSelector'

import * as packetParser from './packetParser'

import { parseChannelString, setCounts } from './util/channelUtil'
import { toShort, toFloat, toBoolean } from './util/bufferUtil'
import { craftSubscribe, unsubscribePacket } from './util/subscriptionUtil'
import CacheProvider from './util/CacheProvider'
import { tokenisePath } from './util/treeUtil'
import { doesLookupMatch } from './util/ValueTransformer'
import { ignorePV } from './util/transformers'
import { logVolumeToLinear, transitionValue } from './util/valueUtil'
import { dumpNode, ZlibNode } from './util/zlib/zlibNodeParser'
import { getZlibValue } from './util/zlib/zlibUtil'
import './util/logging'

// Forward discovery events
const discovery = new Discovery()

type fnCallback<T = any> = (obj: T) => void;
type dataFnCallback<T = any> = (obj: {
  code: any,
  data: T
}) => void;

export declare interface Client {
  on(event: MessageCode, listener: fnCallback): this;
  on(event: 'data', listener: dataFnCallback): this;
  once(event: MessageCode, listener: fnCallback): this;
  once(event: 'data', listener: dataFnCallback): this;
  off(event: MessageCode, listener: fnCallback): this;
  off(event: 'data', listener: dataFnCallback): this;
  addListener(event: MessageCode, listener: fnCallback): this;
  addListener(event: 'data', listener: dataFnCallback): this;
  removeListener(event: MessageCode, listener: fnCallback): this;
  removeListener(event: 'data', listener: dataFnCallback): this;
  removeAllListeners(event: MessageCode): this;
  removeAllListeners(event: 'data'): this;
}

// eslint-disable-next-line no-redeclare
export class Client extends EventEmitter {
  readonly serverHost: string
  readonly serverPort: number

  meteringClient: Awaited<ReturnType<typeof MeterServer>>
  meteringData: any

  channelCounts: ChannelCount

  readonly state: ReturnType<typeof CacheProvider>
  private zlibData?: ZlibNode

  private conn: ReturnType<typeof DataClient>
  private connectPromise: Promise<Client>

  constructor(host: string, port: number = 53000) {
    super()
    if (!host) throw new Error('Host address not supplied')

    this.serverHost = host
    this.serverPort = port

    this.meteringClient = null
    this.meteringData = {}

    this.conn = DataClient(this.handleRecvPacket.bind(this))

    this.state = CacheProvider({
      get: (key) => this.zlibData ? getZlibValue(this.zlibData, key) : null
    })

    this.on(MessageCode.ZLIB, (ZB) => {
      this.zlibData = ZB
    })

    this.on(MessageCode.ParamValue, ({ name, value }) => {
      // Tokenise ahead of time
      name = tokenisePath(name)

      for (const ignoreKey of ignorePV) {
        if (doesLookupMatch(ignoreKey, name)) return
      }

      this.state.set(name, value)
    })

    this.on(MessageCode.ParamString, ({ name, value }) => {
      this.state.set(name, value)
    })

    this.on(MessageCode.FaderPosition, function (MS: { [_ in ChannelTypes]: number[] }) {
      for (const [type, values] of Object.entries(MS)) {
        for (let i = 0; i < values.length; i++) {
          this.state.set(`${Channel[type]}/ch${i + 1}/volume`, values[i])
        }
      }
    })
  }

  /**
   * Extracts the data structure and cache layer
   * @internal
   */
  dumpState(): any {
    return {
      internal: dumpNode(this.zlibData),
      cache: this.state._data.toJSON()
    }
  }

  static async discover(timeout = 10 * 1000) {
    const devices: { [serial: string]: DiscoveryType } = {}
    const func = device => {
      devices[device.serial] = device
    }

    discovery.on('discover', func)
    await discovery.start(timeout)
    discovery.off('discover', func)

    return Object.values(devices)
  }

  /**
   * Subscribe to the metering data
   */
  async meterSubscribe(port?: number) {
    port = port ?? 0
    this.meteringClient = await MeterServer.call(this, port, this.channelCounts, (meterData) => this.emit('meter', meterData))
    this._sendPacket(MessageCode.Hello, toShort(this.meteringClient.address().port), 0x00)
  }

  /**
   * Unsubscribe from the metering data
   */
  meterUnsubscribe() {
    if (!this.meteringClient) return
    this.meteringClient.close()
    this.meteringClient = null
  }

  async connect(subscribeData?: SubscriptionOptions) {
    if (this.connectPromise) return this.connectPromise
    return (this.connectPromise = new Promise((resolve, reject) => {
      const rejectHandler = (err: Error) => {
        this.connectPromise = null
        return reject(err)
      }

      this.conn.once('error', rejectHandler)

      this.conn.connect(this.serverPort, this.serverHost, () => {
        // #region Connection handshake

        const compressedZlibInitCallback = (data) => {
          this.removeListener(MessageCode.Chunk, compressedZlibInitCallback)
          this.emit(MessageCode.ZLIB, data)
        }

        this.addListener(MessageCode.Chunk, compressedZlibInitCallback)

        Promise.all([
          /**
           * Await for the first zlib response to resolve channel counts
           */
          new Promise((resolve) => {
            const zlibInitCallback = () => {
              this.removeListener(MessageCode.ZLIB, zlibInitCallback)

              // ZB is not always encapsulated in the CK packet, so deregister the listener here too
              this.removeListener(MessageCode.Chunk, compressedZlibInitCallback)
              setCounts((this.channelCounts = {
                LINE: Object.keys(this.state.get('line')).length,
                AUX: Object.keys(this.state.get('aux')).length,
                FX /* fxbus == fxreturn */: Object.keys(this.state.get('fxbus')).length,
                FXRETURN: Object.keys(this.state.get('fxreturn')).length,
                RETURN /* aka tape? */: Object.keys(this.state.get('return')).length,
                TALKBACK: Object.keys(this.state.get('talkback')).length,
                MAIN: Object.keys(this.state.get('main')).length,

                // TODO: The 16R doesn't have SUB groups. Check against the 24R / 16
                SUB: Object.keys(this.state.get('sub') ?? {}).length
              }))

              resolve(this)
            }
            this.addListener(MessageCode.ZLIB, zlibInitCallback)
          }),

          /**
           * Await for the subscription success
           */
          new Promise((resolve) => {
            const subscribeCallback = data => {
              if (data.id === 'SubscriptionReply') {
                this.removeListener(MessageCode.JSON, subscribeCallback)
                resolve(this)
              }
            }
            this.addListener(MessageCode.JSON, subscribeCallback)
          })
        ]).then(() => {
          this.conn.removeListener('error', rejectHandler)

          this.emit('connected')
          resolve(this)
        })

        // Send subscription request
        this._sendPacket(MessageCode.JSON, craftSubscribe(subscribeData))
        // #endregion

        // #region Keep alive
        // Send a KeepAlive packet every second
        const keepAliveLoop = setInterval(() => {
          if (this.conn.destroyed) {
            clearInterval(keepAliveLoop)
            return
          }
          this._sendPacket(MessageCode.KeepAlive)
        }, 1000)
        // #endregion
      })
    }))
  }

  async close() {
    this.meterUnsubscribe()
    await this._sendPacket(MessageCode.JSON, unsubscribePacket).then(() => {
      this.conn.destroy()
    })
  }

  /**
   * Analyse, decode and emit packets
   */
  private handleRecvPacket(packet) {
    let [messageCode, data] = analysePacket(packet)
    if (messageCode === null) return

    // Handle message types
    // eslint-disable-next-line
    const handlers: { [k in MessageCode]?: (data) => any } = {
      [MessageCode.JSON]: packetParser.handleJMPacket,
      [MessageCode.ParamValue]: packetParser.handlePVPacket,
      [MessageCode.ParamString]: packetParser.handlePSPacket,
      [MessageCode.ZLIB]: packetParser.handleZBPacket,
      [MessageCode.FaderPosition]: packetParser.handleMSPacket,
      [MessageCode.Chunk]: packetParser.handleCKPacket,
      [MessageCode.DeviceList]: null,
      [MessageCode.Unknown1]: null,
      [MessageCode.Unknown3]: null
    }

    if (Object.prototype.hasOwnProperty.call(handlers, messageCode)) {
      data = handlers[messageCode]?.call?.(this, data)
    } else {
      console.warn('Unhandled message code', messageCode)
    }

    if (!data) return
    this.emit(messageCode, data)
    this.emit('data', { code: messageCode, data })
  }

  sendList(key) {
    this._sendPacket(
      MessageCode.FileRequest,
      Buffer.concat([
        Buffer.from([0x01, 0x00]),
        Buffer.from('List' + key.toString()),
        Buffer.from([0x00, 0x00])
      ])
    )
  }

  /**
   * Send bytes to the console
   */
  private async _sendPacket(...params: Parameters<typeof createPacket>) {
    return new Promise((resolve) => {
      const bytes = createPacket(...params)
      this.conn.write(bytes, null, (resp) => {
        resolve(resp)
      })
    })
  }

  /**
   * Mute a given channel
   */
  mute(selector: ChannelSelector) {
    this.setMute(selector, true)
  }

  /**
   * Unmute a given channel
   */
  unmute(selector: ChannelSelector) {
    this.setMute(selector, false)
  }

  /**
   * Toggle the mute status of a channel
   */
  toggleMute(selector: ChannelSelector) {
    this.setMute(selector, 'toggle')
  }

  /**
   * Set the mute status of a channel
   */
  setMute(selector: ChannelSelector, status: boolean | 'toggle') {
    let targetString = parseChannelString(selector)

    if (selector.mixType) {
      targetString += `/assign_${selector.mixType.toLowerCase()}${selector.mixNumber}`
    } else {
      targetString += '/mute'
    }

    const state: boolean = status === 'toggle' ? !this.state.get(targetString, true) : status

    this._sendPacket(
      MessageCode.ParamValue,
      Buffer.concat([
        Buffer.from(targetString + '\x00\x00\x00'),
        toBoolean(state)
      ])
    )
  }

  setColor(selector: ChannelSelector, hex: string, alpha: number = 0xFF) {
    this._sendPacket(
      MessageCode.ParamColor,
      Buffer.concat([
        Buffer.from(`${parseChannelString(selector)}/color\x00\x00\x00`),
        Buffer.from(hex, 'hex'),
        Buffer.from([alpha])
      ])
    )
  }

  /**
   * For a mono channel, the pan value is the pan value from 0 (hard left) to 100 (hard right)  
   * For a stereo channel, the pan value is the width from 0 to 100 (stereo)
   */
  setPan(selector: ChannelSelector, pan: number) {
    /*
    When channels are grouped
    link = 1
    panlinkstate = 1
    
    initiator
    linkmaster = 1
    */

    let channelString = parseChannelString(selector)

    const isStereo = this.state.get(channelString + '/link')

    if (selector.mixType) {
      switch (selector.mixType) {
        case 'AUX':
        {
          const odd = (selector.mixNumber - 1) | 1
          channelString += `/aux${odd}${odd + 1}_`
          if (this.state.get(`aux.ch${selector.mixNumber}.link`)) {
            channelString += isStereo ? 'stpan' : 'pan'
          } else {
            // No need to pan a mono aux
            return
          }
          break
        }
        default:
          throw new Error('Unexpected mix type')
      }
    } else {
      channelString += '/' + (isStereo ? 'stereopan' : 'pan')
    }

    this._sendPacket(
      MessageCode.ParamValue,
      Buffer.concat([
        Buffer.from(`${channelString}\x00\x00\x00`),
        toFloat(pan / 100)
      ])
    )
  }

  /**
   * @internal By original nature, only an odd numbered channel is targeted (& ~1) 
   */
  setLink(selector: ChannelSelector, link: boolean) {
    this._sendPacket(
      MessageCode.ParamValue,
      Buffer.concat([
        Buffer.from(`${parseChannelString(selector)}/link\x00\x00\x00`),
        toBoolean(link)
      ])
    )
  }

  setColour(...args: Parameters<this['setColor']>) {
    return this.setColor.apply(this, args)
  }

  /**
   * @internal Send a level command to the target
   * targetLevel - [0, 100]
   */
  private _setLevel(this: Client, selector: ChannelSelector, targetLevel, duration: number = 0): Promise<null> {
    let targetString = parseChannelString(selector)

    if (selector.mixType) {
      switch (selector.mixType) {
        case 'AUX':
          targetString += `/${Channel[selector.mixType]}${selector.mixNumber}`
          break
        case 'FX':
          targetString += `/FX${String.fromCharCode(0x40 + selector.mixNumber)}`
          break
        default:
          throw new Error('Unexpected mix type')
      }
    } else {
      targetString += '/volume'
    }

    const assertReturn = () => {
      // Additional time to wait for response
      return new Promise<null>((resolve) => {
        // 0ms timeout - queue event loop
        setTimeout(() => {
          this.state.set(targetString, targetLevel)
          resolve(null)
        }, 0)
      })
    }

    const set = (level) => {
      this._sendPacket(
        MessageCode.ParamValue,
        Buffer.concat([
          Buffer.from(`${targetString}\x00\x00\x00`),
          toFloat(level / 100)
        ])
      )
    }

    if (!duration) {
      set(targetLevel)
      return assertReturn()
    }

    const currentLevel = this.state.get(targetString, 0)

    // Don't do anything if we already are on the same level
    if (currentLevel === targetLevel) {
      return assertReturn()
    }

    return new Promise((resolve) => {
      transitionValue(
        currentLevel,
        targetLevel, duration,
        (v) => set(v),
        async () => {
          resolve(await assertReturn())
        }

      )
    })
  }

  /**
   * Set volume (decibels)
   * 
   * @param channel 
   * @param level range: -84 dB to 10 dB
   */
  async setChannelVolumeLogarithmic(selector: ChannelSelector, decibel: number, duration?: number) {
    return this._setLevel(selector, logVolumeToLinear(decibel), duration)
  }

  /**
   * Set volume (pseudo intensity)
   * 
   * @description Sound is difficult, so this function attempts to provide a "what-you-see-is-what-you-get" interface to control the volume levels.  
   *              `100` Sets the fader to the top (aka +10 dB)  
   *              `72` Sets the fader to unity (aka 0 dB) or a value close enough  
   *              `0` Sets the fader to the bottom (aka -84 dB)
   * @see http://www.sengpielaudio.com/calculator-levelchange.htm
   */
  async setChannelVolumeLinear(selector: ChannelSelector, linearLevel: number, duration?: number) {
    return this._setLevel(selector, linearLevel, duration)
  }

  /**
   * Look at metering data and adjust channel fader so that the level is of a certain loudness
   * NOTE: This is not perceived loudness. Not very practical, but useful in a pinch?
   * 
   * @param channel 
   * @param level 
   * @param duration 
   */
  async normaliseChannelTo(channel, level, duration?: number) {
    // TODO:
  }
}

export default Client
