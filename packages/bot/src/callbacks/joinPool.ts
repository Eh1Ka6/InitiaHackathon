import { Context, InlineKeyboard } from "grammy";
import { api } from "../services/api";
import { config } from "../config";

export async function joinPoolCallback(ctx: Context) {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  const match = data.match(/^join:(\d+):([12])$/);
  if (!match) return;

  const poolId = parseInt(match[1]);
  const side = parseInt(match[2]);
  const telegramId = ctx.from!.id.toString();

  try {
    const result = await api.joinPool(poolId, telegramId, side);

    // Update button counts
    const keyboard = new InlineKeyboard()
      .text(`🅰️ Side A (${result.sideACount || 0})`, `join:${poolId}:1`)
      .text(`🅱️ Side B (${result.sideBCount || 0})`, `join:${poolId}:2`)
      .row()
      .webApp("💰 Open App", `${config.MINIAPP_URL}?startapp=pool_${poolId}`);

    await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
    await ctx.answerCallbackQuery({ text: `Joined Side ${side === 1 ? "A" : "B"}!` });
  } catch (err: any) {
    await ctx.answerCallbackQuery({ text: err.message, show_alert: true });
  }
}
