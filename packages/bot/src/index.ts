import dotenv from "dotenv";
dotenv.config();

import { bot } from "./bot";

console.log("Starting WeezWager bot...");
bot.start({
  onStart: () => console.log("WeezWager bot is running!"),
});
