import { CommandContext, Context, InlineKeyboard } from "grammy";
import { config } from "../config";

export async function profileCommand(ctx: CommandContext<Context>) {
  const keyboard = new InlineKeyboard()
    .webApp("👤 Open Profile", `${config.MINIAPP_URL}?startapp=profile`);

  await ctx.reply("View your tickets, balance, and achievements 👇", {
    reply_markup: keyboard,
  });
}
