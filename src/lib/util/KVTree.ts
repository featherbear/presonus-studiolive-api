/**
 * Recursive tree builder for '/'-delimited property strings
 */

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

export default class Tree {
  constructor(base = '/', parent = null) {
    this[BaseSymbol] = base
    this[Parent] = parent
  }

  register(path, value) {
    const newPath = path.split('/')
    const base = newPath.shift()

    if (newPath.length === 0) {
      this[base] = value
      return
    }
    if (!(base in this)) {
      this[base] = new Tree(base, this)
    }
    this[base].register(newPath.join('/'), value)
  }

  get path() {
    if (!this[Parent]) return ''
    return [this[Parent].path, this[BaseSymbol]].join('/')
  }
}
