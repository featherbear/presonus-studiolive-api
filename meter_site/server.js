"use strict";

const CONSOLE_HOST = "10.185.192.6";
const CONSOLE_PORT = 53000;

const SERVER_HOST = "0.0.0.0";
const SERVER_PORT = 8080;

let emulateConsole = true;

//

const fastify = require("fastify")();
const socketio = require("socket.io")(fastify.server).of("/meter");
const path = require("path");

let PreSonusAPI;
if (emulateConsole) {
  PreSonusAPI = {
    Client: class DummyClient {
      /* Dummy client to emulate events */
      constructor() {
        this.i = 0; // Emulate rise and fall of values
        setInterval(() => {
          // Emit a metering event every 50ms
          socketio.emit("meter", this.metering);
        }, 50);
      }
      listen() {
        /* Stub */
      }
      connect() {
        /* Stub */
      }
      on() {
        /* Stub */
      }
      get metering() {
        let data = [];
        for (var i = 0; i < 32; i++) {
          data.push(
            Math.abs(parseInt(Math.random() * 65535 * Math.sin(this.i / 50)))
          );
        }
        this.i++;
        return {
          level: data
        };
      }
    }
  };
} else {
  PreSonusAPI = require("../PreSonusAPI");
}

console.info("Starting server...");
let client = new PreSonusAPI.Client(CONSOLE_HOST, CONSOLE_PORT);

console.debug(`Listening to UDP messages`);
client.listen();
client.on("meter", data => socketio.emit("meter", data));

console.debug(`Connecting to console on ${CONSOLE_HOST}:${CONSOLE_PORT}`);
client.connect();

fastify.register(require("fastify-static"), {
  root: path.join(__dirname, "public")
});

fastify.listen(SERVER_PORT, SERVER_HOST, err => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  let address = fastify.server.address();
  console.info(`Server listening on ${address.address}:${address.port}`);
});
