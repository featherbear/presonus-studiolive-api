// // Hacky mac hack hack
// declare global {
//   interface Buffer {
//     /** 
//      * Returns a boolean indicating if the object partially matches `buffer`
//      */
//     matches(buffer: Buffer): boolean;
//   }
// }

// Buffer.prototype.matches = function (buffer) {
//   return (buffer.length >= this.length) && this.compare(buffer, 0, this.length) === 0
// }
console.log(Buffer);

/**
 * UC..
 */
export const PacketHeader = Buffer.from([0x55, 0x43, 0x00, 0x01])

/**
 * These values seem to be related to request-response matching
 */
export const CByte = {
  A: 0x68,
  B: 0x65
}
