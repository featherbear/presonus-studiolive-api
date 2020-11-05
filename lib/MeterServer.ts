/* Metering server */

// The console establishes a UDP connection to the computer, and sends over metering data
// Current status: BROKEN

import * as dgram from 'dgram'
import { PacketHeader } from './constants'

let instanceCount = 0

export default function (port) {
  if (typeof port !== 'number' || port <= 0 || port > 65535) {
    throw Error('Invalid port number')
  }

  console.log(instanceCount);
  if (instanceCount++ > 0) {
    throw Error('Meter server is already running')
  }

  // Create UDP Server to listen to metering data
  let UDPserver = dgram.createSocket('udp4')
  const emitter = this || UDPserver

  UDPserver.on('error', err => {
    UDPserver.close()
    throw Error('Meter server error: ' + err.stack)
  })

  UDPserver.on('message', (msg, rinfo) => {
    let data = Buffer.from(msg)

    if (
      !data.slice(0, 4).equals(PacketHeader) ||
      data.slice(6, 8).toString() != 'MS'
    ) {
      console.warn('Ignoring irrelevant packet')
      return
    }

    // var length = data.slice(4, 6); // length is given as cf08 = 53000, but the payload is only 1041 long
    // var conn = data.slice(8, 12);

    var text = data.slice(12, 16)
    if (text.toString() != 'levl') return // Only 'levl' (partially) implemented
    // head, length, code, conn, levl, SPACER, data = x[:4], x[4:6], x[6:8], x[8:12], x[12:16], x[16:20], x[20:]

    var _ = data.slice(16, 20)

    data = data.slice(20)

    if (data.length != 1041) return

    console.log('continue');
    {
      console.log('aye')
      let valArray = []
      for (let i = 0; i < 32; i++) valArray.push(data.readUInt16LE(i * 2))
      this.metering['chain1input'] = this.metering['input'] = valArray
      // looks like it's the same as 041-072
    }

    {
      let valArray = []
      const offset = 72
      for (let i = 0 + offset; i < 32 + offset; i++)
        valArray.push(data.readUInt16LE(i * 2))
      this.metering['chain2input'] = this.metering['chain1output'] = valArray
    }

    {
      let valArray = []
      const offset = 104
      for (let i = 0 + offset; i < 32 + offset; i++)
        valArray.push(data.readUInt16LE(i * 2))
      this.metering['chain3input'] = this.metering['chain2output'] = valArray
    }

    {
      let valArray = []
      const offset = 136
      for (let i = 0 + offset; i < 32 + offset; i++)
        valArray.push(data.readUInt16LE(i * 2))
      this.metering['chain4input'] = this.metering['chain3output'] = valArray
    }

    {
      let valArray = []
      const offset = 168
      for (let i = 0 + offset; i < 32 + offset; i++)
        valArray.push(data.readUInt16LE(i * 2))
      this.metering['level'] = this.metering['chain4output'] = valArray
    }

    console.log('emit')
    emitter.emit('meter', this.metering)
  })

  UDPserver.on('listening', () => {
    var address = UDPserver.address()
    console.info(`Meter server started on: ${address.address}:${address.port}`)
    if (emitter != UDPserver) {
      emitter.emit('listening')
    }
  })

  UDPserver.bind(port)
  return UDPserver
}
