/* eslint no-unused-vars: "off" */

/**
 * These values seem to be related to request-response matching
 */
export enum CByte {
  A = 0x68,
  B = 0x65
}

/**
 * UC..
 */
export const PacketHeader = Buffer.from([0x55, 0x43, 0x00, 0x01])
