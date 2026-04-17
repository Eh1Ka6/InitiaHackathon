import { CommandContext, Context, InlineKeyboard } from "grammy";
import { config } from "../config";

export async function helpCommand(ctx: CommandContext<Context>) {
  const keyboard = new InlineKeyboard()
    .webApp("🎮 Open WeezWager", config.MINIAPP_URL);

  await ctx.reply(
    `🎮 *WeezWager — Win Different*\n\n` +
      `Play the Stack game, buy a ticket, and win real crypto.\n\n` +
      `*Commands:*\n` +
      `/play — Open Cash Game\n` +
      `/profile — Your profile & tickets\n` +
      `/balance — Check your balance\n` +
      `/help — Show this message\n\n` +
      `*How it works:*\n` +
      `1️⃣ Tap Open WeezWager\n` +
      `2️⃣ Pick a prize draw ($10 / $50 / $500)\n` +
      `3️⃣ Create profile or connect wallet\n` +
      `4️⃣ Buy ticket & play Stack\n` +
      `5️⃣ Higher scores win the pot!`,
    { reply_markup: keyboard, parse_mode: "Markdown" }
  );
}
