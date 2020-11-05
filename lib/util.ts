export function shortToLE (i) {
  let res = Buffer.allocUnsafe(2)
  res.writeUInt16LE(i)
  return res
}
