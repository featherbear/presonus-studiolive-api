/**
 * Convert an unsigned short (16-bit) to a 2-byte buffer
 */
export function toShort(i) {
  const res = Buffer.allocUnsafe(2)
  res.writeUInt16LE(i)
  return res
}

/**
 * Convert an unsigned integer (32-bit) to a 4-byte buffer
 */
export function toInt(i) {
  const res = Buffer.allocUnsafe(4)
  res.writeUInt32LE(i)
  return res
}

/**
 * Convert a decimal to a 4-byte buffer
 */
export function toFloat(i: number) {
  const res = Buffer.allocUnsafe(4)
  res.writeFloatLE(i)
  return res
}

/**
 * Convert a decimal to a 4-byte boolean
 */
export function toBoolean(val: boolean) {
  return toFloat(val ? 1 : 0)
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
