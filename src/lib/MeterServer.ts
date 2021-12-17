/* Metering server */

// The console establishes a UDP connection to the computer, and sends over metering data
// Current status: BROKEN

import chalk from 'chalk'

import * as dgram from 'dgram'
import { PacketHeader } from './constants'

let instanceCount = 0

export default function createServer(port) {
  if (typeof port !== 'number' || port <= 0 || port > 65535) {
    throw Error('Invalid port number')
  }

  if (instanceCount++ > 0) {
    throw Error('Meter server is already running')
  }

  // Create UDP Server to listen to metering data
  const UDPserver = dgram.createSocket('udp4')

  UDPserver.on('error', err => {
    UDPserver.close()
    throw Error('Meter server error: ' + err.stack)
  })

  let ready = true
  UDPserver.on('message', (msg, rinfo) => {
    if (!ready) return
    ready = false

    let data = Buffer.from(msg)

    if (
      !data.slice(0, 4).equals(PacketHeader) ||
      data.slice(6, 8).toString() !== 'MS'
    ) {
      console.warn('Ignoring irrelevant packet')
      ready = true
      return
    }


    var length = data.slice(4, 6); // length is given as cf08 = 53000, but the payload is only 1041 long
    const PORT = length // FIXME: 4:6 is the port

    // var conn = data.slice(8, 12);

    const text = data.slice(12, 16)
    if (text.toString() !== 'levl') {
      ready = true
      return // Only 'levl' (partially) implemented
    }

    // head, length, code, conn, levl, SPACER, data = x[:4], x[4:6], x[6:8], x[8:12], x[12:16], x[16:20], x[20:]

    // eslint-disable-next-line
    const _ = data.slice(16, 20) // 00 00 c0 00

    data = data.slice(20)

    function colFmt(v: number) {
      v = v.toString().padStart(5, ' ')
      if (v > 1000) {
        return chalk.red(v)
      }
      else if (v > 200) {
        return chalk.green(v)
      }
      return v
    }

    {

      const valArray = []
      let offset = 0;
      for (let i = 0 + offset; i < data.length / 2 - 1 + offset; i++) valArray.push(colFmt(data.readUInt16LE(i * 2)))
      console.clear()
      let n = Math.floor(process.stdout.columns / 7)
      console.log("Columns of", n);

      for (let x = 0; x < valArray.length; x += n) {
        console.log(valArray.slice(x, x + n).join(', '))
      }

      console.log('Master', valArray[16 * 11 + 1]);
      console.log('Master', valArray[16 * 11 + 2]);
      // this.metering.chain1input = this.metering.input = valArray
      // looks like it's the same as 041-072


      // StudioLive 16R
      // 1-16, ?, ?, ?, 1-16 input to chain 1 (gate), 1-16 output of chain 1
      let input = valArray.slice(0, 0 + 16)
      let idk = valArray.slice(16, 16 + 3)
      let chain1_in = valArray.slice(16 + 3 + (0 * 16), 16 + 3 + (0 * 16) + 16)
      let chain1_out = valArray.slice(16 + 3 + (1 * 16), 16 + 3 + (1 * 16) + 16)
      let chain2_in = valArray.slice(16 + 3 + (2 * 16), 16 + 3 + (2 * 16) + 16)
      let chain2_out = valArray.slice(16 + 3 + (3 * 16), 16 + 3 + (3 * 16) + 16)
      let chain3_in = valArray.slice(16 + 3 + (4 * 16), 16 + 3 + (4 * 16) + 16)

      console.log('input\t\t\t', input.join(', '))
      console.log('chain1_in\t\t', chain1_in.join(', '))
      console.log('chain1_out/chain2_in\t', chain1_out.join(', '))
      console.log('chain2_out/chain3_in\t', chain2_in.join(', '))
      console.log('chain3_out/chain4_in\t', chain2_out.join(', '))
      console.log('chain4_out\t\t', chain3_in.join(', '))


      //middle - sends?



      let fx1_input = valArray[3 + 16 * 10 + 6]
      let fx1_chainA = valArray[3 + 16 * 10 + 6 + 2]
      let fx1_chainB = valArray[3 + 16 * 10 + 6 + 2 + 2]
      let fx1_chainC = valArray[3 + 16 * 10 + 6 + 2 + 2 + 2]
      console.log('fx1\t\t\t', [fx1_input, fx1_chainA, fx1_chainB, fx1_chainC].join(', '))

      let fx2_input = valArray[3 + 16 * 10 + 6 + 1]
      let fx2_chainA = valArray[3 + 16 * 10 + 6 + 2 + 1]
      let fx2_chainB = valArray[3 + 16 * 10 + 6 + 2 + 2 + 1]
      let fx2_chainC = valArray[3 + 16 * 10 + 6 + 2 + 2 + 2 + 1]
      console.log('fx2\t\t\t', [fx2_input, fx2_chainA, fx2_chainB, fx2_chainC].join(', '))
    }





    // {
    //   const valArray = []
    //   const offset = 72
    //   for (let i = 0 + offset; i < 32 + offset; i++) { valArray.push(data.readUInt16LE(i * 2)) }
    //   this.metering.chain2input = this.metering.chain1output = valArray
    // }

    // {
    //   const valArray = []
    //   const offset = 104
    //   for (let i = 0 + offset; i < 32 + offset; i++) { valArray.push(data.readUInt16LE(i * 2)) }
    //   this.metering.chain3input = this.metering.chain2output = valArray
    // }

    // {
    //   const valArray = []
    //   const offset = 136
    //   for (let i = 0 + offset; i < 32 + offset; i++) { valArray.push(data.readUInt16LE(i * 2)) }
    //   this.metering.chain4input = this.metering.chain3output = valArray
    // }

    // {
    //   const valArray = []
    //   const offset = 168
    //   for (let i = 0 + offset; i < 32 + offset; i++) { valArray.push(data.readUInt16LE(i * 2)) }
    //   this.metering.level = this.metering.chain4output = valArray
    // }

    // emitter.emit('meter', this.metering)

    setTimeout(function () {
      ready = true

    }, 50);
  })

  UDPserver.on('listening', () => {
    const address = UDPserver.address()
    console.info(`Meter server started on: ${address.address}:${address.port}`)
    const sixteeen = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6]
    console.log([...sixteeen, ...sixteeen, ...sixteeen, ...sixteeen].map(v => chalk.yellow(v)).join(', '))
    // if (emitter !== UDPserver) {
    //   emitter.emit('listening')
    // }
  })

  UDPserver.bind(port)
  return UDPserver
}
