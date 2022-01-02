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
