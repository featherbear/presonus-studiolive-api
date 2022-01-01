import { EventEmitter } from 'events'

import Discovery from './Discovery'
import type DiscoveryType from './types/DiscoveryType'

import DataClient from './util/DataClient'
import MeterServer from './MeterServer'
import { ACTIONS, CHANNELS, MESSAGETYPES, CHANNELTYPES } from './constants'

import KVTree from './util/KVTree'

import {
  analysePacket,
  createPacket
} from './util/MessageProtocol'

import { parseChannelString } from './util/channelUtil'
import { intToLE, shortToLE } from './util/bufferUtil'

import handleZBPacket from './packetParser/ZB'
import handleJMPacket from './packetParser/JM'
import handlePVPacket from './packetParser/PV'

import SubscriptionOptions from './types/SubscriptionOptions'
import { craftSubscribe, unsubscribePacket } from './util/subscriptionUtil'
import handleMSPacket from './packetParser/MS'
import CacheProvider from './util/CacheProvider'
import { ZlibNode } from './util/zlib/zlibNodeParser'
import { getZlibValue } from './util/zlib/zlibUtil'
import { dBto32, onOff } from './util/valueUtil'

// Forward discovery events
const discovery = new Discovery()

type fnCallback<T = any> = (obj: T) => void;
type dataFnCallback<T = any> = (obj: {
  code: any,
  data: T
}) => void;

export declare interface Client {
  on(event: MESSAGETYPES, listener: fnCallback): this;
  on(event: 'data', listener: dataFnCallback): this;
  once(event: MESSAGETYPES, listener: fnCallback): this;
  once(event: 'data', listener: dataFnCallback): this;
  off(event: MESSAGETYPES, listener: fnCallback): this;
  off(event: 'data', listener: dataFnCallback): this;
  addListener(event: MESSAGETYPES, listener: fnCallback): this;
  addListener(event: 'data', listener: dataFnCallback): this;
  removeListener(event: MESSAGETYPES, listener: fnCallback): this;
  removeListener(event: 'data', listener: dataFnCallback): this;
  removeAllListeners(event: MESSAGETYPES): this;
  removeAllListeners(event: 'data'): this;
}

// TODO: FIX
/* eslint no-redeclare: "off" */
export class Client extends EventEmitter {
  serverHost: string
  serverPort: number
  serverPortUDP: number

  discovery: Discovery

  meterListener: any
  metering: any

  state: ReturnType<typeof CacheProvider>
  private zlibData?: ZlibNode

  private conn: ReturnType<typeof DataClient>
  private connectPromise: Promise<Client>

  constructor(host: string, port: number = 53000) {
    super()
    if (!host) throw new Error('Host address not supplied')
    this.serverHost = host
    this.serverPort = port

    this.serverPortUDP = 52704
    this.meterListener = null
    this.metering = {}

    this.conn = DataClient(this.handleRecvPacket.bind(this))

    this.state = CacheProvider({
      get: (key) => this.zlibData ? getZlibValue(this.zlibData, key) : null
    })

    this.on(MESSAGETYPES.ZLIB, (ZB) => {
      this.zlibData = ZB
    })

    this.on(MESSAGETYPES.Setting, ({ name, value }) => {
      this.state.set(name, value)
    })
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

  meterSubscribe(port) {
    port = port || this.serverPortUDP
    this.meterListener = MeterServer.call(this, port)
    this.sendPacket(MESSAGETYPES.Hello, shortToLE(port), 0x00)
  }

  meterUnsubscribe() {
    if (!this.meterListener) return
    this.meterListener.close()
    this.meterListener = null
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
        {
          // Send subscription request
          this.sendPacket(MESSAGETYPES.JSON, craftSubscribe(subscribeData))

          const subscribeCallback = data => {
            if (data.id === 'SubscriptionReply') {
              this.removeListener(MESSAGETYPES.JSON, subscribeCallback)
              this.conn.removeListener('error', rejectHandler)
              this.emit('connected')
              resolve(this)
            }
          }
          this.on(MESSAGETYPES.JSON, subscribeCallback)
        }
        // #endregion

        // #region Keep alive
        // Send a KeepAlive packet every second
        const keepAliveLoop = setInterval(() => {
          if (this.conn.destroyed) {
            clearInterval(keepAliveLoop)
            return
          }
          this.sendPacket(MESSAGETYPES.KeepAlive)
        }, 1000)
        // #endregion
      })
    }))
  }

  /**
   * Analyse, decode and emit packets
   */
  private handleRecvPacket(packet) {
    let [messageCode, data] = analysePacket(packet)
    if (messageCode === null) return

    // Handle message types
    // eslint-disable-next-line
    const handlers: { [k in MESSAGETYPES]?: (data) => any } = {
      [MESSAGETYPES.JSON]: handleJMPacket,
      [MESSAGETYPES.Setting]: handlePVPacket,
      [MESSAGETYPES.ZLIB]: handleZBPacket,
      [MESSAGETYPES.FaderPosition]: handleMSPacket,
      [MESSAGETYPES.DeviceList]: null,
      [MESSAGETYPES.Unknown1]: null,
      [MESSAGETYPES.Unknown3]: null
    }

    if (Object.prototype.hasOwnProperty.call(handlers, messageCode)) {
      data = handlers[messageCode]?.(data) ?? data
    } else {
      console.warn('Unhandled message code', messageCode)
    }

    this.emit(messageCode, data)
    this.emit('data', { code: messageCode, data })
  }

  sendList(key) {
    this.sendPacket(
      MESSAGETYPES.FileResource,
      Buffer.concat([
        Buffer.from([0x01, 0x00]),
        Buffer.from('List' + key.toString()),
        Buffer.from([0x00, 0x00])
      ])
    )
  }

  private async sendPacket(...params: Parameters<typeof createPacket>) {
    return new Promise((resolve) => {
      const bytes = createPacket(...params)
      this.conn.write(bytes, null, (resp) => {
        resolve(resp)
      })
    })
  }

  private setMuteState(raw: string, state) {
    this.sendPacket(
      MESSAGETYPES.Setting,
      Buffer.concat([
        Buffer.from(`${raw}/${ACTIONS.MUTE}\x00\x00\x00`),
        onOff.encode(state)
      ])
    )
  }

  private setLevel(raw: string, level) {
    this.sendPacket(
      MESSAGETYPES.Setting,
      Buffer.concat([
        Buffer.from(`${raw}/${ACTIONS.VOLUME}\x00\x00\x00`),
        intToLE(level)
      ])
    )
  }

  /**
   * Mute a given channel
   * @param type Channel type
   * @param channel Channel number of type - channel is optional for MAIN and TALKBACK
   */
  mute(type: keyof typeof CHANNELTYPES, channel: CHANNELS.CHANNELS);
  mute(type: 'MAIN' | 'TALKBACK');
  mute(type, channel: CHANNELS.CHANNELS = 0) {
    if (['MAIN', 'TALKBACK'].includes(type)) channel = 1
    const target = parseChannelString(type, channel)
    this.setMuteState(target, true)
  }

  unmute(type: keyof typeof CHANNELTYPES, channel: CHANNELS.CHANNELS);
  unmute(type: 'MAIN' | 'TALKBACK');
  unmute(type, channel: CHANNELS.CHANNELS = 0) {
    if (['MAIN', 'TALKBACK'].includes(type)) channel = 1
    const target = parseChannelString(type, channel)
    this.setMuteState(target, false)
  }

  // muteFade

  // unmuteFade

  toggleMute(type: keyof typeof CHANNELTYPES, channel: CHANNELS.CHANNELS);
  toggleMute(type: 'MAIN' | 'TALKBACK');
  toggleMute(type, channel: CHANNELS.CHANNELS = 0) {
    if (['MAIN', 'TALKBACK'].includes(type)) channel = 1
    const target = parseChannelString(type, channel)
    const currentState = this.state.get(`${target}/${ACTIONS.MUTE}`)
    this.setMuteState(target, !currentState)
  }

  async close() {
    this.meterUnsubscribe()
    await this.sendPacket(MESSAGETYPES.JSON, unsubscribePacket).then(() => {
      this.conn.destroy()
      // console.log('Disconnected')
    })
  }

  /**
   * Set volume (decibels)
   * 
   * @param channel 
   * @param level -84 to 10
   */
  setChannelDb(type: keyof typeof CHANNELTYPES, channel: CHANNELS.CHANNELS, level: number) {
    if (['MAIN', 'TALKBACK'].includes(type)) channel = 1
    const target = parseChannelString(type, channel)
    this.setLevel(target, dBto32(level))
  }

  async setChannelLinear(channel, level) {
    
  }

  /**
  * Adjust volume over time
  * 
  * @param channel 
  * @param level 
  * @param duration 
  */
  async fadeChannelTo(channel, level, duration?: number) {

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

  }
}

export default Client
