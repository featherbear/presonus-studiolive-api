import { analysePacket } from './util/MessageProtocol'
import { EventEmitter } from 'events'
import * as dgram from 'dgram'

export interface DiscoveryType {
    name: string,
    serial: string
    ip: string
    port: number
    timestamp: Date
}

export default class extends EventEmitter {
  socket: dgram.Socket

  async start (timeout = null) {
    return new Promise<void>((resolve, reject) => {
      this.stop()
      this.setup()

      if (timeout !== null) {
        setTimeout(() => {
          this.stop()
          resolve()
        }, timeout)
      }
    })
  }

  stop () {
    if (this.socket !== undefined) {
      this.socket.close()
      this.socket = undefined
    }
  }

  private setup () {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    socket.bind(47809, '0.0.0.0')

    socket.on('listening', function () {
      this.setBroadcast(true)
    })

    socket.on('message', (packet, rinfo) => {
      const [code, data] = analysePacket(packet, true)
      if (code === null) {
        return
      }

      const fragments = []
      for (
        let payload = data.slice(20), cur = 0, f;
        cur < payload.length;
        cur += f.length + 1
      ) {
        fragments.push(
          (f = payload.slice(cur, payload.indexOf('\x00', cur))).toString()
        )
      }

      // eslint-disable-next-line
      const [nameA, _, serial, nameB] = fragments
      
      // nameA: Model number for device image identification
      // nameB: ???
      this.emit('discover', {
        name: nameA,
        serial,
        ip: rinfo.address,
        port: rinfo.port,
        timestamp: new Date()
      } as DiscoveryType)
    })

    this.socket = socket
  }
}
