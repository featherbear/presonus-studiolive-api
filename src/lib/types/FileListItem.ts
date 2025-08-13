type GenericListItem = {
    name: string
    title: string
}

export type SceneItem = GenericListItem

export type ProjectItem<Extra = unknown> = GenericListItem & {
    dir?: number
} & Extra

export type ChannelPresetItem = GenericListItem
