export function shortToLE (i) {
  const res = Buffer.allocUnsafe(2)
  res.writeUInt16LE(i)
  return res
}

// Hacky mc hack hack
declare global {
  interface Buffer {
    /** 
     * Returns a boolean indicating if the object partially matches `buffer`
     */
    matches(buffer: Buffer): boolean;
  }
}
  
Buffer.prototype.matches = function (buffer) {
  return (buffer.length >= this.length) && this.compare(buffer, 0, this.length) === 0
}
