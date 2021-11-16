export default function zlibParser(buf: Buffer) {
  let idx = 0;
  if (buf[idx++] != 0x7b) return null

  let rootTree = {}
  let workingSet = [rootTree]

  while (idx != buf.length) {
    // console.log('----- NEW PASS ------');
    // console.log('current IDX', idx, "0x" + idx.toString(16));

    let keyData: Buffer | null
    if (Array.isArray(workingSet[0])) {
      // nested !important
      if (buf[idx] == 0x5D /* ] */) {
        idx++;
        workingSet.shift()
        continue
      }
    } else {
      let controlCharacter = buf[idx++]

      if (controlCharacter == 0x7D /* } */) {
        // Exit leaf node
        workingSet.shift()
        continue

      }

      if (controlCharacter != 0x69 /* i */) {
        // console.error('(A) failed to find delimiter')
        throw new Error('(A) failed to find delimiter')
        break
      }

      var length = buf[idx++]
      // console.log("keyLength:", length);

      keyData = buf.slice(idx, idx + length)
      // console.log("keyData", keyData.toString());
      idx += length

    }

    let type = buf[idx++]
    // console.log("type", type, "0x" + type.toString(16));

    switch (type) {
      case 0x7B /* { */: {
        // Create new leaf dictionary
        let leaf = {}

        if (Array.isArray(workingSet[0])) {
          workingSet[0].push(leaf)
        } else {
          workingSet[0][keyData.toString()] = leaf
        }
        workingSet.unshift(leaf)
        continue
      }

      case 0x5B /* [ */: {
        // Create new leaf array
        let leaf = []

        if (Array.isArray(workingSet[0])) {
          workingSet[0].push(leaf)
        } else {
          workingSet[0][keyData.toString()] = leaf
        }

        workingSet.unshift(leaf)
        continue
      }


      case 0x53 /* S */: {
        if (buf[idx++] != 0x69) {
          // console.error('(B) failed to find delimiter')
          throw new Error('(B) failed to find delimiter')

          break
        }

        var length = buf[idx++]
        // console.log("String length:", length);
        break;
      }

      case 0x64 /* d */: {
        var length = 4;
        break;
      }

      case 0x69 /* i */: {
        // Single byte?
        var length = 1;
        break;
      }

      default: {
        throw new Error("Unknown type " + type)
        break
      }
    }

    let valueData = buf.slice(idx, idx + length)
    let value;

    switch (type) {
      case 0x53 /* S */: {
        value = valueData.toString()
        break;
      }
      case 0x64 /* d */: {
        // TODO:
        value = valueData.readUInt32LE()
        break;
      }

      case 0x69 /* i */: {
        // Single byte?
        value = valueData.readUInt8()
        break;
      }

      default: {
        value = valueData.toString()
      }
    }

    idx += length

    if (Array.isArray(workingSet[0])) {
      workingSet[0].push(value)
    } else {
      workingSet[0][keyData.toString()] = value
    }

  }

  return rootTree

}