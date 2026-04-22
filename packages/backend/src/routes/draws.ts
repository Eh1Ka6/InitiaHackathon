import { Router } from "express";
import {
  createDraw,
  getDraw,
  getActiveDraws,
  joinDraw,
  submitDrawScore,
} from "../controllers/draws";
import { authMiddleware } from "../middleware/telegramAuth";

export const drawRoutes = Router();

// Admin-only (x-admin-token header enforced inside controller)
drawRoutes.post("/", createDraw);

// Public reads
drawRoutes.get("/active", getActiveDraws);
drawRoutes.get("/:id", getDraw);

// Telegram-authed mutations
drawRoutes.post("/:id/join", authMiddleware, joinDraw);
drawRoutes.post("/:id/submit-score", authMiddleware, submitDrawScore);
