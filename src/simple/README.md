# PreSonus StudioLive API | Simple API
---

A convenience wrapper to manage volume levels and mute states of channels.

---

## Usage

This wrapper attaches common events to the client. Refer to the [main project](https://featherbear.cc/presonus-studiolive-api) for other functionality

* `<Client>.on('level', (data) => {...})`
* `<Client>.on('mute', (data) => {...})`

## Example

```ts
import Client from 'presonus-studiolive-api/simple'

let client = new Client("192.168.0.21")

client.on('level', (data) => {
    // data.channel.type
    // data.channel.channel
    // data.level
    // data.type == 'level'
})

client.on('mute', (data) => {
    // data.channel.type
    // data.channel.channel
    // data.status
    // data.type == 'mute'
})

client.connect().then(() => {
    // Set to 100%
    client.setLevel({
        type: 'LINE',
        channel: 13
    }, 100)

    // Mute
    client.mute({
        type: 'LINE',
        channel: 17
    })
})
```
