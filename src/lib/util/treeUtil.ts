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

export function simplifyPathTokens(path: string | string[]) {
  let tokens = tokenisePath(path)
  /**
   * Key replacements
   */
  const slice = tokens.slice(-2)
  if (slice[0] === 'dca') {
    const old = [...tokens]
    tokens = [...tokens.slice(0, -2), ...slice.slice(1)]
    logger.debug({ oldPath: old.join('.'), newPath: tokens.join('.') }, 'Simplified path token')
  }

  return tokens
}
