export default function handleJMPacket(data) {
  return JSON.parse(data.slice(4))
}
