import { Context, InlineKeyboard } from "grammy";
import { api } from "../services/api";
import { formatAcceptedMessage } from "../services/formatter";
import { config } from "../config";

export async function acceptWagerCallback(ctx: Context) {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  const match = data.match(/^accept:(\d+)$/);
  if (!match) return;

  const wagerId = parseInt(match[1]);
  const telegramId = ctx.from!.id.toString();

  try {
    const wager = await api.acceptWager(wagerId, telegramId);

    const keyboard = new InlineKeyboard()
      .webApp("💰 Deposit Stake", `${config.MINIAPP_URL}?startapp=wager_${wagerId}`);

    await ctx.editMessageText(formatAcceptedMessage(wager), {
      reply_markup: keyboard,
      parse_mode: "Markdown",
    });

    await ctx.answerCallbackQuery({ text: "Challenge accepted!" });
  } catch (err: any) {
    await ctx.answerCallbackQuery({ text: err.message, show_alert: true });
  }
}
