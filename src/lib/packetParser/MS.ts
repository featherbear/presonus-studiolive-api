import Client from '../Client'
import { ChannelTypes } from '../constants'
import { createFragment, PacketParser } from '../types/PacketParser'

function readValues(buffer: Buffer, count: number) {
  const values = []
  for (let i = 0; i < count; i++) values.push(buffer.readUInt16LE(i * 2) / 655.35)
  return values
}

/**
 * FIXME: TODO: Implement
 */
export default <PacketParser>function handleMSPacket(this: Client, data) {

  // First 4 bytes SHOULD be 'fdrs', but for now we won't check
  data = data.slice(8)

  const channelCounts = this.channelCounts
  console.log('CH counts', channelCounts);
  const order: ChannelTypes[] = ['LINE', 'RETURN', 'FXRETURN', 'TALKBACK', 'AUX', 'FX', 'MAIN']

  const values: { [_ in ChannelTypes]: number[] } = <any>{}

  for (const type of order) {
    values[type] = readValues(data, channelCounts[type])
    data = data.slice(channelCounts[type] * 2)
  }

  // TODO: Position of the faders for busses, groups, dcas, etc...


  console.log(data);

  return [createFragment(null, values)]
}
