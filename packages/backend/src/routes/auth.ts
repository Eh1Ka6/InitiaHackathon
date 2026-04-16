import { Router } from "express";
import { login } from "../controllers/auth";

export const authRoutes = Router();

authRoutes.post("/telegram", login);
