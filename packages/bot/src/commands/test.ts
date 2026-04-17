import { CommandContext, Context, InlineKeyboard } from "grammy";
import { api } from "../services/api";
import { config } from "../config";

export async function testCommand(ctx: CommandContext<Context>) {
  try {
    // Create a self-wager
    const wager = await api.createWager({
      creatorTelegramId: ctx.from!.id.toString(),
      opponentUsername: "test_opponent",
      entryFee: "1",
      chatId: ctx.chat!.id.toString(),
    });

    // Auto-accept with self (will create test opponent)
    await api.acceptWager(wager.id, ctx.from!.id.toString());

    // Activate test opponent (simulates deposit + random score)
    const res = await fetch(`${config.API_URL}/api/wagers/${wager.id}/dev-opponent`, {
      method: "POST",
    });
    const data = await res.json() as any;

    const keyboard = new InlineKeyboard()
      .webApp("🎮 Play Stack Now", `${config.MINIAPP_URL}?startapp=play_${wager.id}`);

    await ctx.reply(
      `🧪 *Test Wager Created!*\n\n` +
      `Wager #${wager.id} — 1 INIT stake\n` +
      `Opponent: TestBot (score: ${data.opponentScore || "?"})\n\n` +
      `Beat their score to win! 👇`,
      { reply_markup: keyboard, parse_mode: "Markdown" }
    );
  } catch (err: any) {
    await ctx.reply(`Test failed: ${err.message}`);
  }
}
