import { transformersUB } from '../transformers'
import { valueTransform } from '../ValueTransformer'

export const ZlibValueSymbol = Symbol('value')
export const ZlibRangeSymbol = Symbol('range')
export const ZlibStringEnumSymbol = Symbol('string')
export const ZlibKeySymbol = Symbol('key')

type Obj<T = any> = { [key: string]: T }

export interface Range {
  min: number;
  max: number;
  def: number;
  units?: string;
}

export type ZlibInputNode = {
  children?: Obj<ZlibInputNode>
  values?: Obj<any>
  strings?: Obj<string[]>
  ranges?: Obj<Range>
}

export type ZlibNode<T = any> = {
  [ZlibKeySymbol]: string[]
  [ZlibValueSymbol]: T
  [ZlibRangeSymbol]?: ZlibInputNode['ranges']
  [ZlibStringEnumSymbol]?: ZlibInputNode['strings']
}

type zlibNodeParserOptArgs = Partial<{
  /**
   * Parent node
   */
  parent?: ZlibNode,

  /**
   * Node root value
   */
  base?: Partial<ZlibNode>,
}>

/**
 * Parse deserialised zlib data into an object tree
 */
export function zlibParseNode(node: ZlibInputNode, { base = {} }: zlibNodeParserOptArgs = {}): ZlibNode {
  const root = { ...base } as ZlibNode

  function setMetadata(key, value, type: symbol) {
    if (!Object.prototype.hasOwnProperty.call(root, key)) {
      console.warn(`[${root[ZlibKeySymbol].join('/')}/${key}] did not exist, creating`)
    } else if (Object.prototype.hasOwnProperty.call(root[key], type)) {
      console.warn(`[${root[ZlibKeySymbol].join('/')}/${key}] already has metadata ${type.toString()} set, overriding`)
    }
    root[key] = { ...root[key], [type]: value }
  }

  // #region Tree generation

  // eslint-disable-next-line
  const keyHandlers: { [k in keyof ZlibInputNode]: (data) => void } & { [k: string]: ((data) => void) | null } = {
    children(data) {
      for (const [key, value] of Object.entries(data)) {
        root[key] = zlibParseNode(value, {
          base: {
            [ZlibKeySymbol]: [...(root?.[ZlibKeySymbol] ?? []), key]
          },
          parent: root,
        })
      }
    },
    values(data) {
      for (let [key, value] of Object.entries(data)) {
        if (Object.prototype.hasOwnProperty.call(root, key)) console.warn(`[${root[ZlibKeySymbol].join('/')}/${key}] already has value set, overriding`)

        const symbolPath = [...(root?.[ZlibKeySymbol] ?? []), key]

        // TODO: Implement partial wildcard?
        // e.g. aa.bb.cc* or aa.bb.*cc or aa.bb.c*c
        /**
         * Value transformers
         */
        value = valueTransform(symbolPath, value, transformersUB)

        root[key] = {
          ...root[key],
          [ZlibKeySymbol]: symbolPath,
          [ZlibValueSymbol]: value // FIXME: Put this through some sort of endian converter / scaler?
        }
      }
    },
    strings(data) {
      for (const entry of Object.entries(data)) setMetadata(...entry, ZlibStringEnumSymbol)
    },
    ranges(data) {
      // FIXME: Put this through some sort of endian converter / scaler?
      for (const entry of Object.entries(data)) setMetadata(...entry, ZlibRangeSymbol)
    },
    id: null,
    shared: null,
    classId: null,
    states: null
  }

  // Use key handler lookup to operate on child key values
  for (const [key, data] of Object.entries(node)) {
    if (Object.prototype.hasOwnProperty.call(keyHandlers, key)) {
      keyHandlers[key]?.(data)
    } else {
      console.warn(`[${root[ZlibKeySymbol]?.join('/') ?? []}] unexpected child key ${key}`)
    }
  }
  // #endregion

  // Now, check that all added elements have a key, and therefore also
  // have a value as keys are only added on child nodes and value methods
  for (const [key, value] of Object.entries(root)) {
    if (!Object.prototype.hasOwnProperty.call(value, ZlibKeySymbol)) {
      console.warn(`[${root[ZlibKeySymbol].join('/')}] finished building, but ${key} did not have a value`)
    }

    // Delete the key, as we've finished building
    delete value[ZlibKeySymbol]
  }

  return root
}

export default zlibParseNode
