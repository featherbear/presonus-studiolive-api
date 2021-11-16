import { writeFileSync } from 'fs'
import { Client, MESSAGETYPES } from './src/api'

const client = new Client('192.168.0.18', 53000)
client.on('data', function ({ code, data }) {
  console.log('Got payload with code', code)
})

client.on(MESSAGETYPES.ZLIB, function (zlib) {
  console.log(zlib);
  writeFileSync('zlib.parsed', JSON.stringify(zlib, null, 4))
})

// client.on('discover', console.table)
// client.discoverySubscribe()

client.connect().then(() => {
  // client.meterSubscribe()
})

// setInterval(() => {
//   for (let key in client.metering) {
//     console.log(key + " " + client.metering[key]);
//   }
//   console.log("\n\n");
// }, 1000);
