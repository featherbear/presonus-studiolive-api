import type SettingType from '../types/SettingType'
import { transformersPV } from '../util/transformers'
import { valueTransform } from '../util/ValueTransformer'

export default function handlePVPacket(data) {
  const idx = data.indexOf(0x00) // Find the NULL terminator of the key string
  if (idx !== -1) {
    const key = data.slice(0, idx).toString()

    // Most setting packets are `key\x00\x00\x00...`
    // but some (i.e. filter groups) have `key\x00\x00\x01`
    const partA = data.slice(idx + 1, idx + 1 + 2)
    const partB = data.slice(idx + 1 + 2)

    const value = valueTransform(key, partB, transformersPV)
    data = {
      name: key,
      value,
      partA,
      partB
    } as SettingType
  } else {
    console.warn('Could parse PV packet', data)
  }

  return data
}
