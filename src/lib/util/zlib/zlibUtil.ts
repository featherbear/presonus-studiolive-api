/**
 * Parse Zlib packets
 */

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
  
  return zlibParseNode(payload as unknown as ZlibInputNode)
}

export default zlibParse

export function getZlibValue(node: ZlibNode, key: string | string[]) {
  if (typeof key === 'string') {
    if (key.includes('/')) {
      key = key.split('/')
    } else {
      key = key.split('.')
    }
  }

  const tokens = [...key]
  let cur = node
  while (cur && tokens.length > 0) {
    const next = tokens.shift()
    cur = cur[next]
  }

  // Peek into value if it has such property
  cur = cur?.[ZlibValueSymbol] ?? cur

  if (cur === undefined) {
    // console.warn(`Could not get value of ${key.join('/')}`)
    return null
  }

  return cur
}
