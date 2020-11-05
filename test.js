console.log(require('./index.js'))
const { Client, MessageTypes } = require('./index.js')

// let client = new Client('10.185.192.10', 53000)
let client = new Client('192.168.0.50', 53000)

// client.on(MessageTypes.Setting, function (data) {
//   console.log(data)
// })

client.on('data', function ({ code, ...data }) {
  if (
    [
      MessageTypes.Unknown1,
      MessageTypes.Unknown2,
      MessageTypes.Unknown3
    ].includes(code)
  ) {
    // console.log('\n\nignoring unknown packet\n',segment, '\n', segment.toString() );
    return
  }

  if (data.data instanceof Buffer) {
    // TODO: mt64 0x6d 0x74 0x36 0x34    seems to contain all mute values
    // console.log("BUFF", data.data.toString(), '\n', data, '\n')
  } else {
    // console.log(data, '\n')
  }
  // if (code == MessageTypes.DeviceList) {
  //   console.log(data.data.toString(), data.data);
  //   console.log(new Date())
  // }
})

// client.on('discover', console.table)
// client.discoverySubscribe()

client.connect().then(() => {
  client.meterSubscribe()
  client.mute(1)
})

// setInterval(() => {
//   for (let key in client.metering) {
//     console.log(key + " " + client.metering[key]);
//   }
//   console.log("\n\n");
// }, 1000);
