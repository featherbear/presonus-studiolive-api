import KVTree from './KVTree'

interface FallbackInterface {
  get(path: string): any
}

/**
 * Provides a function to set/get paths  
 * Delimiter: `.` or `/`
 * @param fallback Fallback method interface that is used if the path could not be found internally
 */
export default function CacheProvider(fallback?: FallbackInterface) {
  const data = new KVTree()
  return {
    set(path: string, value: any) {
      return data.register(path, value)
    },
    get(path: string, _default = null) {
      return data.get(path) ?? fallback?.get(path) ?? _default
    }
  }
}
