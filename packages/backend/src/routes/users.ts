import { Router } from "express";
import { getUser, linkWallet, upsertUser } from "../controllers/users";
import { authMiddleware } from "../middleware/telegramAuth";

export const userRoutes = Router();

userRoutes.post("/", upsertUser);
userRoutes.get("/:tgId", getUser);
userRoutes.patch("/:tgId/wallet", authMiddleware, linkWallet);
