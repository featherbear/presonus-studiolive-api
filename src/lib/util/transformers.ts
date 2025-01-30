import { DEFAULT_TRANSFORMS, IGNORE, ValueTransformer, ValueTransformerLookup } from './ValueTransformer'

type TransformerType = {
  /**
   * Transform values from the PV payload
   */
  fromPV?: ValueTransformer | typeof IGNORE

  /**
   * Transform values from the PC payload
   */
  fromPC?: ValueTransformer

  /**
   * Transform values from the UBJSON payload
   * Generally from the ZB or CK<ZB> payload
   */
  fromUB?: ValueTransformer
}

/**
 *
 * Ignoring this type because IntelliSense stops offering suggestions
 *
 * {
 * [key: string]: TransformerType
 * }
 *
*/
const DEFAULTS = {
  boolean: {
    fromPV: DEFAULT_TRANSFORMS.buffer.boolean,
    fromUB: DEFAULT_TRANSFORMS.integer.boolean
  },
  /**
   * Define a key with passthrough methods to skip wildcard matching
   */
  passthrough: {
    fromPV: x => x,
    fromUB: x => x,
    fromPC: x => x
  }
}

const transformers: {
  [key: string]: TransformerType
} = {
  'line.*.select': DEFAULTS.boolean,
  '**.mute': DEFAULTS.boolean,
  '**.solo': DEFAULTS.boolean,
  'line.*.48v': DEFAULTS.boolean,
  'line.*.link': DEFAULTS.boolean,
  '**.assign_*': DEFAULTS.boolean,
  'line.*.dca.volume': {
    fromPV: IGNORE
  },
  '*.ch*.volume': {
    fromPV: DEFAULT_TRANSFORMS.buffer.float,
    fromUB(value: number) {
      return value * 100
    }
  },
  ...{
    'line.*.dca.aux*': {
      fromPV: IGNORE
    },
    'fxreturn.*.dca.aux*': {
      fromPV: IGNORE
    }
  },
  ...{
    'line.*.aux*': {
      fromPV: DEFAULT_TRANSFORMS.buffer.float
    },
    'fxreturn.*.aux*': {
      fromPV: DEFAULT_TRANSFORMS.buffer.float
    },
    'return.*.aux*': {
      fromPV: DEFAULT_TRANSFORMS.buffer.float
    },
    'talkback.*.aux*': {
      fromPV: DEFAULT_TRANSFORMS.buffer.float
    }
  },
  'line.*.pan': {
    fromPV: DEFAULT_TRANSFORMS.buffer.float
  },
  'line.*.stereopan': {
    fromPV: DEFAULT_TRANSFORMS.buffer.float
  },
  'line.*.FX*': {
    fromPV: DEFAULT_TRANSFORMS.buffer.float
  },
  'line.*.dca.fx*': {
    fromPV: IGNORE
  },
  '**.color': {
    fromPC(data: Buffer) {
      return data.toString('hex')
    },
    fromUB(data: bigint) {
      const buffer = Buffer.allocUnsafe(8)

      if (typeof data === 'bigint') {
        buffer.writeBigInt64BE(data)
        buffer.reverse()
      } else {
        if (data === 0) return null
        buffer.writeInt32LE(data)
      }

      return buffer.slice(0, 4).toString('hex')
    }

  },
  'permissions.access_code': DEFAULTS.passthrough,
  'permissions.device_list': DEFAULTS.passthrough,
  'permissions.mix_permissions': DEFAULTS.passthrough,
  'permissions.*': DEFAULTS.boolean
  // 'advancedscenefilters.*'
  // 'projectfilters.*'
  // 'channelfilters.*'
}

export const transformersPV: ValueTransformerLookup = Object.entries(transformers)
  .filter(([_, { fromPV }]) => fromPV && fromPV !== IGNORE)
  .reduce((obj, [key, { fromPV }]) => {
    return {
      ...obj,
      [key]: fromPV
    }
  }, {})

export const ignorePV = Object.keys(transformers)
  .filter(key => transformers[key].fromPV === IGNORE)

export const transformersPC: ValueTransformerLookup = Object.entries(transformers)
  .filter(([_, { fromPC }]) => fromPC)
  .reduce((obj, [key, { fromPC }]) => {
    return {
      ...obj,
      [key]: fromPC
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
