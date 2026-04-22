import { ethers } from "ethers";
import { PrismaClient } from "@prisma/client";
import { config } from "../config";
import { ESCROW_ABI, DRAWHUB_ABI, getProvider } from "./contract";
import { notifyFunded } from "./botNotifier";

const prisma = new PrismaClient();

export async function startListening(): Promise<void> {
  if (!config.INITIA_WS_URL) {
    console.log("Event listener: missing WS URL, skipping");
    return;
  }

  let wsProvider: ethers.WebSocketProvider;
  try {
    wsProvider = new ethers.WebSocketProvider(config.INITIA_WS_URL);
  } catch (err) {
    console.error("Event listener failed to start WS provider:", err);
    return;
  }

  /* ------------------------------------------------------------------ */
  /* WeezEscrow listener (existing behavior, unchanged)                 */
  /* ------------------------------------------------------------------ */
  if (config.ESCROW_ADDR) {
    try {
      const escrow = new ethers.Contract(config.ESCROW_ADDR, ESCROW_ABI, wsProvider);

      escrow.on(
        "FundsLocked",
        async (competitionId: bigint, player: string, amount: bigint) => {
          console.log(
            `FundsLocked: competition=${competitionId}, player=${player}, amount=${amount}`
          );

          const wager = await prisma.wager.findFirst({
            where: { onChainId: Number(competitionId) },
            include: { entries: { include: { user: true } } },
          });

          if (!wager) return;

          const entry = wager.entries.find(
            (e) => e.user.walletAddress?.toLowerCase() === player.toLowerCase()
          );
          if (entry && !entry.funded) {
            await prisma.wagerEntry.update({
              where: { id: entry.id },
              data: { funded: true },
            });
          }

          const allEntries = await prisma.wagerEntry.findMany({
            where: { wagerId: wager.id },
          });
          const allFunded = allEntries.every((e) => e.funded);

          if (allFunded && allEntries.length >= 2) {
            await prisma.wager.update({
              where: { id: wager.id },
              data: { status: "PLAYING" },
            });
            await notifyFunded(wager.chatId, wager);
          }
        }
      );

      console.log("Escrow event listener started");
    } catch (err) {
      console.error("Escrow event listener failed to attach:", err);
    }
  }

  /* ------------------------------------------------------------------ */
  /* DrawHub listener                                                   */
  /* ------------------------------------------------------------------ */
  if (!config.DRAWHUB_ADDRESS) {
    console.log("DrawHub listener: missing DRAWHUB_ADDRESS, skipping");
    return;
  }

  try {
    const drawHub = new ethers.Contract(
      config.DRAWHUB_ADDRESS,
      DRAWHUB_ABI as any,
      wsProvider
    );

    drawHub.on(
      "DrawCreated",
      async (
        drawId: bigint,
        entryFee: bigint,
        deadline: bigint,
        multiplierConfigId: number,
        ev: any
      ) => {
        console.log(
          `DrawCreated: drawId=${drawId}, fee=${entryFee}, cfg=${multiplierConfigId}`
        );
        const onChainDrawId = drawId.toString();
        const txHash = ev?.log?.transactionHash;
        try {
          await prisma.draw.upsert({
            where: { onChainDrawId },
            update: {
              entryFee: entryFee.toString(),
              deadline: new Date(Number(deadline) * 1000),
              multiplierConfigId: Number(multiplierConfigId),
              txHashCreate: txHash ?? undefined,
            },
            create: {
              onChainDrawId,
              status: "OPEN",
              entryFee: entryFee.toString(),
              deadline: new Date(Number(deadline) * 1000),
              multiplierConfigId: Number(multiplierConfigId),
              txHashCreate: txHash ?? null,
            },
          });
        } catch (err) {
          console.error("DrawCreated handler failed:", err);
        }
      }
    );

    drawHub.on(
      "ParticipantEnrolled",
      async (drawId: bigint, player: string, _amount: bigint, ev: any) => {
        console.log(`ParticipantEnrolled: drawId=${drawId}, player=${player}`);
        const txHash = ev?.log?.transactionHash;
        try {
          const draw = await prisma.draw.findUnique({
            where: { onChainDrawId: drawId.toString() },
          });
          if (!draw) return;

          // Match by wallet address (case-insensitive). If the user pre-created
          // an entry via POST /api/draws/:id/join, flip deposited=true.
          const entries = await prisma.drawEntry.findMany({
            where: { drawId: draw.id },
          });
          const entry = entries.find(
            (e) => e.walletAddress.toLowerCase() === player.toLowerCase()
          );
          if (entry) {
            await prisma.drawEntry.update({
              where: { id: entry.id },
              data: { deposited: true, depositTxHash: txHash ?? entry.depositTxHash },
            });
          }
          // If no entry exists yet, we intentionally skip — join API is the
          // canonical way to associate Telegram user ↔ wallet.
        } catch (err) {
          console.error("ParticipantEnrolled handler failed:", err);
        }
      }
    );

    drawHub.on("QualifiersRecorded", (drawId: bigint) => {
      // Noop: we already persisted this state in drawResolver.recordQualifiersOnChain
      console.log(`QualifiersRecorded (noop): drawId=${drawId}`);
    });

    drawHub.on(
      "DrawSettled",
      async (drawId: bigint, winner: string, multiplier: number, payout: bigint, ev: any) => {
        console.log(
          `DrawSettled: drawId=${drawId}, winner=${winner}, mult=${multiplier}, payout=${payout}`
        );
        const txHash = ev?.log?.transactionHash;
        try {
          await prisma.draw.update({
            where: { onChainDrawId: drawId.toString() },
            data: {
              status: "SETTLED",
              winnerAddress: winner,
              multiplier: Number(multiplier),
              payout: payout.toString(),
              txHashSettle: txHash ?? null,
            },
          });
        } catch (err) {
          console.error("DrawSettled handler failed:", err);
        }
      }
    );

    drawHub.on("DrawCancelled", async (drawId: bigint) => {
      console.log(`DrawCancelled: drawId=${drawId}`);
      try {
        await prisma.draw.update({
          where: { onChainDrawId: drawId.toString() },
          data: { status: "CANCELLED" },
        });
      } catch (err) {
        console.error("DrawCancelled handler failed:", err);
      }
    });

    console.log("DrawHub event listener started");
  } catch (err) {
    console.error("DrawHub event listener failed to attach:", err);
  }
}
