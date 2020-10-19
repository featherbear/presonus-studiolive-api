export function craftSubscribe (overrides) {
  let data = {
    id: 'Subscribe',
    clientName: 'UC-Surface',
    clientInternalName: 'ucremoteapp',
    clientType: 'Android',
    clientDescription: 'zedX',
    clientIdentifier: '133d066a919ea0ea',
    clientOptions: 'perm users levl redu rtan',
    clientEncoding: 23106
  }
  if (overrides) data = { ...data, ...overrides }

  return Buffer.concat([
    Buffer.from([0xf2, 0x00, 0x00, 0x00]),
    Buffer.from(JSON.stringify(data, null, ' '))
  ])
}

export function shortToLE (i) {
  let res = Buffer.allocUnsafe(2)
  res.writeUInt16LE(i)
  return res
}
