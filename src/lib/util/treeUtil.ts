/**
 * Split a path string into tokens  
 * Delimiter: `.` or `/`  
 * If `key` is already an array, pass through the value
 * 
 * @example 
 * tokenisePath('this.is.a.key') // => ['this', 'is', 'a', 'key']
 * tokenisePath('this/is/a/key') // => ['this', 'is', 'a', 'key']
 * tokenisePath(['this', 'is', 'a', 'key']) // => ['this', 'is', 'a', 'key'] // passthrough
 */
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

export type ValueTransformerLookup = {
  [prefix: string]: (value) => any
}
/**
 * Value transformers allow values to be processed different depending on their key
 */
export function valueTransform(path: string | string[], value: any, valueTransformers: ValueTransformerLookup): typeof value {
  const symbolPath = tokenisePath(path)
  
  const doesLookupMatch = (lookup: string) => {
    const lookupPath = tokenisePath(lookup)
    const lastIdx = Math.min(symbolPath.length, lookupPath.length)

    let lookupIdx = 0
    let symbolIdx = 0

    while (symbolIdx < lastIdx) {
      if ([symbolPath[symbolIdx], '*'].includes(lookupPath[lookupIdx])) {
        // Path matches, or wildcard match
        symbolIdx++
        lookupIdx++
        continue
      } else if (lookupPath[lookupIdx] === '**') {
        lookupIdx++

        // Double wildcard on last token, accept all
        if (lookupIdx === lastIdx) break

        // Find the position of the token after the wildcard
        symbolIdx = symbolPath.indexOf(lookupPath[lookupIdx], lookupIdx)

        // const jumpIdx = symbolPath.indexOf(lookupPath[lookupIdx + 1], lookupIdx + 1)
        // if (jumpIdx === -1) return false
        // symbolIdx = jumpIdx
      } else {
        // Token doesn't match
        return false
      }
    }

    // you reached the end, nice!
    return true
  }

  for (const [lookup, transformer] of Object.entries(valueTransformers)) {
    if (doesLookupMatch(lookup)) {
      value = transformer(value)
      break
    }
  }

  return value
}

export function simplifyPathTokens(path: string | string[]) {
  let tokens = tokenisePath(path)
  /**
   * Key replacements
   */
  const slice = tokens.slice(-2)
  if (slice[0] === 'dca') {
    // const old = [...tokens]
    tokens = [...tokens.slice(0, -2), ...slice.slice(1)]
    // console.log(`Converted ${old.join('/')} to ${tokens.join('/')}`)
  }

  return tokens
}
