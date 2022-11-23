type GenericListItem = {
    name: string
    title: string
}

export type SceneItem = GenericListItem

export type ProjectItem<Extra = {}> = GenericListItem & {
    dir?: number
} & Extra

export type ChannelPresetItem = GenericListItem
