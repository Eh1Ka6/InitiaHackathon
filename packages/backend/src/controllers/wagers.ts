import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

export async function createWager(req: Request, res: Response) {
  try {
    const { creatorTelegramId, opponentUsername, entryFee, description, chatId, type } = req.body;

    const creator = await prisma.telegramUser.findUnique({
      where: { telegramId: creatorTelegramId },
    });
    if (!creator) {
      res.status(404).json({ error: "Creator not found" });
      return;
    }

    const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h default

    const wager = await prisma.wager.create({
      data: {
        type: type || "DUEL",
        entryFee: entryFee.toString(),
        description: description || "Stack Game",
        deadline,
        chatId,
        creatorId: creator.id,
      },
      include: { creator: true, entries: true },
    });

    // Auto-create entry for creator
    await prisma.wagerEntry.create({
      data: { wagerId: wager.id, userId: creator.id },
    });

    res.status(201).json(wager);
  } catch (err) {
    console.error("Create wager error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getWager(req: Request, res: Response) {
  try {
    const wager = await prisma.wager.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        creator: true,
        entries: { include: { user: true } },
      },
    });
    if (!wager) {
      res.status(404).json({ error: "Wager not found" });
      return;
    }
    res.json(wager);
  } catch (err) {
    console.error("Get wager error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getUserWagers(req: Request, res: Response) {
  try {
    const user = await prisma.telegramUser.findUnique({
      where: { telegramId: req.params.telegramId },
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const wagers = await prisma.wager.findMany({
      where: {
        OR: [
          { creatorId: user.id },
          { entries: { some: { userId: user.id } } },
        ],
      },
      include: { creator: true, entries: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(wagers);
  } catch (err) {
    console.error("Get user wagers error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function acceptWager(req: Request, res: Response) {
  try {
    const wagerId = parseInt(req.params.id);
    const { telegramId } = req.body;

    const wager = await prisma.wager.findUnique({ where: { id: wagerId } });
    if (!wager || wager.status !== "PENDING_ACCEPTANCE") {
      res.status(400).json({ error: "Wager not available for acceptance" });
      return;
    }

    const opponent = await prisma.telegramUser.findUnique({
      where: { telegramId },
    });
    if (!opponent) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // DEV: allow self-accept for testing (use fake opponent ID)
    if (opponent.id === wager.creatorId) {
      // Create a test opponent user
      const testOpponent = await prisma.telegramUser.upsert({
        where: { telegramId: `test-opponent-${wagerId}` },
        update: {},
        create: {
          telegramId: `test-opponent-${wagerId}`,
          firstName: "TestOpponent",
          username: `test_opponent_${wagerId}`,
        },
      });
      await prisma.wagerEntry.create({
        data: { wagerId, userId: testOpponent.id },
      });
    } else {
      // Create entry for opponent
      await prisma.wagerEntry.create({
        data: { wagerId, userId: opponent.id },
      });
    }

    const updated = await prisma.wager.update({
      where: { id: wagerId },
      data: { status: "ACCEPTED" },
      include: { creator: true, entries: { include: { user: true } } },
    });

    res.json(updated);
  } catch (err) {
    console.error("Accept wager error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function fundWager(req: Request, res: Response) {
  try {
    const wagerId = parseInt(req.params.id);
    const { txHash, telegramId } = req.body;

    const user = await prisma.telegramUser.findUnique({
      where: { telegramId },
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const entry = await prisma.wagerEntry.findUnique({
      where: { wagerId_userId: { wagerId, userId: user.id } },
    });
    if (!entry) {
      res.status(404).json({ error: "Entry not found" });
      return;
    }

    await prisma.wagerEntry.update({
      where: { id: entry.id },
      data: { funded: true, depositTxHash: txHash },
    });

    // DEV: auto-fund test opponents + give them a random score
    const allEntries = await prisma.wagerEntry.findMany({
      where: { wagerId },
      include: { user: true },
    });
    for (const e of allEntries) {
      if (e.user.telegramId.startsWith("test-opponent-") && !e.funded) {
        const randomScore = Math.floor(Math.random() * 30) + 5;
        await prisma.wagerEntry.update({
          where: { id: e.id },
          data: {
            funded: true,
            depositTxHash: "0xdev-test-deposit",
            score: randomScore,
            playTimeMs: randomScore * 500,
            playedAt: new Date(),
          },
        });
      }
    }

    // Re-check after auto-fund
    const refreshedEntries = await prisma.wagerEntry.findMany({ where: { wagerId } });
    const allFunded = refreshedEntries.every((e) => e.funded);

    if (allFunded && allEntries.length >= 2) {
      const gameSeed = crypto.randomBytes(16).toString("hex");
      await prisma.wager.update({
        where: { id: wagerId },
        data: { status: "PLAYING", gameSeed },
      });
    } else {
      await prisma.wager.update({
        where: { id: wagerId },
        data: { status: "FUNDING" },
      });
    }

    const updated = await prisma.wager.findUnique({
      where: { id: wagerId },
      include: { entries: { include: { user: true } } },
    });
    res.json(updated);
  } catch (err) {
    console.error("Fund wager error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function cancelWager(req: Request, res: Response) {
  try {
    const wagerId = parseInt(req.params.id);
    const wager = await prisma.wager.findUnique({ where: { id: wagerId } });
    if (!wager) {
      res.status(404).json({ error: "Wager not found" });
      return;
    }

    if (!["PENDING_ACCEPTANCE", "ACCEPTED", "FUNDING"].includes(wager.status)) {
      res.status(400).json({ error: "Cannot cancel wager in current state" });
      return;
    }

    const updated = await prisma.wager.update({
      where: { id: wagerId },
      data: { status: "CANCELLED" },
    });
    res.json(updated);
  } catch (err) {
    console.error("Cancel wager error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
