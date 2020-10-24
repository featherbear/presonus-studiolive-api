import net from 'net'
import dgram from 'dgram'
import EventEmitter from 'events'

import Discovery from './Discovery'
import DataClient from './DataClient'
import MeterServer from './MeterServer'
import {
  MessageTypes,
  analysePacket,
  craftSubscribe,
  onOffCode
} from './MessageProtocol'
import { shortToLE } from './util'
import { PacketHeader, CByte } from './constants'

export default class Client extends EventEmitter {
  constructor (host, port) {
    super()
    this.serverHost = host
    this.serverPort = port

    this._UdpServerPort = 52704
    this.meterListener = null
    this.metering = {}

    // Forward discovery events
    this.discovery = new Discovery()
    this.discovery.on('discover', data => this.emit('discover', data))

    this.conn = DataClient(this._handleRecvPacket.bind(this))
  }

  async discover (timeout = 10 * 1000) {
    let devices = {}
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
    throw new Error('Unimplemented')
    this.meterListener = MeterServer(port)

    this._sendPacket(MessageTypes.Hello, shortToLE(port), 0x00)
  }

  meterUnsubscribe () {
    throw new Error('Unimplemented')

    if (!this.meterListener) throw Error("Meter server hasn't started yet")
    this.meterListener.close()
    this.meterListener = null
  }

  async connect () {
    {
      return new Promise((resolve, reject) => {
        this.conn.connect(this.serverPort, this.serverHost, () => {
          // Send control subscribe request
          this._sendPacket(MessageTypes.JSON, craftSubscribe())

          // this.sendList('presets/scene')

          // Send a KeepAlive packet every second
          setInterval(() => {
            this._sendPacket(MessageTypes.KeepAlive)
          }, 1000)

          resolve(this) // FIXME: Resolve when subscription received
          this.emit('connected')
        })
      })
    }
  }

  _handleRecvPacket (packet) {
    let [messageCode, data] = analysePacket(packet)
    if (messageCode === null) {
      return
    }

    if (!messageCode in MessageTypes) {
      console.log('Unhandled message code', messageCode)
    }

    if (messageCode == MessageTypes.JSON) {
      data = JSON.parse(data.slice(4))
    }

    this.emit('data', data)
    this.emit(messageCode, data)
  }

  sendList (key) {
    this._sendPacket(
      MessageTypes.FileResource,
      Buffer.concat([
        Buffer.from([0x01, 0x00]),
        Buffer.from('List' + key.toString()),
        Buffer.from([0x00, 0x00])
      ])
    )
  }

  _sendPacket (messageCode, data, customA, customB) {
    if (!data) data = Buffer.allocUnsafe(0)
    let connIdentity = Buffer.from([
      customA || CByte.A,
      0x00,
      customB || CByte.B,
      0x00
    ])
    if (connIdentity.length != 4) throw Error('connIdentity')

    let lengthLE = shortToLE(
      messageCode.length + connIdentity.length + data.length
    )
    if (lengthLE.length != 2) throw Error('lengthLE')

    let b = Buffer.alloc(
      PacketHeader.length +
        lengthLE.length +
        messageCode.length +
        connIdentity.length +
        data.length
    )

    let cursor = 0
    b.fill(PacketHeader)
    b.fill(lengthLE, (cursor += PacketHeader.length))
    b.write(messageCode, (cursor += lengthLE.length))
    b.fill(connIdentity, (cursor += messageCode.length))

    if (typeof data === 'string') b.write(data, (cursor += connIdentity.length))
    else b.fill(data, (cursor += connIdentity.length))

    this.conn.write(b)
  }

  setMuteState (ch, state) {
    this._sendPacket(
      MessageTypes.Setting,
      Buffer.concat([
        Buffer.from(`line/ch${ch}/mute\x00\x00\x00\x00\x00`),
        onOffCode(state)
      ])
    )
  }

  mute (ch) {
    this.setMuteState(ch, true)
  }

  unmute (ch) {
    this.setMuteState(ch, false)
  }
}
