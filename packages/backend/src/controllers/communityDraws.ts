import { Request, Response } from "express";
import { ethers } from "ethers";
import { config } from "../config";
import {
  getCommunityDrawHubContract,
  getCommunityDrawHubReadOnly,
} from "../services/contract";

/**
 * On-chain Status enum — matches CommunityDrawHub.sol
 *   0 None, 1 Open, 2 RandomnessRequested, 3 Settled, 4 Cancelled
 */
const STATUS_NAMES = [
  "NONE",
  "OPEN",
  "RANDOMNESS_REQUESTED",
  "SETTLED",
  "CANCELLED",
] as const;

type CommunityDrawStatus = (typeof STATUS_NAMES)[number];

/** Matches packages/bot/src/types.ts → CommunityDraw */
interface CommunityDrawDto {
  id: number;
  onChainId: number | null;
  status: CommunityDrawStatus;
  title: string;
  creatorId: number;
  prizeAmount: string;
  ticketPrice: string;
  maxTickets: number;
  ticketsSold: number;
  winnerCount: number;
  endTimestamp: number; // seconds
  chatId: string;
  creatorAddress?: string;
}

function decodeTitle(titleBytes32: string): string {
  try {
    return ethers.decodeBytes32String(titleBytes32);
  } catch {
    // Non-null-terminated / non-utf8 fallback
    return titleBytes32;
  }
}

function encodeTitle(title: string): string {
  // Truncate to 32 bytes — the bot guarantees ≤ 32 bytes but we defend anyway.
  const buf = Buffer.from(title, "utf8").subarray(0, 32);
  const padded = Buffer.alloc(32);
  buf.copy(padded, 0);
  return "0x" + padded.toString("hex");
}

function dtoFromOnChain(
  drawId: number,
  raw: any,
  overrides: Partial<CommunityDrawDto> = {}
): CommunityDrawDto {
  // raw tuple ordering must match CommunityDrawHub.getCommunityDraw:
  //   [status, creator, title, prizeAmount, ticketPrice,
  //    maxTickets, ticketsSold, winnerCount, endTimestamp, vrfRequestId]
  const statusIdx = Number(raw[0]);
  return {
    id: drawId,
    onChainId: drawId,
    status: STATUS_NAMES[statusIdx] ?? "NONE",
    title: decodeTitle(raw[2]),
    creatorId: 0, // unknown — bot/miniapp resolves via wallet↔user table (not wired yet)
    prizeAmount: raw[3].toString(),
    ticketPrice: raw[4].toString(),
    maxTickets: Number(raw[5]),
    ticketsSold: Number(raw[6]),
    winnerCount: Number(raw[7]),
    endTimestamp: Number(raw[8]),
    chatId: overrides.chatId ?? "",
    creatorAddress: raw[1] as string,
    ...overrides,
  };
}

/**
 * GET /api/community-draws?status=OPEN&limit=5&orderBy=endTimestamp
 * Reads draws 1..nextDrawId-1 and filters in-memory.
 * Returns [] on read failure (prefer empty list over 404/503 so bot commands succeed).
 */
export async function listCommunityDraws(req: Request, res: Response) {
  try {
    const status = ((req.query.status as string) || "").toUpperCase();
    const limit = Math.min(parseInt((req.query.limit as string) || "20"), 100);
    const orderBy = (req.query.orderBy as string) || "endTimestamp";

    if (!config.COMMUNITY_DRAWHUB_ADDRESS) {
      console.warn(
        "[communityDraws] COMMUNITY_DRAWHUB_ADDRESS not set — returning []"
      );
      res.json([]);
      return;
    }

    const contract = getCommunityDrawHubReadOnly();

    let nextId: bigint;
    try {
      nextId = await contract.nextDrawId();
    } catch (err) {
      console.warn("[communityDraws] nextDrawId() read failed, returning []:", err);
      res.json([]);
      return;
    }

    const total = Number(nextId) - 1;
    if (total <= 0) {
      res.json([]);
      return;
    }

    // Iterate from newest back; cap at total and limit*6 to bound work.
    const maxScan = Math.min(total, limit * 10);
    const ids: number[] = [];
    for (let i = total; i > total - maxScan && i >= 1; i--) ids.push(i);

    const reads = await Promise.allSettled(
      ids.map((id) => contract.getCommunityDraw(id))
    );

    const draws: CommunityDrawDto[] = [];
    reads.forEach((r, idx) => {
      if (r.status === "fulfilled") {
        const dto = dtoFromOnChain(ids[idx], r.value);
        if (dto.status !== "NONE") draws.push(dto);
      }
    });

    let filtered = draws;
    if (status) filtered = filtered.filter((d) => d.status === status);

    if (orderBy === "endTimestamp") {
      filtered.sort((a, b) => a.endTimestamp - b.endTimestamp);
    }

    res.json(filtered.slice(0, limit));
  } catch (err: any) {
    console.error("[communityDraws] listCommunityDraws error:", err);
    // Per spec: prefer empty list over 404 so the bot can say "no draws yet"
    res.json([]);
  }
}

/**
 * GET /api/community-draws/:id
 */
export async function getCommunityDraw(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id) || id < 0) {
      res.status(400).json({ error: "Invalid draw id" });
      return;
    }

    if (!config.COMMUNITY_DRAWHUB_ADDRESS) {
      res.status(503).json({ error: "CommunityDrawHub address not configured" });
      return;
    }

    const contract = getCommunityDrawHubReadOnly();
    let raw: any;
    try {
      raw = await contract.getCommunityDraw(id);
    } catch (err: any) {
      res.status(503).json({
        error: `Failed to read draw from chain: ${err?.shortMessage || err?.message || "unknown"}`,
      });
      return;
    }

    const dto = dtoFromOnChain(id, raw);
    if (dto.status === "NONE") {
      res.status(404).json({ error: "Draw not found" });
      return;
    }
    res.json(dto);
  } catch (err: any) {
    console.error("[communityDraws] getCommunityDraw error:", err);
    res.status(503).json({ error: err?.message || "Failed to read draw" });
  }
}

/**
 * POST /api/community-draws
 * Body (from bot): { creatorTelegramId, title, prizeAmount, ticketPrice,
 *                    maxTickets, durationHours, winnerCount, chatId }
 * Gated by x-admin-token. Calls createCommunityDraw() via the backend signer
 * (which must hold COMMUNITY_CREATOR_ROLE and enough native INIT to stake the prize).
 *
 * NOTE: the real product should return an unsigned tx for the creator's wallet;
 * we sign here for the hackathon demo because the bot side expects a synchronous
 * CommunityDraw object back. Stub-safe if the signer is unauthorised.
 */
export async function createCommunityDraw(req: Request, res: Response) {
  try {
    const adminToken = req.header("x-admin-token");
    if (!config.ADMIN_TOKEN || adminToken !== config.ADMIN_TOKEN) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const {
      title,
      prizeAmount,
      ticketPrice,
      maxTickets,
      durationHours,
      winnerCount,
      chatId,
    } = req.body || {};

    if (
      !title ||
      prizeAmount === undefined ||
      ticketPrice === undefined ||
      !maxTickets ||
      !durationHours ||
      !winnerCount
    ) {
      res.status(400).json({
        error:
          "Missing fields: title, prizeAmount, ticketPrice, maxTickets, durationHours, winnerCount",
      });
      return;
    }

    if (!config.COMMUNITY_DRAWHUB_ADDRESS) {
      res.status(503).json({ error: "CommunityDrawHub address not configured" });
      return;
    }

    const prizeWei = BigInt(prizeAmount);
    const priceWei = BigInt(ticketPrice);
    const endTs = Math.floor(Date.now() / 1000) + Number(durationHours) * 3600;
    const titleBytes = encodeTitle(String(title));

    const contract = getCommunityDrawHubContract();

    let tx;
    try {
      tx = await contract.createCommunityDraw(
        titleBytes,
        prizeWei,
        priceWei,
        Number(maxTickets),
        endTs,
        Number(winnerCount),
        { value: prizeWei }
      );
    } catch (err: any) {
      console.error("[communityDraws] createCommunityDraw send failed:", err);
      res.status(503).json({
        error: `Chain tx failed: ${err?.shortMessage || err?.reason || err?.message || "unknown"}`,
      });
      return;
    }

    const receipt = await tx.wait();

    // Parse drawId from CommunityDrawCreated event.
    let onChainId: number | null = null;
    if (receipt?.logs) {
      for (const log of receipt.logs) {
        try {
          const parsed = contract.interface.parseLog({
            topics: Array.from(log.topics),
            data: log.data,
          });
          if (parsed?.name === "CommunityDrawCreated") {
            onChainId = Number(parsed.args[0]);
            break;
          }
        } catch {
          // not our event
        }
      }
    }

    // Build the DTO. We return the inputs echoed + onChainId so the bot has
    // something immediate; the miniapp can re-fetch live state from GET /:id.
    const dto: CommunityDrawDto = {
      id: onChainId ?? 0,
      onChainId,
      status: "OPEN",
      title: String(title).slice(0, 32),
      creatorId: 0,
      prizeAmount: prizeWei.toString(),
      ticketPrice: priceWei.toString(),
      maxTickets: Number(maxTickets),
      ticketsSold: 0,
      winnerCount: Number(winnerCount),
      endTimestamp: endTs,
      chatId: String(chatId ?? ""),
    };

    res.status(201).json(dto);
  } catch (err: any) {
    console.error("[communityDraws] createCommunityDraw error:", err);
    res.status(500).json({ error: err?.message || "Internal server error" });
  }
}

/**
 * POST /api/community-draws/:drawId/tickets
 * The bot calls this from its inline "Buy Ticket" callback flow, but the
 * ticket purchase MUST carry msg.value == ticketPrice from the buyer's wallet.
 * The real purchase happens in the miniapp (see buyTicketCallback which deep-
 * links to the webapp). This endpoint returns the current draw state so the
 * bot can confirm "purchase requested" without 404ing.
 */
export async function buyTicket(req: Request, res: Response) {
  try {
    const drawId = parseInt(req.params.drawId);
    if (!Number.isFinite(drawId) || drawId < 0) {
      res.status(400).json({ error: "Invalid drawId" });
      return;
    }

    if (!config.COMMUNITY_DRAWHUB_ADDRESS) {
      res.status(503).json({ error: "CommunityDrawHub address not configured" });
      return;
    }

    const contract = getCommunityDrawHubReadOnly();
    let raw: any;
    try {
      raw = await contract.getCommunityDraw(drawId);
    } catch (err: any) {
      res.status(503).json({
        error: `Failed to read draw: ${err?.shortMessage || err?.message || "unknown"}`,
      });
      return;
    }

    const dto = dtoFromOnChain(drawId, raw);
    if (dto.status === "NONE") {
      res.status(404).json({ error: "Draw not found" });
      return;
    }
    if (dto.status !== "OPEN") {
      res.status(400).json({ error: `Draw not open (status=${dto.status})` });
      return;
    }
    if (dto.ticketsSold >= dto.maxTickets) {
      res.status(400).json({ error: "Sold out" });
      return;
    }

    // Return unsigned tx data for the miniapp to sign. Shape matches the
    // CommunityDraw response the bot expects; we attach an `unsignedTx`
    // field so the miniapp / future bot flow can use it.
    const iface = contract.interface;
    const data = iface.encodeFunctionData("buyTicket", [drawId]);

    res.json({
      ...dto,
      unsignedTx: {
        to: config.COMMUNITY_DRAWHUB_ADDRESS,
        data,
        value: dto.ticketPrice,
        chainId: config.INITIA_CHAIN_ID,
      },
    });
  } catch (err: any) {
    console.error("[communityDraws] buyTicket error:", err);
    res.status(500).json({ error: err?.message || "Internal server error" });
  }
}
