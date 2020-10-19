const { Client, MessagePrefix } = require('./index.js')

let client = new Client('192.168.0.50', 53000)

client.on(MessagePrefix.Setting, function (data) {
  console.log(data)
})
client.connect()

// client.meterSubscribe()

// setInterval(() => {
//   for (let key in client.metering) {
//     console.log(key + " " + client.metering[key]);
//   }
//   console.log("\n\n");
// }, 1000);
