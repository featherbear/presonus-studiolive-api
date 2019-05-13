const { Client, MessagePrefix } = require("./PreSonusAPI");
let client = new Client("192.168.0.167", 53000);

client.on(MessagePrefix.Setting, function(data) {
  console.log(data);
});
