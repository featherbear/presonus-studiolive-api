import { createFragment, PacketParser } from "../types/PacketParser";

export default <PacketParser>function handleJMPacket(data) {
  return [
    createFragment(
      null,
      JSON.parse(data.slice(4).toString()),
      {
        index: 4,
        count: data.length - 4
      }
    )
  ]
}
