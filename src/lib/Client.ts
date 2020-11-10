import { EventEmitter } from 'events'

import Discovery from './Discovery'
import DataClient from './DataClient'
import MeterServer from './MeterServer'
import { ACTIONS, CHANNELS, MessageTypes, PacketHeader, CByte } from './constants'

import {
  analysePacket,
  craftSubscribe,
  onOffCode,
  onOffEval
} from './MessageProtocol'

import { shortToLE } from './util'
import KVTree from './KVTree'

export default class Client extends EventEmitter {
  serverHost: string
  serverPort: number
  serverPortUDP: number
  discovery: Discovery
  state: KVTree

  conn: any
  meterListener: any
  metering: any

  constructor (host: string, port: number = 53000) {
    super()
    if (!host) throw new Error('Host address not supplied')
    this.serverHost = host
    this.serverPort = port

    this.serverPortUDP = 52704
    this.meterListener = null
    this.metering = {}

    // Forward discovery events
    this.discovery = new Discovery()
    this.discovery.on('discover', data => this.emit('discover', data))

    this.conn = DataClient(this.handleRecvPacket.bind(this))

    this.state = new KVTree()
  }

  async discover (timeout = 10 * 1000) {
    const devices = {}
    const func = device => {
      devices[device.serial] = device
    }

    this.discovery.on('discover', func)
    await this.discoverySubscribe(timeout)
    this.discovery.off('discover', func)

    return Object.values(devices)
  }

  async discoverySubscribe (timeout = null) {
    return this.discovery.start(timeout)
  }

  discoveryUnsubscribe () {
    this.discovery.stop()
  }

  meterSubscribe (port) {
    port = port || this.serverPortUDP
    this.meterListener = MeterServer(port)
    this.sendPacket(MessageTypes.Hello, shortToLE(port), 0x00)
  }

  meterUnsubscribe () {
    if (!this.meterListener) return
    this.meterListener.close()
    this.meterListener = null
  }

  async connect (subscribeData = undefined) {
    return new Promise((resolve, reject) => {
      this.conn.once('error', reject)

      this.conn.connect(this.serverPort, this.serverHost, () => {
        // Send control subscribe request
        this.sendPacket(MessageTypes.JSON, craftSubscribe(subscribeData))

        const subscribeCallback = data => {
          if (data.id === 'SubscriptionReply') {
            this.removeListener(MessageTypes.JSON, subscribeCallback)
            this.conn.removeListener('error', reject)
            resolve(this)
            this.emit('connected')
          }
        }
        this.on(MessageTypes.JSON, subscribeCallback)

        this.on(MessageTypes.Setting, ({ name, value }) => {
          this.state.register(name, value)
          // console.log(JSON.stringify(this.state, undefined, 2))
        })

        // Send a KeepAlive packet every second
        const keepAliveFn = () => {
          if (this.conn.destroyed) {
            clearInterval(keepAliveLoop)
            return
          }
          this.sendPacket(MessageTypes.KeepAlive)
        }
        const keepAliveLoop = setInterval(keepAliveFn, 1000)
      })
    })
  }

  private handleRecvPacket (packet) {
    let [messageCode, data] = analysePacket(packet)
    if (messageCode === null) {
      return
    }

    if (!Object.values(MessageTypes).includes(messageCode)) {
      console.log('Unhandled message code', messageCode)
    }

    switch (messageCode) {
      case MessageTypes.JSON:
        data = JSON.parse(data.slice(4))
        break
      case MessageTypes.Setting: {
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
          }
        }
        break
      }
    }

    if (data instanceof Buffer) {
      data = { data }
    }

    this.emit('data', { code: messageCode, ...data })
    this.emit(messageCode, data)
  }

  sendList (key) {
    this.sendPacket(
      MessageTypes.FileResource,
      Buffer.concat([
        Buffer.from([0x01, 0x00]),
        Buffer.from('List' + key.toString()),
        Buffer.from([0x00, 0x00])
      ])
    )
  }

  private sendPacket (messageCode: Buffer | string, data?: Buffer | string, customA?: any, customB?: any) {
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

  setMuteState (channel: CHANNELS, state) {
    this.sendPacket(
      MessageTypes.Setting,
      Buffer.concat([
        Buffer.from(`${channel}/${ACTIONS.MUTE}\x00\x00\x00`),
        onOffCode(state)
      ])
    )
  }

  mute (channel: CHANNELS) {
    this.setMuteState(channel, true)
  }

  unmute (channel: CHANNELS) {
    this.setMuteState(channel, false)
  }

  // toggleMuteState (channel: CHANNELS) {
    
  // }

  /* IDEA: Force get channel state 
    If we are unable to figure out how to get initial channel data
    then we could do a hackish method to query the information.

    A. Send an unmute command and see if there is a response (Will be unmuted regardless now)
    * If there is a unmute event, then we know that the channel was originally muted
      * Then send a mute event
    * If there was no unmute event, then we know the channel was already unmuted
    
    B. Send a mute command and see if there is a response (Will be muted regardless now)
    * If there is a mute event, then we know that the channel was originally unmuted
      * Then send an unmute event
    * If there was no mute event, then we know that the channel was already muted
    
    C. Some commands cause a list of channel mute statuses to be send (TODO: Add the event code here).
    * Send that command 

  */

  close () {
    this.discoveryUnsubscribe()
    this.meterUnsubscribe()
    this.conn.destroy()
    // TODO: Send unsubscribe
  }
}
