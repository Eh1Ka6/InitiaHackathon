import { Wager } from "../types";

export function formatWagerMessage(wager: Wager, creatorName: string, opponentName?: string): string {
  return (
    `⚔️ *New Challenge!*\n\n` +
    `${creatorName} challenges ${opponentName || "anyone"}\n` +
    `💰 Stake: *${wager.entryFee} INIT* each\n` +
    `🎮 Game: Stack\n` +
    `⏰ Expires: 24h`
  );
}

export function formatAcceptedMessage(wager: Wager): string {
  const creator = wager.creator.username ? `@${wager.creator.username}` : wager.creator.firstName;
  const opponent = wager.entries.find((e) => e.userId !== wager.creatorId)?.user;
  const oppName = opponent?.username ? `@${opponent.username}` : opponent?.firstName || "Opponent";

  return (
    `⚔️ *Challenge Accepted!*\n\n` +
    `${creator} vs ${oppName}\n` +
    `💰 Stake: *${wager.entryFee} INIT* each\n\n` +
    `Both players: deposit your stakes in the app 👇`
  );
}

export function formatStatusMessage(wager: Wager): string {
  const statusEmoji: Record<string, string> = {
    PENDING_ACCEPTANCE: "⏳",
    ACCEPTED: "✅",
    FUNDING: "💰",
    FUNDED: "🔒",
    PLAYING: "🎮",
    SETTLED: "🏆",
    CANCELLED: "❌",
  };

  const emoji = statusEmoji[wager.status] || "❓";
  let msg = `${emoji} *Wager #${wager.id}*\n\nStatus: ${wager.status}\nStake: ${wager.entryFee} INIT each\n`;

  if (wager.status === "PLAYING" || wager.status === "SETTLED") {
    for (const entry of wager.entries) {
      const name = entry.user.username ? `@${entry.user.username}` : entry.user.firstName;
      const score = entry.score !== null ? `Score: ${entry.score}` : "Not played yet";
      msg += `\n${name}: ${score}`;
    }
  }

  if (wager.status === "SETTLED" && wager.winnerId) {
    const winner = wager.entries.find((e) => e.userId === wager.winnerId)?.user;
    const name = winner?.username ? `@${winner.username}` : winner?.firstName;
    msg += `\n\n🏆 Winner: ${name}`;
  }

  return msg;
}

export function formatPoolMessage(description: string, duration: string): string {
  return (
    `🏊 *New Pool!*\n\n` +
    `${description}\n` +
    `⏰ Closes in ${duration}\n\n` +
    `Pick your side!`
  );
}
