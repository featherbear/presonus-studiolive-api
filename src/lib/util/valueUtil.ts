type Bounds = [number, number]
/**
 * Convert a logarithmic volume to its respective number
 * https://github.com/featherbear/presonus-studiolive-api/blob/a864a2fb4d2838f8edc811c4d2f395e894df4408/PV%2CZB_analysis.xlsx
 */
export function logVolumeTo32(db) {
  // Gaussian / Bell Curve fit - https://mycurvefit.com/
  const curveFunction = (x) => Math.trunc(
    1064974000 * Math.exp((-Math.pow(x - 17.99124, 2) / (2 * Math.pow(238.1057, 2))))
  )

  const inputBounds: Bounds = [-84, 10]
  const outputBounds: Bounds = [0, 0x3f800000]

  db = clamp(db, inputBounds)

  if (db === inputBounds[0]) return outputBounds[0]
  if (db === inputBounds[1]) return outputBounds[1]
  const result = clamp(curveFunction(db), outputBounds)

  return result
}

export function linearVolumeTo32(level) {
  // Logarithmic fit
  const curveFunction = (x) => Math.trunc(
    1008981585.018076882 + 12158286.478774655 * Math.log(x) // eslint-disable-line no-loss-of-precision
  )

  const inputBounds: Bounds = [0, 100]
  const outputBounds: Bounds = [0, 0x3f800000]
    
  level = clamp(level, inputBounds)

  if (level === inputBounds[0]) return outputBounds[0]
  if (level === inputBounds[1]) return outputBounds[1]
  const result = clamp(curveFunction(level), outputBounds)

  return result
}

export function clamp(val: number, [min, max]: Bounds) {
  return Math.max(min, Math.min(max, val))
}

export const onOff = {
  encode(bool) {
    return Buffer.from(bool ? [0x00, 0x00, 0x80, 0x3f] : [0x00, 0x00, 0x00, 0x00])
  },
  decode(bytes) {
    let temp = bytes

    if (!Buffer.isBuffer(bytes)) {
      const buff = Buffer.allocUnsafe(4)
      buff.writeUInt32BE(bytes)
      temp = buff
    }

    if (temp.equals(new Uint8Array([0x00, 0x00, 0x80, 0x3f]))) {
      return true
    } else if (temp.equals(new Uint8Array([0x00, 0x00, 0x00, 0x00]))) {
      return false
    }

    return bytes
  }
}
