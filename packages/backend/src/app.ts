import express from "express";
import cors from "cors";
import { authRoutes } from "./routes/auth";
import { userRoutes } from "./routes/users";
import { wagerRoutes } from "./routes/wagers";

export const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/wagers", wagerRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "weezwager-backend" });
});
