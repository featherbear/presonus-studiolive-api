const { Client, MessagePrefix } = require("./PreSonusAPI");
let client = new Client("192.168.0.167", 53000);

client.listen();
client.on(MessagePrefix.Setting, function(data) {
  console.log(data);
});
client.connect();

// setInterval(() => {
//   for (let key in client.metering) {
//     console.log(key + " " + client.metering[key]);
//   }
//   console.log("\n\n");
// }, 1000);
