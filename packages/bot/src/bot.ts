import { Bot } from "grammy";
import { config } from "./config";
import { api } from "./services/api";

// Commands
import { helpCommand } from "./commands/help";
import { playCommand } from "./commands/play";
import { profileCommand } from "./commands/profile";
import { balanceCommand } from "./commands/balance";
import { createDrawCommand } from "./commands/createdraw";
import { drawsCommand } from "./commands/draws";
import { wagerCommand } from "./commands/wager";

// Callbacks
import { buyTicketCallback } from "./callbacks/buyTicket";

export const bot = new Bot(config.BOT_TOKEN);

bot.catch((err) => {
  console.error("Bot error:", err);
});

// User registration middleware
bot.use(async (ctx, next) => {
  if (ctx.from) {
    await api.ensureUser({
      telegramId: ctx.from.id.toString(),
      username: ctx.from.username,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
    });
  }
  await next();
});

// Commands — draw-based flow
bot.command("start", helpCommand);
bot.command("help", helpCommand);
bot.command("play", playCommand);
bot.command("profile", profileCommand);
bot.command("balance", balanceCommand);
bot.command("createdraw", createDrawCommand);
bot.command("draws", drawsCommand);
bot.command("wager", wagerCommand);

// Callbacks
bot.callbackQuery(/^buy_ticket:\d+$/, buyTicketCallback);
