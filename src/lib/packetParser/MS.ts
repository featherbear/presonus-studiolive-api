/** IN DEVELOPMENT */
/* eslint-disable */

import Client from "../Client"
import { CHANNELTYPES } from "../constants"

function readValues(buffer: Buffer, count: number) {
  const values = []
  for (let i = 0; i < count; i++) values.push(buffer.readUInt16LE(i * 2))
  return values
}

export default function handleMSPacket(this: Client, data): {
  [_ in keyof typeof CHANNELTYPES]: number[]
} {
  data = data.slice(8)

  const channelCounts = this.channelCounts

  const line = readValues(data, channelCounts.line)
  data = data.slice(channelCounts.line * 2)

  const tape = readValues(data, channelCounts.return)
  data = data.slice(channelCounts.return * 2)

  const fx_return = readValues(data, channelCounts.fx)
  data = data.slice(channelCounts.fx * 2)

  const talkback = readValues(data, channelCounts.talkback)
  data = data.slice(channelCounts.talkback * 2)

  const aux = readValues(data, channelCounts.aux)
  data = data.slice(channelCounts.aux * 2)

  const fx = readValues(data, channelCounts.fx)
  data = data.slice(channelCounts.fx * 2)

  const main = readValues(data, channelCounts.main)
  data = data.slice(channelCounts.main * 2)

  // TODO: Position of the faders for busses, groups, dcas, etc...

  return {
    LINE: line,
    AUX: aux,
    FX: fx,
    FXRETURN: fx_return,
    TALKBACK: talkback,
    MAIN: main,
    SUB: [],
    RETURN: []
    // ??? tape
  }
}
