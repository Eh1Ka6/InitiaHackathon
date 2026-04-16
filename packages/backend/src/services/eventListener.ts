import { ethers } from "ethers";
import { PrismaClient } from "@prisma/client";
import { config } from "../config";
import { ESCROW_ABI, getProvider } from "./contract";
import { notifyFunded } from "./botNotifier";

const prisma = new PrismaClient();

export async function startListening(): Promise<void> {
  if (!config.INITIA_WS_URL || !config.ESCROW_ADDR) {
    console.log("Event listener: missing WS URL or Escrow address, skipping");
    return;
  }

  try {
    const wsProvider = new ethers.WebSocketProvider(config.INITIA_WS_URL);
    const escrow = new ethers.Contract(config.ESCROW_ADDR, ESCROW_ABI, wsProvider);

    escrow.on("FundsLocked", async (competitionId: bigint, player: string, amount: bigint) => {
      console.log(`FundsLocked: competition=${competitionId}, player=${player}, amount=${amount}`);

      const wager = await prisma.wager.findFirst({
        where: { onChainId: Number(competitionId) },
        include: { entries: { include: { user: true } } },
      });

      if (!wager) return;

      // Find matching entry by wallet address and mark funded
      const entry = wager.entries.find(
        (e) => e.user.walletAddress?.toLowerCase() === player.toLowerCase()
      );
      if (entry && !entry.funded) {
        await prisma.wagerEntry.update({
          where: { id: entry.id },
          data: { funded: true },
        });
      }

      // Check if all funded
      const allEntries = await prisma.wagerEntry.findMany({ where: { wagerId: wager.id } });
      const allFunded = allEntries.every((e) => e.funded);

      if (allFunded && allEntries.length >= 2) {
        await prisma.wager.update({
          where: { id: wager.id },
          data: { status: "PLAYING" },
        });
        await notifyFunded(wager.chatId, wager);
      }
    });

    console.log("Event listener started");
  } catch (err) {
    console.error("Event listener failed to start:", err);
  }
}
