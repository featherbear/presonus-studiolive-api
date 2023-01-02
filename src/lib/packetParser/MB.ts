import Client from '../Client'
import { ChannelTypes } from '../constants'
import { createFragment, PacketParser } from '../types/PacketParser';


enum DataType {
    INPUT,
    RETURN,
    FX_RETURN,
    TALKBACK,
    AUX,
    FX,
    UNKNOWN,
    MAIN,
}

/**
 * FIXME: TODO: Implement
 */
export default <PacketParser>function handleMBPacket(this: Client, packet: Buffer) {
    // First 4 bytes SHOULD be 'fdrs', but for now we won't check
    console.log(packet.toString('hex'), packet.length);


    let type = packet.slice(0, 4).toString()
    if (type !== 'mt64') {
        logger.error("Unexpected type in MB message")
        return
    }

    let dataLength = packet.readUInt16LE(6)
    let dataBuffer = packet.slice(8, dataLength + 8)

    let mapLength = packet[dataLength + 8]

    {
        let mapBuffer = packet.slice(dataLength + 8 + 1)

        for (let i = 0; i < mapLength; i++) {
            let mapping = mapBuffer.slice(i * 6, (i * 6) + 6)
            let type: DataType = mapping[0]
            let strip = mapping[1]
            let startIdx = mapping.readUInt16LE(2)
            let count = mapping.readUInt16LE(4)
            let data = dataBuffer.slice(startIdx, startIdx + count)

            console.log(i, "-", type, strip, data);
        }
    }

    return [createFragment(null, null)]
    // return { type, data: packet }
}
