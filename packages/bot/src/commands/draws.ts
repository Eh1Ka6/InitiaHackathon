import { CommandContext, Context, InlineKeyboard } from "grammy";
import { api } from "../services/api";
import { formatCommunityDrawList } from "../services/formatter";
import { config } from "../config";

export async function drawsCommand(ctx: CommandContext<Context>) {
  try {
    const draws = await api.listOpenCommunityDraws(5);
    const keyboard = new InlineKeyboard().webApp(
      "🎮 Open WeezDraw",
      `${config.MINIAPP_URL}?startapp=draws`
    );
    await ctx.reply(formatCommunityDrawList(draws), {
      reply_markup: keyboard,
      parse_mode: "Markdown",
    });
  } catch (err: any) {
    await ctx.reply(`Failed to fetch draws: ${err.message}`);
  }
}
