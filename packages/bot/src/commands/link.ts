import { CommandContext, Context, InlineKeyboard } from "grammy";
import { config } from "../config";

export async function linkCommand(ctx: CommandContext<Context>) {
  const keyboard = new InlineKeyboard()
    .webApp("🔗 Link Wallet", `${config.MINIAPP_URL}?startapp=link`);

  await ctx.reply(
    "Connect your Initia wallet to start wagering 👇",
    { reply_markup: keyboard }
  );
}
