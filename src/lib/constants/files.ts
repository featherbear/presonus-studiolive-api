type SceneOfString = string;

export const CHANNEL_PRESETS = 'presets/channel'
export const PROJECTS = 'presets/proj'

export function SCENES_OF(file: string): SceneOfString {
  return 'presets/proj/' + file
}
