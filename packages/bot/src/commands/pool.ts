import { CommandContext, Context, InlineKeyboard } from "grammy";
import { api } from "../services/api";
import { formatPoolMessage } from "../services/formatter";
import { parsePoolCommand } from "../utils/parsers";
import { config } from "../config";

export async function poolCommand(ctx: CommandContext<Context>) {
  const parsed = parsePoolCommand(ctx.match);
  if (!parsed) {
    await ctx.reply("Usage: `/pool description duration`\nExample: `/pool Lakers vs Celtics 24h`", { parse_mode: "Markdown" });
    return;
  }

  try {
    const pool = await api.createPool({
      creatorTelegramId: ctx.from!.id.toString(),
      description: parsed.description,
      chatId: ctx.chat!.id.toString(),
      entryFee: "10", // Default for pools
      duration: parsed.duration,
    });

    const text = formatPoolMessage(parsed.description, parsed.duration);

    const keyboard = new InlineKeyboard()
      .text("🅰️ Side A (0)", `join:${pool.id}:1`)
      .text("🅱️ Side B (0)", `join:${pool.id}:2`)
      .row()
      .webApp("💰 Open App", `${config.MINIAPP_URL}?startapp=pool_${pool.id}`);

    await ctx.reply(text, { reply_markup: keyboard, parse_mode: "Markdown" });
  } catch (err: any) {
    await ctx.reply(`Failed to create pool: ${err.message}`);
  }
}
