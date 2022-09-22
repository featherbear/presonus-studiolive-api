interface SceneOfString extends String {};

const Files = {
  CHANNEL_PRESETS: 'presets/channel',
  PROJECTS: 'presets/proj',
  SCENES_OF(file: string): SceneOfString {
    return 'presets/proj/' + file
  }
} as const

export default Files
