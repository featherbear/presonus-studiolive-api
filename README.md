PreSonus StudioLive III API
---

An unofficial API for the StudioLive III consoles from PreSonus.  

Protocol research was done in Python, and can be found in the `research` directory.  
The Python client currently has more functionality than the Node.js API.

# Install

`npm install featherbear/presonus-studiolive-api`

# Usage

`const { Client, MessageTypes } = require('presonus-studiolive-api')`

# Documentation

* `new Client(host: int, port: int)`  
Creates a Client object that will later connect to the console at `host`:`port`

* `client.connect()`  
Connect to the console

<!-- * `client.listen()`  
Start the metering server

* `client.stop()`  
Stop the metering server

* `client.setUDPServerPort(port: int)`  
Set the listen port of the metering server.  
Can only be run while the metering server is not running -->

* `client.on(evtName: str, fn: function)`  
Listen for `evtName` events that will call `fn`

* `client.sendList(path: str)`  
Request `path` from the console

## Events

Events are split into Protocol Events (event codes that are part of the protocol), and custom events defined by this API.  

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

* `client.emit(evtName: str, ...data)`  
Emits an event for `evtName` with `data`

* `client._sendPacket(messageCode: bytes[2], data, <customA>, <customB>)`  
Sends a packet to the server, messageCode is a two byte long string.  
`customA` is an optional single byte character  
`customB` is an optional single byte character  

* `client.conn` => TCP socket connection

## Metering

Metering is currently unavailable in the Node.js version

<!-- Metering data is stored as a dictionary -->


<!-- ```
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
``` -->