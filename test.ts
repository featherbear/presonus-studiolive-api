import { writeFileSync } from 'fs'
import { Client, MESSAGETYPES } from './src/api'

const client = new Client('192.168.0.18', 53000)
client.on('data', function ({ code, data }) {
      console.log('Got payload with code', code)
})

interface ChannelConfig {

    channels: number,
    fx: number,
    aux: number

}
// SL16R
client.on(MESSAGETYPES.FaderPosition, function (v: Buffer) {
    const devices: { [device: string]: ChannelConfig } = {
        SL16R: {
            channels: 16,
            aux: 6,
            fx: 2
        }
    }

    let config = devices.SL16R

    v = v.slice(8)

    let values = []
    for (let i = 0; i < config.channels; i++) {
        values.push(v.readUInt16LE(i * 2))
    }
    v = v.slice(config.channels * 2)

    let tape = v.readUInt16LE(0) // tape

    v = v.slice(2)

    let fx_return = []
    for (let i = 0; i < config.fx; i++) {
        fx_return.push(v.readUInt16LE(i * 2))
    }
    v = v.slice(config.fx * 2)

    let talkback = v.readUInt16LE(0)
    v = v.slice(2)

    let aux = []
    for (let i = 0; i < config.aux; i++) {
        aux.push(v.readUInt16LE(i * 2))
    }
    v = v.slice(config.aux * 2)

    let fx = []
    for (let i = 0; i < config.fx; i++) {
        fx.push(v.readUInt16LE(i * 2))
    }
    v = v.slice(config.fx * 2)

    let main = v.readUInt16LE(0)
    v = v.slice(2 * 2)

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

    OPLog({
        values, tape, fx_return, talkback, aux, fx, main
    });

    console.log(v.length, v);
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

