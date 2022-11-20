type GenericListItem = {
    name: string
    title: string
}

export type SceneItem = GenericListItem

export type ProjectItem = GenericListItem & {
    dir?: number
}

export type ChannelPresetItem = GenericListItem
