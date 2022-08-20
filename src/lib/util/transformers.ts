import { DEFAULT_TRANSFORMS, ValueTransformer, ValueTransformerLookup } from "./ValueTransformer"

type TransformerType = {
    /**
     * Transform values from the PV payload
     */
    fromPV?: ValueTransformer

    /**
     * Transform values from the UBJSON payload
     * Generally from the ZB or CK<ZB> payload
     */
    fromUB?: ValueTransformer
}

const DEFAULTS: {
    [key: string]: TransformerType
} = {
    boolean: {
        fromPV: DEFAULT_TRANSFORMS.buffer.boolean,
        fromUB: DEFAULT_TRANSFORMS.integer.boolean
    }
}

const transformers: {
    [key: string]: TransformerType
} = {
    'line.*.select': DEFAULTS.boolean,
    'line.*.mute': DEFAULTS.boolean,
    'line.*.48v': DEFAULTS.boolean,
    // 'permissions.*': DEFAULTS.boolean,
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