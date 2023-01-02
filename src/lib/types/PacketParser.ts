/**
 * Payload information
 */
type Metadata = {
    description?: string
} &
    ({
        index?: never
        count?: never
    } | {
        index: number
        count: number
    })


/**
 * Key - Name of the object key  
 * Value - Value of the object key  
 * Metadata - Optional information about the data  
 */
type Fragment = [string | typeof UnnamedKey, unknown, Metadata?]

export const UnnamedKey = Symbol()

export type ParsedPacket = Fragment[]

export function createFragment(key: string, value: unknown, metadata?: Metadata){
    if (metadata) return <Fragment>[key ?? UnnamedKey, value, metadata]
    return <Fragment>[key ?? UnnamedKey, value]
}

export type PacketParser = (packet: Buffer) => ParsedPacket
