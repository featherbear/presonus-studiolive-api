import Client from "../Client";
import { ChannelTypes } from "../constants";

type MSData = Record<ChannelTypes, number[]>;
export default function handleMSPacket(this: Client, data: Buffer): MSData {
  // First 4 bytes SHOULD be 'fdrs', but for now we won't check
  const batchType = data.slice(0, 4).toString();
  if (batchType !== "fdrs") {
    throw new Error("Invalid batch type");
  }

  const numberOfChannels = data.readUInt16LE(6); // 41 00

  data = data.slice(8);

  const channelValues: number[] = [];
  for (let i = 0; i < numberOfChannels; i++) {
    channelValues.push(data.readUInt16LE(i * 2) / 655.35);
  }

  data = data.slice(numberOfChannels * 2);

  /*******
  08
  00 00 00 00 20 00 
  01 00 20 00 03 00
  02 00 23 00 04 00
  03 00 27 00 01 00
  04 00 28 00 10 00
  05 00 38 00 04 00
  06 00 3c 00 04 00
  07 00 40 00 01 00
  *******/

  // TODO: Confirm if SUBS are included in the 16R, or if the value is set to 0
  const values: MSData = <any>{};

  const mapping: Record<number, ChannelTypes> = {
    0: "LINE",
    1: "RETURN",
    2: "FXRETURN",
    3: "TALKBACK",
    4: "AUX",
    5: "FX",
    6: "SUB",
    7: "MAIN",
    // 8: '???',
    // 0x0b: "???"
  };

  // Assign the values to the correct channel types
  const groupCount = data.readUInt8(0);
  
  // Not all packets contain all channel types
  // if (groupCount !== order.length) {
  //   throw new Error("Unexpected group count");
  // }

  for (let i = 0; i < groupCount; i++) {
    const dataOffset = 1 + i * 6;

    const groupNumber = data.readUInt16LE(dataOffset);

    const offset = data.readUInt16LE(dataOffset + 2);
    const count = data.readUInt16LE(dataOffset + 4);

    let channelType = mapping[groupNumber]
    if (!channelType) {
      console.warn("Unknown channel type", groupNumber);
      // continue
      channelType = "unknown--" + groupNumber;
    }

    values[channelType] = channelValues.slice(offset, offset + count);
  }

  // TODO: Position of the faders for busses, groups, dcas, etc...
  // not included in the usual MS packet
  return values;
}
