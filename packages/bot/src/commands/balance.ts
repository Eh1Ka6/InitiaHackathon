import { CommandContext, Context, InlineKeyboard } from "grammy";
import { config } from "../config";

export async function balanceCommand(ctx: CommandContext<Context>) {
  const keyboard = new InlineKeyboard()
    .webApp("💰 Check Balance", `${config.MINIAPP_URL}?startapp=profile`);

  await ctx.reply("Your balance and deposit options are in the app 👇", {
    reply_markup: keyboard,
  });
}
