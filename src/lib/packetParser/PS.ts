import type SettingType from '../types/SettingType'

export default function handlePSPacket(data) {
  const idx = data.indexOf(0x00) // Find the NULL terminator of the key string
  if (idx !== -1) {
    return {
      name: data.slice(0, idx).toString(),
      value: data.slice(idx + 3, -1).toString()
    } as SettingType
  } else {
    console.warn('Could parse PS packet', data)
  }

  return data
}
