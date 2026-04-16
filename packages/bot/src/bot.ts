import { Bot } from "grammy";
import { config } from "./config";
import { api } from "./services/api";

// Commands
import { wagerCommand } from "./commands/wager";
import { poolCommand } from "./commands/pool";
import { statusCommand } from "./commands/status";
import { cancelCommand } from "./commands/cancel";
import { linkCommand } from "./commands/link";
import { balanceCommand } from "./commands/balance";
import { helpCommand } from "./commands/help";

// Callbacks
import { acceptWagerCallback } from "./callbacks/acceptWager";
import { joinPoolCallback } from "./callbacks/joinPool";

export const bot = new Bot(config.BOT_TOKEN);

// Error handler
bot.catch((err) => {
  console.error("Bot error:", err);
});

// User registration middleware
bot.use(async (ctx, next) => {
  if (ctx.from) {
    api.ensureUser({
      telegramId: ctx.from.id.toString(),
      username: ctx.from.username,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
    });
  }
  await next();
});

// Commands
bot.command("wager", wagerCommand);
bot.command("pool", poolCommand);
bot.command("status", statusCommand);
bot.command("cancel", cancelCommand);
bot.command("link", linkCommand);
bot.command("balance", balanceCommand);
bot.command("help", helpCommand);
bot.command("start", helpCommand);

// Callbacks
bot.callbackQuery(/^accept:\d+$/, acceptWagerCallback);
bot.callbackQuery(/^join:\d+:[12]$/, joinPoolCallback);
