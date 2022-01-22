/* eslint-disable camelcase */

import * as dgram from 'dgram'
import { PacketHeader } from './constants'
import ChannelCount from './types/ChannelCount'

/**
 * Create a UDP server and await data.  
 * This function **does not** send the packet to initiate the meter data request
 * 
 * @param port UDP port to listen on
 * @param channelCounts Channel count data
 * @param onData Callback
 */
export default function createServer(port, channelCounts: ChannelCount, onData: (meterData) => any) {
  if (typeof port !== 'number' || port <= 0 || port > 65535) {
    throw Error('Invalid port number')
  }

  // Create UDP Server to listen to metering data
  const UDPserver = dgram.createSocket('udp4')

  UDPserver.on('error', err => {
    UDPserver.close()
    throw Error('Meter server error: ' + err.stack)
  })

  return new Promise<dgram.Socket>((resolve) => {
    UDPserver.on('message', (msg, rinfo) => {
      let data = Buffer.from(msg)

      if (
        !data.slice(0, 4).equals(PacketHeader) ||
        data.slice(6, 8).toString() !== 'MS'
      ) {
        return
      }

      // const PORT = data.slice(4, 6) // length is given as cf08 = 53000, but the payload is only 1041 long

      // Only 'levl'  implemented
      if (data.slice(12, 16).toString() !== 'levl') return

      // TODO: Investigate this number
      //   // eslint-disable-next-line
      // const _ = data.slice(16, 20) // 00 00 c0 00
      // console.log(_.join(', '), data.length);

      // Reduce buffer size
      data = data.slice(20) // , 20 + 192 * 2 - 8)

      /**
       * Consume the buffer, modifying it after reading
       * @param count Number of values to read
       * @param skipBytes Bytes to skip ahead from
       */
      function readValues(count: number, skipBytes: number = 0) {
        const values = []
        for (let i = 0; i < count; i++) values.push(data.readUInt16LE((skipBytes + i) * 2))
        data = data.slice((skipBytes + count) * 2)
        return values
      }

      const input = readValues(channelCounts.line)

      const channelStrip = {
        stripA: readValues(channelCounts.line, 3),
        stripB: readValues(channelCounts.line),
        stripC: readValues(channelCounts.line),
        stripD: readValues(channelCounts.line),
        stripE: readValues(channelCounts.line)
      }

      // Metering values for the main mix
      const mainMixFaders = readValues(channelCounts.line)

      // Stereo
      const fxreturn_strip = {
        input: readValues(channelCounts.fx * 2, 8),
        stripA: readValues(channelCounts.fx * 2),
        stripB: readValues(channelCounts.fx * 2),
        stripC: readValues(channelCounts.fx * 2)
      }

      /**
       * Aux output meters
       */
      const aux_metering = readValues(channelCounts.aux)

      const aux_chstrip = {
        stripA: readValues(channelCounts.aux),
        stripB: readValues(channelCounts.aux),
        stripC: readValues(channelCounts.aux),
        stripD: readValues(channelCounts.aux)
      }

      const fx_chstrip = {
        inputs: readValues(channelCounts.fx),
        stripA: readValues(channelCounts.fx), // eq out
        stripB: readValues(channelCounts.fx), // comp out
        stripC: readValues(channelCounts.fx) // outs
      }

      // Stereo
      const main = readValues(channelCounts.main * 2)
      const main_chstrip = {
        stageA: readValues(channelCounts.main * 2),
        stageB: readValues(channelCounts.main * 2),
        stageC: readValues(channelCounts.main * 2),
        stageD: readValues(channelCounts.main * 2)
      }

      onData({
        input,
        channelStrip,
        aux_metering,
        aux_chstrip,
        mainMixFaders,
        main_chstrip,
        main,
        fx_chstrip,
        fxreturn_strip
      })
    })
    UDPserver.on('listening', () => resolve(UDPserver))
    UDPserver.bind(port)
  })
}
