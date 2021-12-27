import { Client, MESSAGETYPES } from './src/api'

const client = new Client('192.168.0.18', 53000)
client.on('data', function ({ code, data }) {
    console.log('Got payload with code', code)
})

client.on(MESSAGETYPES.FaderPosition, function (MS) {
    function OPLog(d: { [a: string]: number | number[] }) {
        console.log(
            Object.entries(d).reduce(
                (o, [k, v]) => ({
                    ...o, [k]:
                        (Array.isArray(v) ? v : [v]).map(
                            (v) =>
                                v.toString().padStart(5, ' ')).join(', ')
                }), {}
            )
        )
    }

    OPLog(MS)
    console.log(MS.length, MS);
})

client.on(MESSAGETYPES.Setting, function (PV) {

    // const { name, value }: { name: string, value: Buffer } = PV
    // console.log(name, value, value.toString());
    // if (name.endsWith('/volume')) {
    //     console.info((value.readUInt32LE(0) - 1063699898) / 143369)
    // }
    // writeFileSync('zlib.parsed', JSON.stringify(zlib, null, 4))
})

// client.on(MESSAGETYPES.Unknown3, function (MS) {
//   console.log(MS);
//   // writeFileSync('zlib.parsed', JSON.stringify(zlib, null, 4))
// })

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

