import { CommandContext, Context } from "grammy";
import { api } from "../services/api";
import { parseCancelCommand } from "../utils/parsers";

export async function cancelCommand(ctx: CommandContext<Context>) {
  const wagerId = parseCancelCommand(ctx.match);
  if (!wagerId) {
    await ctx.reply("Usage: `/cancel <wager_id>`", { parse_mode: "Markdown" });
    return;
  }

  try {
    await api.cancelWager(wagerId);
    await ctx.reply(`❌ Wager #${wagerId} cancelled. Funds will be refunded.`);
  } catch (err: any) {
    await ctx.reply(`Failed to cancel: ${err.message}`);
  }
}
