import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { validateTelegramInitData } from "../middleware/telegramAuth";
import { config } from "../config";

const prisma = new PrismaClient();

export async function login(req: Request, res: Response) {
  try {
    const { initData } = req.body;
    if (!initData) {
      res.status(400).json({ error: "Missing initData" });
      return;
    }

    if (!validateTelegramInitData(initData, config.BOT_TOKEN)) {
      res.status(401).json({ error: "Invalid Telegram data" });
      return;
    }

    const params = new URLSearchParams(initData);
    const userStr = params.get("user");
    if (!userStr) {
      res.status(400).json({ error: "No user data in initData" });
      return;
    }

    const tgUser = JSON.parse(userStr);
    const user = await prisma.telegramUser.upsert({
      where: { telegramId: tgUser.id.toString() },
      update: {
        username: tgUser.username || null,
        firstName: tgUser.first_name,
        lastName: tgUser.last_name || null,
      },
      create: {
        telegramId: tgUser.id.toString(),
        username: tgUser.username || null,
        firstName: tgUser.first_name,
        lastName: tgUser.last_name || null,
      },
    });

    const token = jwt.sign(
      { userId: user.id, telegramId: user.telegramId },
      config.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({ token, user });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
