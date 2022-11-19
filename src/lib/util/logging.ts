import bunyan from 'bunyan'
const { name } = require('../../../package.json')

globalThis.logger = bunyan.createLogger({
  name,
  level: 61 // fatal + 1
})
