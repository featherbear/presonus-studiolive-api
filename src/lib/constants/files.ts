const Files = {
  CHANNEL_PRESETS: 'presets/channel',
  PROJECTS: 'presets/proj',
  SCENES_OF(file: string) {
    return 'presets/' + file
  }
}

export default Files
