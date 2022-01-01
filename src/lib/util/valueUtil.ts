type Bounds = [number, number]
/**
 * Convert a logarithmic volume to its respective number
 * https://github.com/featherbear/presonus-studiolive-api/blob/a864a2fb4d2838f8edc811c4d2f395e894df4408/PV%2CZB_analysis.xlsx
 */
export function dBto32(db) {
  // Gaussian / Bell Curve fit - https://mycurvefit.com/
  const curveFunction = (x) => Math.trunc(
    1064974000 * Math.exp((-Math.pow(x - 17.99124, 2) / (2 * Math.pow(238.1057, 2))))
  )

  const inputBounds: Bounds = [-84, 10]
  const outputBounds: Bounds = [0, 0x3f800000]

  db = clamp(db, inputBounds)
  const result = clamp(curveFunction(db), outputBounds)

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
