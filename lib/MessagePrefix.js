let MessagePrefix = {
  KeepAlive: 'KA',
  Hello: 'UM',
  JSON: 'JM',
  Setting: 'PV',
  Settings2: 'PL',
  FileResource: 'FR',
  FileResource2: 'FD',
  UNKNOWN_REPLY: 'BO',
  CompressedUnknown: 'CK'
}
for (let str in MessagePrefix) MessagePrefix[MessagePrefix[str]] = str

export default MessagePrefix
