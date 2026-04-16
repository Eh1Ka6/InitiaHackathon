import { Router } from "express";
import { getUser, linkWallet } from "../controllers/users";
import { authMiddleware } from "../middleware/telegramAuth";

export const userRoutes = Router();

userRoutes.get("/:tgId", getUser);
userRoutes.patch("/:tgId/wallet", authMiddleware, linkWallet);
