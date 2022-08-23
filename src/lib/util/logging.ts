import bunyan from 'bunyan'
const { name } = require('../../../package.json')

globalThis.logger = bunyan.createLogger({
  name,
  level: process.env.DEBUG ? 'debug' : 'info'
})
