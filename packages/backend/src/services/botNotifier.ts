import { config } from "../config";

const TG_API = `https://api.telegram.org/bot${config.BOT_TOKEN}`;

async function sendMessage(chatId: string, text: string): Promise<void> {
  try {
    await fetch(`${TG_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
      }),
    });
  } catch (err) {
    console.error("Bot notification failed:", err);
  }
}

export async function notifyFunded(chatId: string, wager: any): Promise<void> {
  await sendMessage(
    chatId,
    `✅ *Both players funded!*\n\n` +
    `Wager #${wager.id} — ${wager.entryFee} INIT each\n` +
    `🎮 Open the app to play Stack!`
  );
}

export async function notifyScoreSubmitted(
  chatId: string,
  wager: any,
  player: any,
  score: number
): Promise<void> {
  const name = player.username ? `@${player.username}` : player.firstName;
  await sendMessage(
    chatId,
    `🎮 *${name}* scored *${score}* in Wager #${wager.id}!\n` +
    `Waiting for opponent...`
  );
}

export async function notifyWinner(
  chatId: string,
  wager: any,
  winner: any,
  scores: { winnerScore: number; loserScore: number }
): Promise<void> {
  const name = winner.username ? `@${winner.username}` : winner.firstName;
  const payout = (parseFloat(wager.entryFee) * 2 * 0.98).toFixed(2);
  await sendMessage(
    chatId,
    `🏆 *${name} wins Wager #${wager.id}!*\n\n` +
    `Score: *${scores.winnerScore}* vs *${scores.loserScore}*\n` +
    `💰 Payout: ${payout} INIT\n` +
    (wager.settleTxHash ? `🔗 TX: \`${wager.settleTxHash.slice(0, 16)}...\`` : "")
  );
}

export async function notifyCancelled(chatId: string, wager: any): Promise<void> {
  await sendMessage(
    chatId,
    `❌ *Wager #${wager.id} cancelled.*\nAll funds have been refunded.`
  );
}
