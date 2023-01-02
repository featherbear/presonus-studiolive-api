import { createFragment, PacketParser } from '../types/PacketParser'
import type SettingType from '../types/SettingType'

export default <PacketParser>function handlePSPacket(data) {

  const idx = data.indexOf(0x00) // Find the NULL terminator of the key string
  if (idx !== -1) {

    let name = data.slice(0, idx).toString()
    let value = data.slice(idx + 3, -1).toString()
    
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
          count: value.length
        }
      )
    ]
  } else {
    console.warn('Could parse PS packet', data)
  }

  return [
    createFragment(null, data)
  ]
}
