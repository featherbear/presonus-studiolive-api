import { PacketHeader } from './lib/constants'
import { analysePacket } from './lib/MessageProtocol'

var dgram = require('dgram')
var socket = dgram.createSocket('udp4')

var broadcastAddress = '255.255.255.255'
var broadcastPort = 47809

socket.bind(broadcastPort, '0.0.0.0')

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

  console.table({
    name: nameA /* TODO: Figure out the difference between nameA and nameB */,
    serial,
    ip: rinfo.address,
    port: rinfo.port
  })

  return {
    name: nameA /* TODO: Figure out the difference between nameA and nameB */,
    serial,
    ip: rinfo.address,
    port: rinfo.port
  }
})
