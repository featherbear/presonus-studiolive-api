import { createFragment, PacketParser } from '../types/PacketParser'
import type SettingType from '../types/SettingType'
import { transformersPC } from '../util/transformers'
import { valueTransform } from '../util/ValueTransformer'

export default <PacketParser>function handlePCPacket(data) {
  const idx = data.indexOf(0x00) // Find the NULL terminator of the key string
  if (idx !== -1) {
    const name = data.slice(0, idx).toString()
    const value = valueTransform(name, data.slice(idx + 3), transformersPC)

    return [
      createFragment('name', name,
        {
          index: 0,
          count: name.length,
        }),
      createFragment(
        'value', value,
        {
          index: idx + 3,
          count: data.length - (idx + 3)
        }
      )
    ]

  } else {
    console.warn('Could parse PC packet', data)
  }

  return [
    createFragment(null, data)
  ]
}
