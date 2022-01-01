import { tokenisePath } from './zlibUtil'

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
   * Currently unused
   */
  parent?: ZlibNode,

  /**
   * Node root value
   */
  base?: Partial<ZlibNode>,

  /**
   * Value transformers allow values to be processed different depending on their key
   */
  valueTransformers?: {
    [prefix: string]: (value) => any
  }
}>

/**
 * Parse deserialised zlib data into an object tree
 */
export function zlibParseNode(node: ZlibInputNode, { base = {}, valueTransformers }: zlibNodeParserOptArgs = {}): ZlibNode {
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
          valueTransformers
        })
      }
    },
    values(data) {
      for (let [key, value] of Object.entries(data)) {
        if (Object.prototype.hasOwnProperty.call(root, key)) console.warn(`[${root[ZlibKeySymbol].join('/')}/${key}] already has value set, overriding`)

        const symbolPath = [...(root?.[ZlibKeySymbol] ?? []), key]

        /**
         * Value transformers
         */
        if (valueTransformers) {
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
        }

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
