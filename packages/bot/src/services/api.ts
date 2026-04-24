import { config } from "../config";
import { Wager, TelegramUser, CommunityDraw } from "../types";

const BASE = config.API_URL + "/api";

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, options?: RequestInit & { admin?: boolean }): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options?.admin && config.ADMIN_TOKEN) {
    headers["x-admin-token"] = config.ADMIN_TOKEN;
  }
  const { admin: _omit, ...rest } = options || {};
  const res = await fetch(`${BASE}${path}`, { headers, ...rest });
  if (!res.ok) {
    const body: any = await res.json().catch(() => ({}));
    throw new ApiError(body.error || `API error: ${res.status}`, res.status, body.code);
  }
  return res.json();
}

export const api = {
  ensureUser(data: { telegramId: string; username?: string; firstName: string; lastName?: string }) {
    return request<TelegramUser>("/users", {
      method: "POST",
      body: JSON.stringify(data),
    }).catch(() => null); // Non-critical
  },

  createWager(data: { creatorTelegramId: string; opponentUsername?: string; entryFee: string; description?: string; chatId: string }) {
    return request<Wager>("/wagers", { method: "POST", body: JSON.stringify(data) });
  },

  getWager(id: number) {
    return request<Wager>(`/wagers/${id}`);
  },

  getUserWagers(telegramId: string) {
    return request<Wager[]>(`/wagers/user/${telegramId}`);
  },

  acceptWager(wagerId: number, telegramId: string) {
    return request<Wager>(`/wagers/${wagerId}/accept`, {
      method: "PATCH",
      body: JSON.stringify({ telegramId }),
    });
  },

  cancelWager(wagerId: number) {
    return request<Wager>(`/wagers/${wagerId}/cancel`, { method: "PATCH" });
  },

  createPool(data: { creatorTelegramId: string; description: string; chatId: string; entryFee: string; duration: string }) {
    return request<Wager>("/wagers", {
      method: "POST",
      body: JSON.stringify({ ...data, type: "POOL" }),
    });
  },

  joinPool(poolId: number, telegramId: string, side: number) {
    return request<any>(`/wagers/${poolId}/accept`, {
      method: "PATCH",
      body: JSON.stringify({ telegramId, side }),
    });
  },

  // ---- Community Draws (CommunityDrawHub) ----

  createCommunityDraw(data: {
    creatorTelegramId: string;
    title: string;
    prizeAmount: string;
    ticketPrice: string;
    maxTickets: number;
    durationHours: number;
    winnerCount: number;
    chatId: string;
  }) {
    return request<CommunityDraw>("/community-draws", {
      method: "POST",
      body: JSON.stringify(data),
      admin: true,
    });
  },

  getCommunityDraw(id: number) {
    return request<CommunityDraw>(`/community-draws/${id}`);
  },

  listOpenCommunityDraws(limit = 5) {
    return request<CommunityDraw[]>(`/community-draws?status=OPEN&limit=${limit}&orderBy=endTimestamp`);
  },

  buyCommunityTicket(drawId: number, telegramId: string) {
    return request<CommunityDraw>(`/community-draws/${drawId}/tickets`, {
      method: "POST",
      body: JSON.stringify({ telegramId }),
    });
  },
};
