PreSonus StudioLive API (Node.js)
---

# Install
There's no dependencies so just download a copy of [`PreSonusAPI.js`](https://raw.githubusercontent.com/featherbear/PreSonus-API/master/PreSonusAPI.js)  

# Usage
`const { Client, MessagePrefix } = require('./PreSonusAPI')`

# Documentation

* `new Client(host: int, port: int)`
Creates a Client object that will later connect to the console at `host`:`port`

* `client.connect()`
Connect to the console

* `client.listen()`
Start the metering server

* `client.stop()`
Stop the metering server

* `client.setUDPServerPort(port: int)`
Set the listen port of the metering server.  
Can only be run while the metering server is not running

* `client.on(evtName: str, fn: function)`
Listen for `evtName` events that will call `fn`

* `client.sendList(path: str)`
Request `path` from the console

## Events
Events are splitted into Protocol Events (event codes that are part of the protocol), and custom events defined by this API.  

### Protocol Events
* `Hello`
* `JSON`
* `Setting`
* `Settings2`
* `FileResource`
* `FileResource2`
* `CompressedUnknown`

### Custom Events
* `connected` - Emitted when the client has successfully connected to the console
* `listening` - Emitted when the client has successfully started the meter server
* `meter` | `meterData` - Emitted when metering data is received

## Low(er) level access
* `client.emit(evttName: str, ...data)`
Emits an event for `evtName` with `data`

* `client._sendPacket(messageCode: bytes[2], data, <customA>, <customB>)`
Sends a packet to the server, messageCode is a two byte long string.  
`customA` is an optional single byte character  
`customB` is an optional single byte character  

* `client.conn` => TCP socket connection

## Metering
Metering data is stored as a dictionary

```
{
  input: [..., ..., ... /* 32 */], // Input signal
  chain1input: input
  chain1output: [..., ..., ... /* 32 */], // First FX chain
  chain2input: chain1output,
  chain2output: [..., ..., ... /* 32 */], // Second FX chain
  chain3input: chain2output,
  chain3output: [..., ..., ... /* 32 */], // Third FX chain
  chain4input: chain3output,
  chain4output: [..., ..., ... /* 32 */], // Fourth FX chain
  level: chain4output
}
```