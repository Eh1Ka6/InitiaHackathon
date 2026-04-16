import { CommandContext, Context } from "grammy";
import { api } from "../services/api";
import { formatStatusMessage } from "../services/formatter";
import { parseStatusCommand } from "../utils/parsers";

export async function statusCommand(ctx: CommandContext<Context>) {
  const wagerId = parseStatusCommand(ctx.match);

  try {
    if (wagerId) {
      const wager = await api.getWager(wagerId);
      await ctx.reply(formatStatusMessage(wager), { parse_mode: "Markdown" });
    } else {
      const wagers = await api.getUserWagers(ctx.from!.id.toString());
      if (wagers.length === 0) {
        await ctx.reply("No active wagers. Create one with `/wager @username amount`", { parse_mode: "Markdown" });
        return;
      }
      let msg = "📋 *Your Wagers*\n";
      for (const w of wagers.slice(0, 10)) {
        const statusEmoji: Record<string, string> = {
          PENDING_ACCEPTANCE: "⏳", ACCEPTED: "✅", PLAYING: "🎮", SETTLED: "🏆", CANCELLED: "❌",
        };
        msg += `\n${statusEmoji[w.status] || "❓"} #${w.id} — ${w.entryFee} INIT — ${w.status}`;
      }
      await ctx.reply(msg, { parse_mode: "Markdown" });
    }
  } catch (err: any) {
    await ctx.reply(`Error: ${err.message}`);
  }
}
