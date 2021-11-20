/* eslint no-unused-vars: "off" */

export enum LINE {
  CHANNEL_1 = 1,
  CHANNEL_2 = 2,
  CHANNEL_3 = 3,
  CHANNEL_4 = 4,
  CHANNEL_5 = 5,
  CHANNEL_6 = 6,
  CHANNEL_7 = 7,
  CHANNEL_8 = 8,
  CHANNEL_9 = 9,
  CHANNEL_10 = 10,
  CHANNEL_11 = 11,
  CHANNEL_12 = 12,
  CHANNEL_13 = 13,
  CHANNEL_14 = 14,
  CHANNEL_15 = 15,
  CHANNEL_16 = 16,
  CHANNEL_17 = 17,
  CHANNEL_18 = 18,
  CHANNEL_19 = 19,
  CHANNEL_20 = 20,
  CHANNEL_21 = 21,
  CHANNEL_22 = 22,
  CHANNEL_23 = 23,
  CHANNEL_24 = 24,
  CHANNEL_25 = 25,
  CHANNEL_26 = 26,
  CHANNEL_27 = 27,
  CHANNEL_28 = 28,
  CHANNEL_29 = 29,
  CHANNEL_30 = 30,
  CHANNEL_31 = 31,
  CHANNEL_32 = 32
}

export enum AUX {
  AUX_1 = 1,
  AUX_2 = 2,
  AUX_3 = 3,
  AUX_4 = 4,
  AUX_5 = 5,
  AUX_6 = 6,
  AUX_7 = 7,
  AUX_8 = 8,
  AUX_9 = 9,
  AUX_10 = 10,
  AUX_11 = 11,
  AUX_12 = 12,
  AUX_13 = 13,
  AUX_14 = 14,
  AUX_15 = 15,
  AUX_16 = 16
}

export enum SUB {
  SUB_A = 1,
  SUB_B = 2,
  SUB_C = 3,
  SUB_D = 4
}

export enum FX {
  FX_1 = 1,
  FX_2 = 2,
  FX_3 = 3,
  FX_4 = 4
}

export enum FXRETURN {
  FXRETURN_1 = 1,
  FXRETURN_2 = 2,
  FXRETURN_3 = 3,
  FXRETURN_4 = 4
}

export enum MAIN {
  MAIN_CH = 1
}

export enum TALKBACK {
  TALKBACK_CH = 1
}

export type CHANNELS = LINE | AUX | SUB | FX | FXRETURN | MAIN | TALKBACK
