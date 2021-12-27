import { Client, MESSAGETYPES } from './src/api'
import ZlibPayload from './src/lib/types/ZlibPayload'

const client = new Client('192.168.0.18', 53000)
client.on('data', function ({ code, data }) {
    // console.log('Got payload with code', code, data)
})

client.on(MESSAGETYPES.FaderPosition, function (MS) {
    // LINEAR
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

    // OPLog(MS)
    // console.log(MS.length, MS);
})

client.on(MESSAGETYPES.Setting, function (PV) {
    // LOGARITHMIC
    const { name, value }: { name: string, value: Buffer } = PV
    console.log(name, value);
    if (name.endsWith('/volume')) {
        // Here, have some random constants

        console.info("S", value.slice(0, 4), value.readUInt32LE(0) - 0x3f66c5ba, (value.readUInt32LE(0) - 0x3f66c5ba) / 0x23009)
    }
})

client.on(MESSAGETYPES.ZLIB, function (ZB: ZlibPayload) {
    if (ZB.id !== 'Synchronize') return

    const { chnum, name, username, color, select, solo, volume, mute, pan } = ZB.children.line.children.ch1.values
    console.log({ chnum, name, username, color, select, solo, volume, mute, pan });

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

