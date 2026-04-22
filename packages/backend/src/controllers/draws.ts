import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { config } from "../config";
import { getDrawHubContract } from "../services/contract";
import { validateScore } from "../services/antiCheat";
import { AuthRequest } from "../middleware/telegramAuth";

const prisma = new PrismaClient();

/**
 * POST /api/draws
 * Admin-only. Requires header `x-admin-token` matching env ADMIN_TOKEN.
 * Body: { entryFee, deadline, multiplierConfigId, gameSeed? }
 */
export async function createDraw(req: Request, res: Response) {
  try {
    const adminToken = req.header("x-admin-token");
    if (!config.ADMIN_TOKEN || adminToken !== config.ADMIN_TOKEN) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { entryFee, deadline, multiplierConfigId, gameSeed } = req.body;
    if (
      entryFee === undefined ||
      deadline === undefined ||
      multiplierConfigId === undefined
    ) {
      res.status(400).json({ error: "Missing entryFee, deadline, or multiplierConfigId" });
      return;
    }

    // onChainDrawId: simple unique id. Date.now() is plenty for hackathon scope
    // and fits safely in a uint256 on-chain.
    const onChainDrawId = Date.now().toString();
    const deadlineDate = new Date(deadline);
    const deadlineSec = Math.floor(deadlineDate.getTime() / 1000);

    // Call DrawHub.createDraw on-chain
    const contract = getDrawHubContract();
    const tx = await contract.createDraw(
      onChainDrawId,
      BigInt(entryFee),
      BigInt(deadlineSec),
      Number(multiplierConfigId)
    );
    const receipt = await tx.wait();

    const draw = await prisma.draw.create({
      data: {
        onChainDrawId,
        status: "OPEN",
        entryFee: entryFee.toString(),
        deadline: deadlineDate,
        multiplierConfigId: Number(multiplierConfigId),
        gameSeed: gameSeed ?? null,
        txHashCreate: receipt?.hash ?? tx.hash,
      },
    });

    res.status(201).json(draw);
  } catch (err: any) {
    console.error("createDraw error:", err);
    res.status(500).json({ error: err?.message || "Internal server error" });
  }
}

/**
 * GET /api/draws/:id
 * Returns the draw (with entries) + best-effort on-chain status snapshot.
 */
export async function getDraw(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    const draw = await prisma.draw.findUnique({
      where: { id },
      include: { entries: { include: { user: true } } },
    });
    if (!draw) {
      res.status(404).json({ error: "Draw not found" });
      return;
    }

    let onChain: any = null;
    if (config.DRAWHUB_ADDRESS) {
      try {
        const contract = getDrawHubContract();
        const raw = await contract.getDraw(draw.onChainDrawId);
        // Real ABI: [status, configId, deadline, entryFee, vrfReqId, winner, multiplier, payout]
        const parts = await contract.getParticipants(draw.onChainDrawId);
        const quals = await contract.getQualifiers(draw.onChainDrawId);
        onChain = {
          status: Number(raw[0]),
          multiplierConfigId: Number(raw[1]),
          deadline: Number(raw[2]),
          entryFee: raw[3].toString(),
          vrfRequestId: raw[4].toString(),
          winner: raw[5],
          multiplier: Number(raw[6]),
          payout: raw[7].toString(),
          participantsCount: parts.length,
          qualifiersCount: quals.length,
        };
      } catch (err) {
        // swallow — on-chain view is optional enrichment
      }
    }

    res.json({ ...draw, onChain });
  } catch (err) {
    console.error("getDraw error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/draws/active
 * All draws with status in (OPEN, AWAITING_QUALIFIERS, QUALIFIED, RANDOMNESS_REQUESTED).
 */
export async function getActiveDraws(_req: Request, res: Response) {
  try {
    const draws = await prisma.draw.findMany({
      where: {
        status: {
          in: ["OPEN", "AWAITING_QUALIFIERS", "QUALIFIED", "RANDOMNESS_REQUESTED"],
        },
      },
      include: { entries: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(draws);
  } catch (err) {
    console.error("getActiveDraws error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /api/draws/:id/join
 * Telegram-authed. Body: { walletAddress, homeChainId }.
 * Records the user's *intent* to join. The eventListener flips deposited=true
 * once the on-chain ParticipantEnrolled event fires.
 */
export async function joinDraw(req: AuthRequest, res: Response) {
  try {
    const drawId = parseInt(req.params.id);
    const { walletAddress, homeChainId } = req.body;
    if (!walletAddress || !homeChainId) {
      res.status(400).json({ error: "Missing walletAddress or homeChainId" });
      return;
    }
    if (!req.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const draw = await prisma.draw.findUnique({ where: { id: drawId } });
    if (!draw) {
      res.status(404).json({ error: "Draw not found" });
      return;
    }
    if (draw.status !== "OPEN") {
      res.status(400).json({ error: `Draw not open (status=${draw.status})` });
      return;
    }
    if (draw.deadline.getTime() < Date.now()) {
      res.status(400).json({ error: "Draw deadline has passed" });
      return;
    }

    const entry = await prisma.drawEntry.upsert({
      where: {
        drawId_walletAddress: { drawId, walletAddress },
      },
      update: {
        homeChainId: String(homeChainId),
      },
      create: {
        drawId,
        userId: req.userId,
        walletAddress,
        homeChainId: String(homeChainId),
      },
    });

    res.status(201).json(entry);
  } catch (err: any) {
    console.error("joinDraw error:", err);
    res.status(500).json({ error: err?.message || "Internal server error" });
  }
}

/**
 * POST /api/draws/:id/submit-score
 * Telegram-authed. Body: { score, playTimeMs, walletAddress }.
 */
export async function submitDrawScore(req: AuthRequest, res: Response) {
  try {
    const drawId = parseInt(req.params.id);
    const { score, playTimeMs, walletAddress } = req.body;

    if (!req.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!walletAddress) {
      res.status(400).json({ error: "Missing walletAddress" });
      return;
    }

    const validation = validateScore(score, playTimeMs);
    if (!validation.valid) {
      res.status(400).json({ error: `Invalid score: ${validation.reason}` });
      return;
    }

    const entry = await prisma.drawEntry.findUnique({
      where: {
        drawId_walletAddress: { drawId, walletAddress },
      },
    });
    if (!entry) {
      res.status(404).json({ error: "Draw entry not found" });
      return;
    }
    if (entry.userId !== req.userId) {
      res.status(403).json({ error: "Not your entry" });
      return;
    }
    if (entry.score !== null) {
      res.status(400).json({ error: "Score already submitted" });
      return;
    }

    const updated = await prisma.drawEntry.update({
      where: { id: entry.id },
      data: {
        score,
        playTimeMs,
        playedAt: new Date(),
      },
    });

    res.json(updated);
  } catch (err: any) {
    console.error("submitDrawScore error:", err);
    res.status(500).json({ error: err?.message || "Internal server error" });
  }
}
