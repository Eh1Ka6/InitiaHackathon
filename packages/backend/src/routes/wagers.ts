import { Router } from "express";
import {
  createWager,
  getWager,
  getUserWagers,
  acceptWager,
  fundWager,
  cancelWager,
} from "../controllers/wagers";
import { submitScore } from "../controllers/scores";
import { authMiddleware } from "../middleware/telegramAuth";

export const wagerRoutes = Router();

wagerRoutes.post("/", createWager);
wagerRoutes.get("/:id", getWager);
wagerRoutes.get("/user/:telegramId", getUserWagers);
wagerRoutes.patch("/:id/accept", acceptWager);
wagerRoutes.patch("/:id/fund", fundWager);
wagerRoutes.post("/:id/score", submitScore);
wagerRoutes.patch("/:id/cancel", cancelWager);

// DEV: simulate test opponent deposit + score
wagerRoutes.post("/:id/dev-opponent", async (req, res) => {
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const wagerId = parseInt(req.params.id);
    const wager = await prisma.wager.findUnique({
      where: { id: wagerId },
      include: { entries: true },
    });
    if (!wager) { res.status(404).json({ error: "Wager not found" }); return; }
    const testEntry = wager.entries.find((e: any) =>
      e.userId !== wager.creatorId
    );
    if (!testEntry) { res.status(404).json({ error: "No opponent entry" }); return; }

    // Mark test opponent as funded + submit random score
    const randomScore = Math.floor(Math.random() * 30) + 5;
    await prisma.wagerEntry.update({
      where: { id: testEntry.id },
      data: {
        funded: true,
        depositTxHash: "0xdev-test-deposit",
        score: randomScore,
        playTimeMs: randomScore * 500,
        playedAt: new Date(),
      },
    });

    // If wager was FUNDING/ACCEPTED, move to PLAYING
    if (["ACCEPTED", "FUNDING"].includes(wager.status)) {
      const crypto = require("crypto");
      await prisma.wager.update({
        where: { id: wagerId },
        data: {
          status: "PLAYING",
          gameSeed: crypto.randomBytes(16).toString("hex"),
        },
      });
    }

    res.json({
      message: "Test opponent activated",
      opponentScore: randomScore,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
