
import { Client, MESSAGETYPES } from './src/api'
import { ZlibNode } from './src/lib/util/zlib/zlibNodeParser'
import { getZlibValue } from './src/lib/util/zlib/zlibUtil'

const client = new Client('192.168.0.18', 53000)
// client.on('data', function ({ code, data }) {
//   // console.log('Got payload with code', code, data)
// })

// client.on(MESSAGETYPES.FaderPosition, function (MS) {
//   // LINEAR
//   function OPLog(d: { [a: string]: number | number[] }) {
//     console.log(
//       Object.entries(d).reduce(
//         (o, [k, v]) => ({
//           ...o,
//           [k]:
//                         (Array.isArray(v) ? v : [v]).map(
//                           (v) =>
//                             v.toString().padStart(5, ' ')).join(', ')
//         }), {}
//       )
//     )
//   }

//   // OPLog(MS)
//   // console.log(MS.length, MS);
// })

// client.on(MESSAGETYPES.Setting, function (PV) {
//   // LOGARITHMIC
//   const { name, value }: { name: string, value: Buffer } = PV
//   console.log(name, value)
//   if (name.endsWith('/volume')) {
//     // Here, have some random constants

//     console.info('S', value.slice(0, 4), value.readUInt32LE(0) - 0x3f66c5ba, (value.readUInt32LE(0) - 0x3f66c5ba) / 0x23009)
//   }
// })

client.on(MESSAGETYPES.ZLIB, function (ZB: ZlibNode) {
  console.log(getZlibValue(ZB, 'global'))
  // )
  //   function intToLE(i) {
  //     const res = Buffer.allocUnsafe(4)
  //     res.writeUInt32BE(i)
  //     return res
  //   }
  //   const floor = 0x3a970133
  //   const { chnum, name, username, color, select, solo, volume, mute, pan } = ZB.children.line.children.ch1.values
  //   console.log({
  //     chnum,
  //     name,
  //     username,
  //     color,
  //     select,
  //     solo,
  //     volume,
  //     volume2: intToLE(volume),
  //     volume3:

  //             intToLE(volume).readInt32LE() === 0 ? 0 : (intToLE(volume).readInt32LE() - floor) / (0X3f800000 - floor),
  //     mute,
  //     pan
  //   })

  // big endian actually hey
  // ["00000000", "3d76bf3a", "3e018acb", "3e4b90f6", "3ea062b2", "3ec25031", "3ed4d1bb", "3f031597", "3f250315", "3f2e43da", "3f3a9a36", 0, "3f3f3a9b", "3f4a062c", "3f565c88", "3f62b2e6", "3f73a9a2", "3f7b5f9d", "3f800000"]

  // writeFileSync('file.json', JSON.stringify([...JSON.parse(readFileSync('file.json', 'utf8')), intToLE(volume).toString('hex')]))
  //   exit(1)
})

// client.on('discover', console.table)
// client.discoverySubscribe()

client.connect().then(() => {
  // let i = 1
  // let direction = true
  // setInterval(function() {
  //     let v = ['mute', 'unmute'][direction ? 1 : 0]

  //     console.log(`client.${v}('LINE', ${i})`);
  //     client[v]('LINE', i)
  //     if (i == 16) {
  //         direction = !direction
  //         i = 1
  //     } else {
  //         i++
  //     }
  // },150)
  // client.meterSubscribe()
})

// setInterval(() => {
//   for (let key in client.metering) {
//     console.log(key + " " + client.metering[key]);
//   }
//   console.log("\n\n");
// }, 1000);
