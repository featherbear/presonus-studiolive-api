"use strict";

const fastify = require("fastify")({ logger: true });
const path = require("path");

const { Client } = require("../PreSonusAPI");
let client = new Client("192.168.0.167", 53000);

client.listen();
client.connect();

fastify.register(require("fastify-static"), {
  root: path.join(__dirname, "public")
});

fastify.get("/meter", (request, reply) => {
  reply.send(client.metering.level);
});

fastify.listen(8081, "0.0.0.0", err => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`server listening on ${fastify.server.address().port}`);
});
