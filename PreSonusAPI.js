"use strict";

// ///

let MessagePrefix = {
  KeepAlive: "KA",
  Hello: "UM",
  JSON: "JM",
  Setting: "PV",
  Settings2: "PL",
  FileResource: "FR",
  FileResource2: "FD",
  UNKNOWN_REPLY: "BO",
  CompressedUnknown: "CK"
};
for (let str in MessagePrefix) MessagePrefix[MessagePrefix[str]] = str;

function shortToLE(i) {
  let res = Buffer.allocUnsafe(2);
  res.writeUInt16LE(i);
  return res;
}

function craftSubscribe(overrides) {
  let data = {
    id: "Subscribe",
    clientName: "UC-Surface",
    clientInternalName: "ucremoteapp",
    clientType: "Android",
    clientDescription: "zedX",
    clientIdentifier: "133d066a919ea0ea",
    clientOptions: "perm users levl redu rtan",
    clientEncoding: 23106
  };
  if (overrides) data = { ...data, ...overrides };

  return Buffer.concat([
    Buffer.from([0xf2, 0x00, 0x00, 0x00]),
    Buffer.from(JSON.stringify(data, null, " "))
  ]);
}
const net = require("net");
const dgram = require("dgram");

class Client {
  constructor(host, port) {
    this.serverAddress = host;
    this.serverPort = port;
    this._packetHeader = Buffer.from([0x55, 0x43, 0x00, 0x01]); // UC..
    this._A = 0x68; // These values might come from
    this._B = 0x65; // the broadcast discovery

    this._UdpServerPort = 52704;

    {
      // Start UDP Server to listen to Metering data
      let UDPserver = dgram.createSocket("udp4");

      UDPserver.on("error", err => {
        UDPserver.close();
        throw Error("UDP error:\n" + err.stack);
      });

      UDPserver.on("message", (msg, rinfo) => {
        //   console.log(
        //     "(UDP) got data of length " + msg.length + "..." + " from " + rinfo.address + ":" + rinfo.port
        //   );
      });

      UDPserver.on("listening", () => {
        var address = UDPserver.address();
        console.info(
          `UDP server listening on ${address.address}:${address.port}`
        );
      });
      UDPserver.bind(this._UdpServerPort);
      this.meterListener = UDPserver;
    }

    {
      let TCPclient = new net.Socket();
      TCPclient.payloadLengthRemaining = 0;
      TCPclient.payloadTemp = Buffer.allocUnsafe(0);
      TCPclient.on("data", data => {
        let buffData = Buffer.from(data);
        while (buffData.length != 0) {
          if (buffData.slice(0, 4).equals(this._packetHeader)) {
            let correctLength = buffData.readUInt16LE(4);

            if (buffData.length - 6 < correctLength) {
              TCPclient.payloadTemp = buffData;
              TCPclient.payloadLengthRemaining =
                correctLength - (buffData.length - 6);
              return;
            } else {
              this.handleRecvPacket(buffData.slice(0, correctLength + 6));

              buffData = buffData.slice(correctLength + 6);

              TCPclient.payloadLengthRemaining = 0;
              TCPclient.payloadTemp = Buffer.allocUnsafe(0);
            }
          } else if (TCPclient.payloadLengthRemaining > 0) {
            let extractN = Math.min(
              TCPclient.payloadLengthRemaining,
              buffData.length
            );

            TCPclient.payloadTemp = Buffer.concat([
              TCPclient.payloadTemp,
              buffData.slice(0, extractN)
            ]);
            buffData = buffData.slice(extractN);
            TCPclient.payloadLengthRemaining -= extractN;

            if (TCPclient.payloadLengthRemaining == 0) {
              this.handleRecvPacket(TCPclient.payloadTemp);
              TCPclient.payloadTemp = Buffer.allocUnsafe(0);
            }

            if (TCPclient.payloadLengthRemaining < 0) {
              throw Error("Extracted more bytes than the payload required");
            }
          }
        }
      });

      TCPclient.on("close", function() {
        console.log("Connection closed");
      });

      TCPclient.connect(port, host, () => {
        // Tell mixer to send metering data to our UDP server
        this._sendPacket(
          MessagePrefix.Hello,
          shortToLE(this._UdpServerPort),
          0x00
        );

        // Send subscribe request
        this._sendPacket(MessagePrefix.JSON, craftSubscribe());
        this.sendList("presets/scene");
        console.log("Connected");

        // Send KeepAlive every second
        setInterval(() => {
          this._sendPacket(MessagePrefix.KeepAlive);
        }, 1000);
      });

      this.conn = TCPclient;
    }
  }

  on(evtName, func) {
    if (!evtName || !func) throw Error("...on(evtName, func)");
    if (!this._events) this._events = {};
    if (!this._events[evtName]) this._events[evtName] = [];
    this._events[evtName].push(func);
  }

  emit(evtName, ...data) {
    if (!evtName) throw Error("...emit(evtName)");
    if (!this._events || !this._events[evtName]) {
      return;
    }
    for (let listener of this._events[evtName]) {
      listener.call(this, ...data);
    }
  }

  handleRecvPacket(packet) {
    if (
      !packet.slice(0, this._packetHeader.length).equals(this._packetHeader)
    ) {
      console.warn("Ignoring irrelevant packet", packet);
      return;
    }

    let payloadLength = packet.slice(4, 6).readUInt16LE();
    if (payloadLength + 6 != packet.length) {
      console.warn(
        `Packet is meant to be ${payloadLength +
          6} bytes long, but is actually ${packet.length} bytes long`
      );
      return;
    }

    let messageCode = packet.slice(6, 8).toString();
    let data = packet.slice(8);
    switch (messageCode) {
      case MessagePrefix.Setting:
      case MessagePrefix.Settings2:
      case MessagePrefix.JSON:
        this.emit(messageCode, data);
        break;
      default:
        console.log("Unhandled message code", messageCode);
        this.emit(messageCode, data);
    }
  }

  sendList(key) {
    this._sendPacket(
      MessagePrefix.FileResource,
      Buffer.concat([
        Buffer.from([0x01, 0x00]),
        Buffer.from("List" + key.toString()),
        Buffer.from([0x00, 0x00])
      ])
    );
  }

  _sendPacket(messageCode, data, customA, customB) {
    if (!data) data = Buffer.allocUnsafe(0);
    let connIdentity = Buffer.from([
      customA || this._A,
      0x00,
      customB || this._B,
      0x00
    ]);
    if (connIdentity.length != 4) throw Error("connIdentity");

    let lengthLE = shortToLE(
      messageCode.length + connIdentity.length + data.length
    );
    if (lengthLE.length != 2) throw Error("lengthLE");

    let b = Buffer.alloc(
      this._packetHeader.length +
        lengthLE.length +
        messageCode.length +
        connIdentity.length +
        data.length
    );

    let cursor = 0;
    b.fill(this._packetHeader);
    b.fill(lengthLE, (cursor += this._packetHeader.length));
    b.write(messageCode, (cursor += lengthLE.length));
    b.fill(connIdentity, (cursor += messageCode.length));

    if (typeof data === "string")
      b.write(data, (cursor += connIdentity.length));
    else b.fill(data, (cursor += connIdentity.length));

    this.conn.write(b);
  }
}

module.exports = {
  Client,
  MessagePrefix
};
