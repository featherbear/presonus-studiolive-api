import ZlibPayload from './src/lib/types/ZlibPayload'

const ValueSymbol = Symbol('value')
const RangeSymbol = Symbol('range')
const StringEnumSymbol = Symbol('string')
const KeySymbol = Symbol('key')

/*
    values: FluffyValues;
    strings: IndecentStrings;
    ranges: PurpleRanges;
    children: StickyChildren;
    */

type Obj<T = any> = { [key: string]: T }

export interface Range {
    min: number;
    max: number;
    def: number;
    units?: string;
}

export type InputNode = {
    children?: Obj<InputNode>
    values?: Obj<any>
    strings?: Obj<string[]>
    ranges?: Obj<Range>
}

type Node<T = any> = {
    [KeySymbol]: string[]
    [ValueSymbol]: T
    [RangeSymbol]?: InputNode['ranges']
    [StringEnumSymbol]?: InputNode['strings']
}

type nodeParserArgs = Partial<{ parent?: Node, base: Partial<Node> }>
function nodeParser(node: InputNode, { parent, base = {} }: nodeParserArgs = {}): Node {
  const root = { ...base } as Node

  function setMetadata(key, value, type: symbol) {
    if (!Object.prototype.hasOwnProperty.call(root, key)) {
      console.warn(`[${root[KeySymbol].join('/')}/${key}] did not exist, creating`)
    } else if (Object.prototype.hasOwnProperty.call(root[key], type)) {
      console.warn(`[${root[KeySymbol].join('/')}/${key}] already has metadata ${type.toString()} set, overriding`)
    }
    root[key] = { ...root[key], [type]: value }
  }

  if (node.children) {
    for (const [key, value] of Object.entries(node.children)) {
      root[key] = nodeParser(value, {
        base: {
          [KeySymbol]: [...(root?.[KeySymbol] ?? []), key]
        },
        parent: root
      })
    }
  }

  if (node.values) {
    for (const [key, value] of Object.entries(node.values)) {
      if (Object.prototype.hasOwnProperty.call(root, key)) console.warn(`[${root[KeySymbol].join('/')}/${key}] already has value set, overriding`)
      root[key] = {
        ...root[key],
        [KeySymbol]: [...(root?.[KeySymbol] ?? []), key],
        [ValueSymbol]: value
      }
    }
  }
  // Possible string enums
  if (node.strings) for (const entry of Object.entries(node.strings)) setMetadata(...entry, StringEnumSymbol)
  // Possible value range
  if (node.ranges) for (const entry of Object.entries(node.ranges)) setMetadata(...entry, RangeSymbol)

  return root
}

export default nodeParser
