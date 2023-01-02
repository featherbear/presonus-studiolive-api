import { createFragment, PacketParser } from '../types/PacketParser'
import type SettingType from '../types/SettingType'
import { transformersPV } from '../util/transformers'
import { valueTransform } from '../util/ValueTransformer'

export default <PacketParser>function handlePVPacket(data) {

  const idx = data.indexOf(0x00) // Find the NULL terminator of the key string
  if (idx !== -1) {
    const name = data.slice(0, idx).toString()

    // Most setting packets are `key\x00\x00\x00...`
    // but some (i.e. filter groups) have `key\x00\x00\x01`
    const partA = data.slice(idx + 1, idx + 3 /* 1+2 */)
    const partB = data.slice(idx + 3)

    const value = valueTransform(name, partB, transformersPV)

    return [
      createFragment(
        'name', name, {
        index: 0,
        count: idx,
        description: "Key name"
      }
      ),
      createFragment('value', value, {
        index: idx + 3,
        count: partB.length,
        description: "Key value"
      }),

      createFragment('partA', partA, {
        index: idx + 1, count: 2
      }),
      createFragment('partB', partB, {
        index: idx + 3, count: partB.length
      }),
    ]
  } else {
    console.warn('Could parse PV packet', data)
  }

  return [
    createFragment(null, data)
  ]
}
