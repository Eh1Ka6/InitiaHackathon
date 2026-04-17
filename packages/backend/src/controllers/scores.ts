import { Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthRequest } from "../middleware/telegramAuth";
import { validateScore } from "../services/antiCheat";
import { autoSettle } from "../services/settlement";

const prisma = new PrismaClient();

export async function submitScore(req: AuthRequest, res: Response) {
  try {
    const wagerId = parseInt(req.params.id);
    const { score, playTimeMs, telegramId: bodyTgId } = req.body;
    const telegramId = req.telegramId || bodyTgId;
    if (!telegramId) {
      res.status(400).json({ error: "Missing telegramId" });
      return;
    }

    // 1. Validate wager is PLAYING
    const wager = await prisma.wager.findUnique({
      where: { id: wagerId },
      include: { entries: { include: { user: true } } },
    });

    if (!wager || wager.status !== "PLAYING") {
      res.status(400).json({ error: "Wager is not in playing state" });
      return;
    }

    // 2. Find player's entry
    const user = await prisma.telegramUser.findUnique({
      where: { telegramId },
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const entry = wager.entries.find((e) => e.userId === user.id);
    if (!entry) {
      res.status(403).json({ error: "You are not a participant in this wager" });
      return;
    }

    // 3. Check if already submitted
    if (entry.score !== null) {
      res.status(400).json({ error: "Score already submitted" });
      return;
    }

    // 4. Anti-cheat validation
    const validation = validateScore(score, playTimeMs);
    if (!validation.valid) {
      res.status(400).json({ error: `Invalid score: ${validation.reason}` });
      return;
    }

    // 5. Save score
    await prisma.wagerEntry.update({
      where: { id: entry.id },
      data: {
        score,
        playTimeMs,
        playedAt: new Date(),
      },
    });

    // 6. Check if both players have submitted
    const updatedEntries = await prisma.wagerEntry.findMany({
      where: { wagerId },
    });
    const allScored = updatedEntries.every((e) => e.score !== null);

    if (allScored) {
      // Both done — auto-settle
      await autoSettle(wagerId);
    }

    const updatedWager = await prisma.wager.findUnique({
      where: { id: wagerId },
      include: { entries: { include: { user: true } } },
    });

    res.json({
      message: allScored ? "Both scored — settling wager" : "Score submitted — waiting for opponent",
      wager: updatedWager,
    });
  } catch (err) {
    console.error("Submit score error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
