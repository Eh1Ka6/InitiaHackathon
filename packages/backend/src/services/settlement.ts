import { PrismaClient } from "@prisma/client";
import { settleOnChain } from "./contract";
import { notifyWinner } from "./botNotifier";

const prisma = new PrismaClient();

export async function autoSettle(wagerId: number): Promise<void> {
  const wager = await prisma.wager.findUnique({
    where: { id: wagerId },
    include: { entries: { include: { user: true } } },
  });

  if (!wager || wager.status !== "PLAYING") {
    throw new Error(`Wager ${wagerId} not in PLAYING state`);
  }

  const entries = wager.entries;
  if (entries.length < 2 || entries.some((e) => e.score === null)) {
    throw new Error(`Not all scores submitted for wager ${wagerId}`);
  }

  // Mark as settling
  await prisma.wager.update({
    where: { id: wagerId },
    data: { status: "SETTLING" },
  });

  // Determine winner: higher score wins. Tie: first to submit wins.
  const sorted = [...entries].sort((a, b) => {
    if (b.score! !== a.score!) return b.score! - a.score!;
    return (a.playedAt?.getTime() || 0) - (b.playedAt?.getTime() || 0);
  });

  const winner = sorted[0];
  const loser = sorted[1];

  try {
    // Settle on-chain if we have an on-chain ID
    let settleTxHash: string | undefined;
    if (wager.onChainId && winner.user.walletAddress) {
      settleTxHash = await settleOnChain(wager.onChainId, [winner.user.walletAddress]);
    }

    // Update DB
    await prisma.wager.update({
      where: { id: wagerId },
      data: {
        status: "SETTLED",
        winnerId: winner.userId,
        settleTxHash: settleTxHash || null,
      },
    });

    // Notify via bot
    await notifyWinner(
      wager.chatId,
      wager,
      winner.user,
      { winnerScore: winner.score!, loserScore: loser.score! }
    );
  } catch (err) {
    console.error(`Settlement failed for wager ${wagerId}:`, err);
    // Revert to PLAYING so it can be retried
    await prisma.wager.update({
      where: { id: wagerId },
      data: { status: "PLAYING" },
    });
    throw err;
  }
}
