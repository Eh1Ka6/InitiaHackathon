import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { config } from "../config";

export function validateTelegramInitData(initData: string, botToken: string): boolean {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return false;
  params.delete("hash");

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (computedHash !== hash) return false;

  const authDate = params.get("auth_date");
  if (authDate) {
    const age = Math.floor(Date.now() / 1000) - parseInt(authDate);
    if (age > 300) return false; // 5 min max
  }

  return true;
}

export interface AuthRequest extends Request {
  userId?: number;
  telegramId?: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization token" });
    return;
  }

  try {
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, config.JWT_SECRET) as { userId: number; telegramId: string };
    req.userId = decoded.userId;
    req.telegramId = decoded.telegramId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}
