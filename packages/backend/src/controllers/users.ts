import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthRequest } from "../middleware/telegramAuth";

const prisma = new PrismaClient();

export async function upsertUser(req: Request, res: Response) {
  try {
    const { telegramId, username, firstName, lastName, email } = req.body;
    if (!telegramId || !firstName) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }
    const user = await prisma.telegramUser.upsert({
      where: { telegramId: telegramId.toString() },
      update: {
        username: username || undefined,
        firstName,
        lastName: lastName || undefined,
        email: email || undefined,
      },
      create: {
        telegramId: telegramId.toString(),
        username: username || null,
        firstName,
        lastName: lastName || null,
        email: email || null,
      },
    });
    res.json(user);
  } catch (err) {
    console.error("Upsert user error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getUser(req: Request, res: Response) {
  try {
    const user = await prisma.telegramUser.findUnique({
      where: { telegramId: req.params.tgId },
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(user);
  } catch (err) {
    console.error("Get user error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function linkWallet(req: AuthRequest, res: Response) {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) {
      res.status(400).json({ error: "Missing walletAddress" });
      return;
    }

    const user = await prisma.telegramUser.update({
      where: { telegramId: req.params.tgId },
      data: { walletAddress },
    });
    res.json(user);
  } catch (err) {
    console.error("Link wallet error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
