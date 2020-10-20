import { PacketHeader } from './constants'
import { analysePacket } from './MessageProtocol'
import { EventEmitter } from 'events'
import dgram from 'dgram'

export default class extends EventEmitter {
  start (timeout = null) {
    this.stop()
    this._setup()

    if (timeout !== null) {
      this.setTimeout(this.stop, timeout)
    }
  }

  stop () {
    if (this.socket !== null) {
      this.socket.close()
      this.socket = null
    }
  }

  _setup () {
    let socket = dgram.createSocket('udp4')
    socket.bind(47809, '0.0.0.0')

    socket.on('listening', function () {
      socket.setBroadcast(true)
    })

    socket.on('message', function (packet, rinfo) {
      let [code, data] = analysePacket(packet, true)
      if (code === null) {
        return
      }

      let fragments = []
      for (
        let payload = data.slice(24), cur = 0, f;
        cur < payload.length;
        cur += f.length + 1
      ) {
        fragments.push(
          (f = payload.slice(cur, payload.indexOf('\x00', cur))).toString()
        )
      }

      const [nameA, _, serial, nameB] = fragments

      this.emit('discover', {
        name: nameA /* TODO: Figure out the difference between nameA and nameB */,
        serial,
        ip: rinfo.address,
        port: rinfo.port
      })
    })

    this.socket = socket
  }
}
