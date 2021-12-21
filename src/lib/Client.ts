import { EventEmitter } from 'events'

import Discovery from './Discovery'
import type { DiscoveryType } from './Discovery'

import DataClient from './DataClient'
import MeterServer from './MeterServer'
import { ACTIONS, CHANNELS, MESSAGETYPES, PacketHeader, CByte, CHANNELTYPES } from './constants'
import zlib from 'zlib'

import {
  analysePacket,
  craftSubscribe,
  onOffCode,
  onOffEval,
  SubscriptionOptions
} from './MessageProtocol'

import { parseChannelString, shortToLE } from './util'
import KVTree from './KVTree'
import zlibParser from './zlib'
import { SettingType } from './types/settingType'

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
  state: KVTree

  conn: any
  meterListener: any
  metering: any

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

    this.state = new KVTree()
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
        // Send control subscribe request
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

        this.on(MESSAGETYPES.Setting, ({ name, value }) => {
          this.state.register(name, value)
          // console.log(JSON.stringify(this.state, undefined, 2))
        })

        // Send a KeepAlive packet every second
        const keepAliveFn = () => {
          if (this.conn.destroyed) {
            clearInterval(keepAliveLoop)
            return
          }
          this.sendPacket(MESSAGETYPES.KeepAlive)
        }
        const keepAliveLoop = setInterval(keepAliveFn, 1000)
      })
    }))
  }

  private handleRecvPacket(packet) {
    let [messageCode, data] = analysePacket(packet)
    if (messageCode === null) {
      return
    }

    if (!Object.values(MESSAGETYPES).includes(messageCode)) {
      console.log('Unhandled message code', messageCode)
    }

    switch (messageCode) {
      case MESSAGETYPES.JSON:
        data = JSON.parse(data.slice(4))
        break
      case MESSAGETYPES.Setting: {
        const idx = data.indexOf(0x00) // Find the NULL terminator of the key string
        if (idx !== -1) {
          const key = data.slice(0, idx).toString()

          // Most setting packets are `key\x00\x00\x00...`
          // but some (i.e. filter groups) have `key\x00\x00\x01`
          const partA = data.slice(idx + 1, idx + 3 /* 1+2 */)
          const partB = data.slice(idx + 3)
          data = {
            name: key,
            value: partB.length ? onOffEval(partB) : partA
          } as SettingType
        }
        break
      }
      case MESSAGETYPES.ZLIB: {
        data = zlibParser(zlib.inflateSync(data.slice(4)))
        break
      }
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

  private sendPacket(messageCode: Buffer | string, data?: Buffer | string, customA?: any, customB?: any) {
    if (!data) data = Buffer.allocUnsafe(0)
    const connIdentity = Buffer.from([
      customA || CByte.A,
      0x00,
      customB || CByte.B,
      0x00
    ])
    if (connIdentity.length !== 4) throw Error('connIdentity')

    const lengthLE = shortToLE(
      messageCode.length + connIdentity.length + data.length
    )
    if (lengthLE.length !== 2) throw Error('lengthLE')

    const b = Buffer.alloc(
      PacketHeader.length +
      lengthLE.length +
      messageCode.length +
      connIdentity.length +
      data.length
    )

    let cursor = 0
    b.fill(PacketHeader)
    b.fill(lengthLE, (cursor += PacketHeader.length))
    b.write(messageCode instanceof Buffer ? messageCode.toString() : messageCode, (cursor += lengthLE.length))
    b.fill(connIdentity, (cursor += messageCode.length))

    if (typeof data === 'string') b.write(data, (cursor += connIdentity.length))
    else b.fill(data, (cursor += connIdentity.length))

    this.conn.write(b)
  }

  private setMuteState(raw: string, state) {
    this.sendPacket(
      MESSAGETYPES.Setting,
      Buffer.concat([
        Buffer.from(`${raw}/${ACTIONS.MUTE}\x00\x00\x00`),
        onOffCode(state)
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

  // toggleMuteState (channel: Channels) {

  // }

  close() {
    this.meterUnsubscribe()
    this.conn.destroy()
    // TODO: Send unsubscribe
  }

  /**
   * Set volume
   * 
   * @param channel 
   * @param level 
   */
  async setChannelTo(channel, level) {

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
