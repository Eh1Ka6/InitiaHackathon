import { config } from "../config";
import { Wager, TelegramUser } from "../types";

const BASE = config.API_URL + "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error: ${res.status}`);
  }
  return res.json();
}

export const api = {
  ensureUser(data: { telegramId: string; username?: string; firstName: string; lastName?: string }) {
    return request<TelegramUser>("/auth/telegram", {
      method: "POST",
      body: JSON.stringify({ initData: `user=${JSON.stringify({ id: data.telegramId, username: data.username, first_name: data.firstName, last_name: data.lastName })}&auth_date=${Math.floor(Date.now() / 1000)}&hash=bot-internal` }),
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
};
