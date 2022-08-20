import { DEFAULT_TRANSFORMS, IGNORE_TRANSFORM, ValueTransformer, ValueTransformerLookup } from './ValueTransformer'
import { ParamValueToLinear } from './valueUtil'

type TransformerType = {
  /**
   * Transform values from the PV payload
   */
  fromPV?: ValueTransformer | typeof IGNORE_TRANSFORM

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
  'line.*.link': DEFAULTS.boolean,
  'line.*.volume': {
    fromPV: IGNORE_TRANSFORM,
    fromUB(value: number) {
      return value * 100
    }
  }
  // 'permissions.*': DEFAULTS.boolean,
  // 'advancedscenefilters.*'
  // 'projectfilters.*'
  // 'channelfilters.*'
}

export const transformersPV: ValueTransformerLookup = Object.entries(transformers)
  .filter(([_, { fromPV }]) => fromPV && fromPV !== IGNORE_TRANSFORM)
  .reduce((obj, [key, { fromPV }]) => {
    return {
      ...obj,
      [key]: fromPV
    }
  }, {})

export const ignorePV = Object.keys(transformers)
  .filter(key => transformers[key] === IGNORE_TRANSFORM)

export const transformersUB: ValueTransformerLookup = Object.entries(transformers)
  .filter(([_, { fromUB }]) => fromUB)
  .reduce((obj, [key, { fromUB }]) => {
    return {
      ...obj,
      [key]: fromUB
    }
  }, {})
