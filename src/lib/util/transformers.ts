import { ValueTransformerLookup } from "./treeUtil"

type TransformerType = {
    /**
     * Transform values from the PV payload
     */
    fromPV?: (value: Buffer) => any

    /**
     * Transform values from the UBJSON payload
     * Generally from the ZB or CK<ZB> payload
     */
    fromUB?: (value: Buffer) => any
}

const DEFAULTS: {
    [key: string]: TransformerType
} = {
    boolean: {
        fromPV(bytes) {
            if (bytes.equals(new Uint8Array([0x00, 0x00, 0x80, 0x3f]))) {
                return true
            } else if (bytes.equals(new Uint8Array([0x00, 0x00, 0x00, 0x00]))) {
                return false
            }

            throw new Error("Unexpected value")
        }
    }
}

const transformers: {
    [key: string]: TransformerType
} = {
    'line.*.select': DEFAULTS.boolean,
    'line.*.mute': DEFAULTS.boolean,
    'line.*.48v': DEFAULTS.boolean,
    'permissions.*':  DEFAULTS.boolean,
    // 'advancedscenefilters.*'
    // 'projectfilters.*'
    // 'channelfilters.*'
}

export const transformersPV: ValueTransformerLookup = Object.entries(transformers)
    .filter(([_, { fromPV }]) => fromPV)
    .reduce((obj, [key, { fromPV }]) => {
        return {
            ...obj,
            [key]: fromPV
        }
    }, {})

export const transformersUB: ValueTransformerLookup = Object.entries(transformers)
    .filter(([_, { fromUB }]) => fromUB)
    .reduce((obj, [key, { fromUB }]) => {
        return {
            ...obj,
            [key]: fromUB
        }
    }, {})