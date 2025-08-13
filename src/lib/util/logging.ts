import bunyan from 'bunyan'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { name } = require('../../../package.json')

globalThis.logger = bunyan.createLogger({
  name,
  level: 61 // fatal + 1
})
