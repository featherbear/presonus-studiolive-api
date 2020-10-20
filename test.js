const { Client, MessageTypes } = require('./index.js')

let client = new Client('192.168.0.50', 53000)

client.on(MessageTypes.Setting, function (data) {
  console.log(data)
})

client.on('discover', console.table)
client.discoverySubscribe()
client.connect()

// client.meterSubscribe()

// setInterval(() => {
//   for (let key in client.metering) {
//     console.log(key + " " + client.metering[key]);
//   }
//   console.log("\n\n");
// }, 1000);
