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

export function parseChannelString(
  type: keyof typeof CHANNELTYPES,
  channel: CHANNELS.CHANNELS,
) {

  // `type` must be a valid enum key
  if (!Object.keys(CHANNELTYPES).includes(type as CHANNELTYPES)) {
    throw new Error("Invalid channel type provided")
  }

  if (
    // `channel` must be a whole number larger than zero
    !(Math.trunc(channel) > 0)
    || (channel !== (channel = Math.trunc(channel)))

    // `channel` must also exist for a given `type`
    || !Object.values(CHANNELS[type]).includes(channel)
  ) {
    throw new Error("Invalid channel provided")
  }

  return `${CHANNELTYPES[type]}/ch${channel}`
}
