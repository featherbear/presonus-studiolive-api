import bunyan from 'bunyan'

globalThis.logger = bunyan.createLogger({
  name: "presonus-studiolive-api",
  level: 61 // fatal + 1
})
