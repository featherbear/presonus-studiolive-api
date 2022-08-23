import type SettingType from '../types/SettingType'
import { transformersPC } from '../util/transformers'
import { valueTransform } from '../util/ValueTransformer'

export default function handlePCPacket(data) {
  const idx = data.indexOf(0x00) // Find the NULL terminator of the key string
  if (idx !== -1) {
    const name = data.slice(0, idx).toString()
    return {
      name,
      value: valueTransform(name, data.slice(idx + 3), transformersPC)
    } as SettingType
  } else {
    console.warn('Could parse PC packet', data)
  }

  return data
}
