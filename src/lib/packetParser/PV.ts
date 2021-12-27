import type SettingType from "../types/SettingType"
import { onOff_decode } from "../util/MessageProtocol"

export default function handlePVPacket(data) {
    const idx = data.indexOf(0x00) // Find the NULL terminator of the key string
    if (idx !== -1) {
        const key = data.slice(0, idx).toString()

        // Most setting packets are `key\x00\x00\x00...`
        // but some (i.e. filter groups) have `key\x00\x00\x01`
        const partA = data.slice(idx + 1, idx + 3 /* 1+2 */)
        const partB = data.slice(idx + 3)
        data = {
            name: key,
            value: partB.length ? onOff_decode(partB) : partA
        } as SettingType
    }
    return data
}