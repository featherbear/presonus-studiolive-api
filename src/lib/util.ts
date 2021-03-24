import { CHANNELS, CHANNELTYPES } from './constants'

export function shortToLE (i) {
  const res = Buffer.allocUnsafe(2)
  res.writeUInt16LE(i)
  return res
}

// Hacky mc hack hack
declare global {
  interface Buffer {
    /**
     * Returns a boolean indicating if the object partially matches `buffer`
     */
    matches(buffer: Buffer): boolean
  }
}

Buffer.prototype.matches = function (buffer) {
  return (
    buffer.length >= this.length && this.compare(buffer, 0, this.length) === 0
  )
}

export function parseChannelString (
  channel: CHANNELS.CHANNELS,
  type: CHANNELTYPES
) {
  const map = {
    [CHANNELTYPES.LINE]: CHANNELS.LINE,
    [CHANNELTYPES.AUX]: CHANNELS.AUX,
    [CHANNELTYPES.FX]: CHANNELS.FX,
    [CHANNELTYPES.FXRETURN]: CHANNELS.FXRETURN,
    [CHANNELTYPES.SUB]: CHANNELS.SUB,
    [CHANNELTYPES.MAIN]: CHANNELS.MAIN,
    [CHANNELTYPES.TALKBACK]: CHANNELS.TALKBACK
  }

  if (Number.isInteger(channel)) channel = Number(channel)
  for (const [ckey, cval] of Object.entries(map)) {
    if (type === ckey) {
      if (!Object.values(cval).includes(channel)) {
        throw new Error('Invalid channel provided')
      }

      return `${type}/ch${channel}`
    }
  }

  throw new Error('Invalid channel type provided')
}
