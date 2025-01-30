/* eslint no-unused-vars: "off" */

// Values are set by PreSonus
export const Channel = {
  LINE: 'line',
  MAIN: 'main',
  TALKBACK: 'talkback',
  AUX: 'aux',
  SUB: 'sub',
  FX: 'fxbus',
  FXRETURN: 'fxreturn',
  RETURN: 'return', // e.g. Aux In 1
  DCA: 'filtergroup'
}

export type ChannelTypes = keyof typeof Channel
