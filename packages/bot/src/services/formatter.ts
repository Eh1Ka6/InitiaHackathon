import { Wager, CommunityDraw } from "../types";

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

function formatEndsIn(endTimestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = endTimestamp - now;
  if (diff <= 0) return "ended";
  const hours = Math.floor(diff / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function formatCommunityDrawMessage(draw: CommunityDraw, creatorName: string): string {
  const idLine = draw.onChainId !== null ? `Draw #${draw.onChainId}` : `Draw #${draw.id} (pending)`;
  return (
    `🎟️ *Community Draw Created!*\n\n` +
    `*${draw.title}*\n` +
    `${idLine}\n` +
    `👤 Host: ${creatorName}\n\n` +
    `🏆 Prize: *${draw.prizeAmount} INIT* (${draw.winnerCount} winner${draw.winnerCount > 1 ? "s" : ""})\n` +
    `🎫 Ticket: ${draw.ticketPrice} INIT\n` +
    `📊 Sold: ${draw.ticketsSold} / ${draw.maxTickets}\n` +
    `⏰ Ends in: ${formatEndsIn(draw.endTimestamp)}\n\n` +
    `Tap below to buy a ticket 👇`
  );
}

export function formatCommunityDrawList(draws: CommunityDraw[]): string {
  if (draws.length === 0) {
    return "No open community draws right now. Create one with `/createdraw`.";
  }
  let msg = "🎟️ *Open Community Draws*\n";
  for (const d of draws) {
    const id = d.onChainId !== null ? d.onChainId : d.id;
    msg +=
      `\n*${d.title}* — Draw #${id}\n` +
      `🏆 ${d.prizeAmount} INIT · 🎫 ${d.ticketPrice} INIT · ` +
      `${d.ticketsSold}/${d.maxTickets} · ends ${formatEndsIn(d.endTimestamp)}`;
  }
  return msg;
}
