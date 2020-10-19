import net from 'net'
import { PacketHeader } from './constants'

export default function (callback) {
  let TCPclient = new net.Socket()

  let remaining = 0
  let payload = Buffer.allocUnsafe(0)

  TCPclient.on('data', bytes => {
    let frame = Buffer.from(bytes)

    while (frame.length != 0) {
      if (frame.slice(0, 4).equals(PacketHeader)) {
        let correctLength = frame.readUInt16LE(4)

        if (frame.length - 6 < correctLength) {
          payload = frame
          remaining = correctLength - (frame.length - 6)
          return
        } else {
          callback(frame.slice(0, correctLength + 6))

          frame = frame.slice(correctLength + 6)

          remaining = 0
          payload = Buffer.allocUnsafe(0)
        }
      } else if (remaining > 0) {
        let extractN = Math.min(remaining, frame.length)

        payload = Buffer.concat([payload, frame.slice(0, extractN)])
        frame = frame.slice(extractN)
        remaining -= extractN

        if (remaining == 0) {
          callback(payload)
          payload = Buffer.allocUnsafe(0)
        }

        if (remaining < 0) {
          throw Error('Extracted more bytes than the payload required')
        }
      }
    }
  })

  TCPclient.on('close', function () {
    console.log('Connection closed')
  })

  return TCPclient
}
