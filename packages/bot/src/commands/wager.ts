import { CommandContext, Context, InlineKeyboard } from "grammy";
import { api } from "../services/api";
import { formatWagerMessage } from "../services/formatter";
import { parseWagerCommand } from "../utils/parsers";
import { config } from "../config";

export async function wagerCommand(ctx: CommandContext<Context>) {
  const parsed = parseWagerCommand(ctx.match);
  if (!parsed) {
    await ctx.reply("Usage: `/wager @username amount`\nExample: `/wager @bob 50`", { parse_mode: "Markdown" });
    return;
  }

  try {
    const wager = await api.createWager({
      creatorTelegramId: ctx.from!.id.toString(),
      opponentUsername: parsed.opponent,
      entryFee: parsed.amount,
      chatId: ctx.chat!.id.toString(),
    });

    const creatorName = ctx.from!.username ? `@${ctx.from!.username}` : ctx.from!.first_name;
    const text = formatWagerMessage(wager, creatorName, `@${parsed.opponent}`);

    const keyboard = new InlineKeyboard()
      .text("⚔️ Accept Challenge", `accept:${wager.id}`)
      .row()
      .webApp("💰 Open App", `${config.MINIAPP_URL}?startapp=wager_${wager.id}`);

    const msg = await ctx.reply(text, { reply_markup: keyboard, parse_mode: "Markdown" });

    // TODO: save msg.message_id to backend for later editing
  } catch (err: any) {
    await ctx.reply(`Failed to create wager: ${err.message}`);
  }
}
