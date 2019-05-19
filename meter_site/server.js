"use strict";

const fastify = require("fastify")();
const socketio = require("socket.io")(fastify.server).of("/meter");
const path = require("path");

const { Client } = require("../PreSonusAPI");

// const Client = class DummyClient {
//   // Dummy client to emulate events
//   constructor() {
//     this.i = 0;
//     setInterval(() => {
//       socketio.emit("meter", this.metering);
//     }, 50);
//   }

//   listen() {}

//   connect() {}

//   on() {}

//   get metering() {
//     let data = [];
//     for (var i = 0; i < 32; i++) {
//       data.push(
//         Math.abs(parseInt(Math.random() * 65535 * Math.sin(this.i / 50)))
//       );
//     }
//     this.i++;
//     return {
//       level: data
//     };
//   }
// };

let client = new Client("10.185.192.6", 53000);

client.listen();
client.connect();

client.on("meter", data => socketio.emit("meter", data));

fastify.register(require("fastify-static"), {
  root: path.join(__dirname, "public")
});
fastify.listen(8080, "0.0.0.0", err => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.info(`Server listening on port ${fastify.server.address().port}`);
});
