import type { Range } from './ZlibPayload'

export type Children<InnerType> = {
    children: InnerType
}

export type Values<InnerType> = {
    values: InnerType
}

export type Strings<InnerType extends { [_ in keyof (InnerType)]: (number | any) }> = {
    strings: InnerType
}

export type Ranges<InnerType extends { [_ in keyof (InnerType)]: Range<unknown> }> = {
    ranges: InnerType
}

export type States<InnerType> = {
    states: InnerType
}

export type GenericRanges = Ranges<{ [key: string]: Range }>

export type GenericChildren<InnerType> = Children<{
    [key: string]: InnerType
}>

export type GenericValues<InnerType> = Values<{
    [key: string]: InnerType
}>
