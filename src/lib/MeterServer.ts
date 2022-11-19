/* eslint-disable camelcase */

import * as dgram from 'dgram'
import { PacketHeader } from './constants'
import ChannelCount from './types/ChannelCount'

// TODO: 
export interface MeterData {

}

/**
 * Create a UDP server and await data.  
 * This function **does not** send the packet to initiate the meter data request
 * 
 * @param port UDP port to listen on
 * @param channelCounts Channel count data
 * @param onData Callback
 */
export default function createServer(port, channelCounts: ChannelCount, onData: (data: MeterData) => any) {
  if (typeof port !== 'number' || port < 0 || port > 65535) {
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
        const values: number[] = []
        for (let i = 0; i < count; i++) values.push(data.readUInt16LE((skipBytes + i) * 2))
        data = data.slice((skipBytes + count) * 2)
        return values
      }

      const input = readValues(channelCounts.LINE)

      const channelStrip = {
        stripA: readValues(channelCounts.LINE, 3),
        stripB: readValues(channelCounts.LINE),
        stripC: readValues(channelCounts.LINE),
        stripD: readValues(channelCounts.LINE),
        stripE: readValues(channelCounts.LINE)
      }

      // Metering values for the main mix
      const mainMixFaders = readValues(channelCounts.LINE)

      // Stereo
      const fxreturn_strip = {
        input: readValues(channelCounts.FXRETURN * 2, 8),
        stripA: readValues(channelCounts.FXRETURN * 2),
        stripB: readValues(channelCounts.FXRETURN * 2),
        stripC: readValues(channelCounts.FXRETURN * 2)
      }

      /**
       * Aux output meters
       */
      const aux_metering = readValues(channelCounts.AUX)

      const aux_chstrip = {
        stripA: readValues(channelCounts.AUX),
        stripB: readValues(channelCounts.AUX),
        stripC: readValues(channelCounts.AUX),
        stripD: readValues(channelCounts.AUX)
      }

      const fx_chstrip = {
        inputs: readValues(channelCounts.FX),
        stripA: readValues(channelCounts.FX), // eq out
        stripB: readValues(channelCounts.FX), // comp out
        stripC: readValues(channelCounts.FX) // outs
      }

      // Stereo
      const main = readValues(channelCounts.MAIN * 2)
      const main_chstrip = {
        stageA: readValues(channelCounts.MAIN * 2),
        stageB: readValues(channelCounts.MAIN * 2),
        stageC: readValues(channelCounts.MAIN * 2),
        stageD: readValues(channelCounts.MAIN * 2)
      }

      const result: MeterData = {
        input,
        channelStrip,
        aux_metering,
        aux_chstrip,
        mainMixFaders,
        main_chstrip,
        main,
        fx_chstrip,
        fxreturn_strip
      }

      onData(result)
    })
    UDPserver.on('listening', () => resolve(UDPserver))
    UDPserver.bind(port)
  })
}
