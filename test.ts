
import { Client, MessageCode, SettingType } from './src/api'

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
})
