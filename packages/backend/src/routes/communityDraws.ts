import { Router } from "express";
import {
  listCommunityDraws,
  getCommunityDraw,
  createCommunityDraw,
  buyTicket,
} from "../controllers/communityDraws";

export const communityDrawRoutes = Router();

// Public reads
communityDrawRoutes.get("/", listCommunityDraws);
communityDrawRoutes.get("/:id", getCommunityDraw);

// Admin-only (x-admin-token header enforced inside controller)
communityDrawRoutes.post("/", createCommunityDraw);

// Returns unsigned tx for the miniapp / bot to forward to the buyer's wallet
communityDrawRoutes.post("/:drawId/tickets", buyTicket);
