/* eslint-disable */
/* Metering server */

// The console establishes a UDP connection to the computer, and sends over metering data
// Current status: BROKEN

import chalk from 'chalk'

import * as dgram from 'dgram'
import { PacketHeader } from './constants'
import ChannelCount from './types/ChannelCount'

let instanceCount = 0

export default function createServer(port, channelCounts: ChannelCount) {
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
      return // Only 'levl'  implemented
    }

    // head, length, code, conn, levl, SPACER, data = x[:4], x[4:6], x[6:8], x[8:12], x[12:16], x[16:20], x[20:]

    // eslint-disable-next-line
    const _ = data.slice(16, 20) // 00 00 c0 00
    console.log(_.join(', '), data.length);

    // 192

    // Reduce buffer size
    data = data.slice(20, 20 + 192 * 2 - 8)

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

      // Calculate columns
      let valArray = []
      let offset = 0;
      for (let i = 0 + offset; i < data.length / 2 - 1 + offset; i++) valArray.push(colFmt(data.readUInt16LE(i * 2)))
      console.clear()
      let n = Math.floor(process.stdout.columns / 7)
      console.log("Columns of", n);


      let colourIter = 0;
      const colour = ['yellow', 'magenta', 'cyan', 'gray', 'blue'];

      let lastLabel = ""
      function range(start, stop, label?: string) {
        let r = valArray.slice(start, stop)
        if (label) {
          if (lastLabel === label) {
            valArray = valArray.fill(chalk[colour[colourIter % colour.length]](label.substr(0, 5).padStart(5, ' ')), start, stop)
          } else {
            valArray = valArray.fill(chalk[colour[++colourIter % colour.length]](label.substr(0, 5).padStart(5, ' ')), start, stop)
          }
          lastLabel = label
        }
        return r
      }



      // StudioLive 16R
      // 1-16, ?, ?, ?, 1-16 input to strip 1 (gate), 1-16 output of strip 1
      let input = range(0, 0 + 16, 'input')
      let idk = range(16, 16 + 3, '?')
      let strip1_in = range(16 + 3 + (0 * 16), 16 + 3 + (0 * 16) + 16, 'strip')
      let strip1_out = range(16 + 3 + (1 * 16), 16 + 3 + (1 * 16) + 16, 'strip')
      let strip2_in = range(16 + 3 + (2 * 16), 16 + 3 + (2 * 16) + 16, 'strip')
      let strip2_out = range(16 + 3 + (3 * 16), 16 + 3 + (3 * 16) + 16, 'strip')
      let strip3_in = range(16 + 3 + (4 * 16), 16 + 3 + (4 * 16) + 16, 'strip')

      console.log('input channels\t\t', input.join(', '))
      console.log('stripA\t\t\t', strip1_in.join(', '))
      console.log('stripB\t\t\t', strip1_out.join(', '))
      console.log('stripC\t\t\t', strip2_in.join(', '))
      console.log('stripD\t\t\t', strip2_out.join(', '))
      console.log('stripE\t\t\t', strip3_in.join(', '))

      let main = range(16 + 3 + (4 * 16) + 16, 16 + 3 + (4 * 16) + 16 + 16, 'main')
      console.log('main mix\t\t', main.join(', '))

      console.log('main levels\t\t', range(16 * 11 + 1, 16 * 11 + 2 + (((((1))))), 'main').join(', '));
      console.log('main fx\t\t\t', range(16 * 11 + 2 + (((((1))))), 16 * 11 + 2 + (((((1))))) + 8, 'mainC').join(', '));


      // let aux_mtx_1 = valArray[3  + 16 * 8 + 8]
      // console.log('aux1\t\t\t', aux_mtx_1);
      let aux_mtx = range(3 + 16 * 8 + 8, 3 + 16 * 8 + 8 + 6, 'auxMT')
      console.log('aux_mtx\t\t\t', aux_mtx.join(', '))


      let aux_stripA = range(3 + 16 * 8 + 8 + 6, 3 + 16 * 8 + 8 + 6 + 6, 'auxCH')
      let aux_stripB = range(3 + 16 * 8 + 8 + 6 + 6, 3 + 16 * 8 + 8 + 6 + 6 + 6, 'auxCH')
      let aux_stripC = range(3 + 16 * 8 + 8 + 6 + 6 + 6, 3 + 16 * 8 + 8 + 6 + 6 + 6 + 6, 'auxCH')
      let aux_stripD = range(3 + 16 * 8 + 8 + 6 + 6 + 6 + 6, 3 + 16 * 8 + 8 + 6 + 6 + 6 + 6 + 6, 'auxCH')
      console.log('aux_stripA\t\t', aux_stripA.join(', '))
      console.log('aux_stripB\t\t', aux_stripB.join(', '))
      console.log('aux_stripC\t\t', aux_stripC.join(', '))
      console.log('aux_stripD\t\t', aux_stripD.join(', '))



      let fx1_input = valArray[3 + 16 * 10 + 6]
      let fx1_stripA = valArray[3 + 16 * 10 + 6 + 2]
      let fx1_stripB = valArray[3 + 16 * 10 + 6 + 2 + 2]
      let fx1_stripC = valArray[3 + 16 * 10 + 6 + 2 + 2 + 2]
      console.log('fx1\t\t\t', [fx1_input, fx1_stripA, fx1_stripB, fx1_stripC].join(', '))

      let fx2_input = valArray[3 + 16 * 10 + 6 + 1]
      let fx2_stripA = valArray[3 + 16 * 10 + 6 + 2 + 1]
      let fx2_stripB = valArray[3 + 16 * 10 + 6 + 2 + 2 + 1]
      let fx2_stripC = valArray[3 + 16 * 10 + 6 + 2 + 2 + 2 + 1]
      console.log('fx2\t\t\t', [fx2_input, fx2_stripA, fx2_stripB, fx2_stripC].join(', '))

      //
      range(3 + 16 * 10 + 6, 3 + 16 * 10 + 6 + 2 + 2 + 2 + 1 + ((((1)))), 'fx_chn')
      //

      let fx_strip = range(3 + 16 * 7 + 8, 3 + 16 * 7 + 8 + 16, 'fxCHN')
      console.log('fx_strip\t\t', fx_strip.join(', '))





      // The rest
      for (let x = 0; x < valArray.length; x += n) {
        console.log(valArray.slice(x, x + n).join(', '))
      }

    }




    // {
    //   const valArray = []
    //   const offset = 72
    //   for (let i = 0 + offset; i < 32 + offset; i++) { valArray.push(data.readUInt16LE(i * 2)) }
    //   this.metering.strip2input = this.metering.strip1output = valArray
    // }

    // {
    //   const valArray = []
    //   const offset = 104
    //   for (let i = 0 + offset; i < 32 + offset; i++) { valArray.push(data.readUInt16LE(i * 2)) }
    //   this.metering.strip3input = this.metering.strip2output = valArray
    // }

    // {
    //   const valArray = []
    //   const offset = 136
    //   for (let i = 0 + offset; i < 32 + offset; i++) { valArray.push(data.readUInt16LE(i * 2)) }
    //   this.metering.strip4input = this.metering.strip3output = valArray
    // }

    // {
    //   const valArray = []
    //   const offset = 168
    //   for (let i = 0 + offset; i < 32 + offset; i++) { valArray.push(data.readUInt16LE(i * 2)) }
    //   this.metering.level = this.metering.strip4output = valArray
    // }

    // emitter.emit('meter', this.metering)

    // during dev, restrict output to every 50ms
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
