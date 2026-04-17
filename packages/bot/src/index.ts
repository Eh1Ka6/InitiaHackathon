import dotenv from "dotenv";
dotenv.config();

// Import bot AFTER env is loaded (use require to avoid hoisting)
const { bot } = require("./bot");

console.log("Starting WeezWager bot...");
bot.start({
  onStart: () => console.log("WeezWager bot is running!"),
});
