export function shortToLE (i) {
  const res = Buffer.allocUnsafe(2)
  res.writeUInt16LE(i)
  return res
}
