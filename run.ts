
import { Client, MessageCode, SettingType } from './src/api'
import { SCENES_OF } from './src/lib/util/fileRequestUtil'
import { createPacket } from './src/lib/util/messageProtocol'

const client = new Client({
  host: '192.168.0.29',
  port: 53000
}, {
  autoreconnect: true,
  logLevel: process.env.DEBUG ? 'debug' : 'info'
})

/**
 * Reconnect if the connection is lost and autoreconnect is enabled
 * Raised after the Keep-Alive health check expires
 */
client.on('reconnecting', function () {
  console.log('evt: Reconnecting to console')
})

client.on('closed', function () {
  console.log('evt: Connection closed')
})

client.on('connected', function () {
  console.log('evt: Connected')
})

client.on('data', function ({ code, data }) {
  // 
})

client.on(MessageCode.ParamValue, function (data: SettingType) {
  //
})

client.connect().then(() => {
  console.log('Connection was established')

  // client.hehe().then(j => console.log(j))

  // client.sendList('presets/channel').then(j => {
  //   console.log('Got channel list', j)
  // })

  // client.sendList('presets/proj').then(j => {
  //   console.log('Got proj list', j)
  //   client.sendList(SCENES_OF(j[0].name)).then(j => {
  //     console.log('Got scene list', j)
  //   })
  // })
})
