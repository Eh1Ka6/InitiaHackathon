import { CommandContext, Context, InlineKeyboard } from "grammy";
import { config } from "../config";

export async function playCommand(ctx: CommandContext<Context>) {
  const keyboard = new InlineKeyboard()
    .webApp("🎮 Play Now", `${config.MINIAPP_URL}?startapp=cash`);

  await ctx.reply(
    `🎲 *Ready to win?*\n\n` +
      `Tap below to open WeezDraw and enter a prize draw.`,
    { reply_markup: keyboard, parse_mode: "Markdown" }
  );
}
