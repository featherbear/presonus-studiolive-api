import Client from "../Client"
import { ChannelTypes } from "../constants"

function readValues(buffer: Buffer, count: number) {
  const values = []
  for (let i = 0; i < count; i++) values.push(buffer.readUInt16LE(i * 2))
  return values
}

export default function handleMSPacket(this: Client, data): {

} {
  data = data.slice(8)

  const channelCounts = this.channelCounts
  const order: ChannelTypes[] = ["LINE", "RETURN", "FX", "TALKBACK", "AUX", "FX", "MAIN"]

  const values: { [_ in ChannelTypes]: number[] } = <any>{}

  for (let type of order) {
    values[type] = readValues(data, channelCounts[type])
    data = data.slice(channelCounts[type] * 2)
  }

  // TODO: Position of the faders for busses, groups, dcas, etc...
  return values

}
