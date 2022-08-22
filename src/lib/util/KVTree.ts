/**
 * Recursive tree builder for '/'-delimited property strings
 */

import { tokenisePath } from './treeUtil'

// This is kinda really badly written hahh..

const Parent = Symbol('parent')
const BaseSymbol = Symbol('base')
/**

  Tree
  +-Value
  +-Value
  +-Tree
  | +-Value
  | \-Tree
  |   \-Value   
  +-Value

**/

export default class KVTree {
  constructor(base = '/', parent = null) {
    this[BaseSymbol] = base
    this[Parent] = parent
  }

  register(path: string | string[], value) {
    const newPath = tokenisePath(path)
    const base = newPath.shift()

    if (newPath.length === 0) {
      this[base] = value
      return
    }
    if (!(base in this)) {
      this[base] = new KVTree(base, this)
    }
    this[base].register(newPath.join('/'), value)
  }

  get(path: string | string[]) {
    const newPath = tokenisePath(path)
    const base = newPath.shift()

    const val = this[base]
    return (newPath.length > 0) ? val?.get?.(newPath) : val
  }

  get path() {
    if (!this[Parent]) return ''
    return [this[Parent].path, this[BaseSymbol]].join('/')
  }

  toJSON() {
    return Object.entries(this).reduce((cur, [key, obj]) => {
      return ({
        ...cur,
        [key]: repr(obj)
      })
    }, {})
  }
}

function repr(obj) {
  if (obj instanceof KVTree) return obj.toJSON()
  if (obj instanceof Buffer) return obj.toString('hex')
  return obj
}
