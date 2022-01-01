/**
 * Parse Zlib packets
 */

import { onOff } from '../MessageProtocol'
import zlibDeserialiseBuffer from './zlibDeserialiser'
import zlibParseNode, { ZlibInputNode, ZlibNode, ZlibValueSymbol } from './zlibNodeParser'

/**
 * Deserialise and parse a zlib buffer into an object tree
 */
export function zlibParse(zlib: Buffer) {
  const payload = zlibDeserialiseBuffer(zlib)
  if (payload.id !== 'Synchronize') {
    console.warn('Unexpected zlib payload id', payload.id)
    return
  }

  return zlibParseNode(payload as unknown as ZlibInputNode, {
    valueTransformers: {
      'permissions.access_code'() { return '*REDACTED*' },

      ...[
        // Add values which should be transformed with onOff byte decoding
        'permissions.*',
        'advancedscenefilters.*',
        'projectfilters.*',
        'channelfilters.*',
        'line.*.select',
        'line.*.mute',
        'line.*.48v'
      ].reduce((obj, val) => ({
        ...obj,
        [val]: (v) => Number.isFinite(v) ? onOff.decode(v) : v
      }), {})
    }
  })
}

export default zlibParse

export function tokenisePath(key: string | string[]): string[] {
  if (typeof key === 'string') {
    if (key.includes('/')) {
      key = key.split('/')
    } else {
      key = key.split('.')
    }
  }
  return key
}

export function getZlibValue(node: ZlibNode, key: string | string[]) {
  let tokens = [...tokenisePath(key)]
  
  /**
   * Key replacements
   */
  {
    // TODO: This occurs during control packets sent TO the mixer as well
    const slice = tokens.slice(-2)
    if (slice[0] === 'dca') {
      const old = [...tokens]
      tokens = [...tokens.slice(0, -2), ...slice.slice(1)]
      console.log(`Converted ${old.join('/')} to ${tokens.join('/')}`)
    }
  }

  let cur = node
  while (cur && tokens.length > 0) {
    const next = tokens.shift()
    cur = cur[next]
  }

  // Peek into value if it has such property
  cur = cur?.[ZlibValueSymbol] ?? cur

  if (cur === undefined) return null

  return cur
}
