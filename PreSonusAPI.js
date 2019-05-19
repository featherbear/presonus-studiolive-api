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
    this.serverHost = host;
    this.serverPort = port;
    this._packetHeader = Buffer.from([0x55, 0x43, 0x00, 0x01]); // UC..
    this._A = 0x68; // These values might come from
    this._B = 0x65; // the broadcast discovery

    this._UdpServerPort = 52704;
    this.meterListener = null;
    this.metering = {};

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
              this._handleRecvPacket(buffData.slice(0, correctLength + 6));

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
              this._handleRecvPacket(TCPclient.payloadTemp);
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

      this.conn = TCPclient;
    }
  }

  connect() {
    {
      this.conn.connect(this.serverPort, this.serverHost, () => {
        // Tell mixer to send metering data to our meter server
        if (this.meterListener)
          this._sendPacket(
            MessagePrefix.Hello,
            shortToLE(this._UdpServerPort),
            0x00
          );

        // Send subscribe request
        this._sendPacket(MessagePrefix.JSON, craftSubscribe());

        this.sendList("presets/scene");

        // Send KeepAlive every second
        setInterval(() => {
          this._sendPacket(MessagePrefix.KeepAlive);
        }, 1000);

        console.log("Connected");
      });
    }
  }

  listen() {
    if (this.meterListener) throw Error("Meter server already listening!");

    // Create UDP Server to listen to metering data
    let UDPserver = dgram.createSocket("udp4");

    UDPserver.on("error", err => {
      UDPserver.close();
      throw Error("Meter server error error: " + err.stack);
    });

    // UDPserver.on("message", this._handleRecvPacket.bind(this));
    UDPserver.on("message", (msg, rinfo) => {
      let data = Buffer.from(msg);

      if (
        !data.slice(0, 4).equals(this._packetHeader) ||
        data.slice(6, 8).toString() != "MS"
      ) {
        console.warn("Ignoring irrelevant packet", packet);
        return;
      }

      // var length = data.slice(4, 6); // length is given as cf08 = 53000, but the payload is only 1041 long

      // var conn = data.slice(8, 12);

      var text = data.slice(12, 16);
      if (text.toString() != "levl") return; // Only 'levl' (partially) implemented
      // head, length, code, conn, levl, SPACER, data = x[:4], x[4:6], x[6:8], x[8:12], x[12:16], x[16:20], x[20:]

      var _ = data.slice(16, 20);

      data = data.slice(20);

      if (data.length != 1041) return;

      {
        let valArray = [];
        for (let i = 0; i < 32; i++) valArray.push(data.readUInt16LE(i * 2));
        this.metering["chain1input"] = this.metering["input"] = valArray;
        // looks like it's the same as 041-072
      }

      {
        let valArray = [];
        const offset = 72;
        for (let i = 0 + offset; i < 32 + offset; i++)
          valArray.push(data.readUInt16LE(i * 2));
        this.metering["chain2input"] = this.metering["chain1output"] = valArray;
      }

      {
        let valArray = [];
        const offset = 104;
        for (let i = 0 + offset; i < 32 + offset; i++)
          valArray.push(data.readUInt16LE(i * 2));
        this.metering["chain3input"] = this.metering["chain2output"] = valArray;
      }

      {
        let valArray = [];
        const offset = 136;
        for (let i = 0 + offset; i < 32 + offset; i++)
          valArray.push(data.readUInt16LE(i * 2));
        this.metering["chain4input"] = this.metering["chain3output"] = valArray;
      }

      {
        let valArray = [];
        const offset = 168;
        for (let i = 0 + offset; i < 32 + offset; i++)
          valArray.push(data.readUInt16LE(i * 2));
        this.metering["level"] = this.metering["chain4output"] = valArray;
      }

      this.emit("meter", this.metering)
    });

    UDPserver.on("listening", () => {
      var address = UDPserver.address();
      console.info(
        `Meter server started on: ${address.address}:${address.port}`
      );
    });

    UDPserver.bind(this._UdpServerPort);
    this.meterListener = UDPserver;
  }
  stop() {
    if (!this.meterListener) throw Error("Meter server hasn't started yet");
    this.meterListener.close();
    this.meterListener = null;
  }

  setUDPServerPort(port) {
    if (typeof port !== "number" || port <= 0 || port > 65535) {
      throw Error("setUDPServerPort: Invalid port number");
    }
    if (this.meterListener)
      throw Error(
        "Meter server is currently running, please stop the server first"
      );
    self._UdpServerPort = port;
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

  _handleRecvPacket(packet) {
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
