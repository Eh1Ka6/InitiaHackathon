import { CommandContext, Context, InlineKeyboard } from "grammy";
import { config } from "../config";

export async function balanceCommand(ctx: CommandContext<Context>) {
  const keyboard = new InlineKeyboard()
    .webApp("💰 Check Balance", `${config.MINIAPP_URL}?startapp=balance`);

  await ctx.reply(
    "Check your balance and manage your wallet in the app 👇",
    { reply_markup: keyboard }
  );
}
