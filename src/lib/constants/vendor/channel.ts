/* eslint no-unused-vars: "off" */

// Enum values are set by PreSonus
// This is in order of the data received from the mixer
export const Channel = {
  LINE: 'line',
  RETURN: 'return', // e.g. Aux In 1
  FXRETURN: 'fxreturn',
  TALKBACK: 'talkback',
  AUX: 'aux',
  FX: 'fxbus',
  SUB: 'sub',
  MAIN: 'main'
}

export type ChannelTypes = keyof typeof Channel
