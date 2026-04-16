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
wagerRoutes.patch("/:id/fund", authMiddleware, fundWager);
wagerRoutes.post("/:id/score", authMiddleware, submitScore);
wagerRoutes.patch("/:id/cancel", cancelWager);
