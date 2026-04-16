const BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

let authToken = "";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const res = await fetch(`${BASE}${path}`, { headers, ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error: ${res.status}`);
  }
  return res.json();
}

export const api = {
  setAuthToken(token: string) {
    authToken = token;
  },

  login(initData: string) {
    return request<{ token: string; user: any }>("/auth/telegram", {
      method: "POST",
      body: JSON.stringify({ initData }),
    });
  },

  getWager(id: number) {
    return request<any>(`/wagers/${id}`);
  },

  getUserWagers(telegramId: string) {
    return request<any[]>(`/wagers/user/${telegramId}`);
  },

  submitScore(wagerId: number, score: number, playTimeMs: number) {
    return request<any>(`/wagers/${wagerId}/score`, {
      method: "POST",
      body: JSON.stringify({ score, playTimeMs }),
    });
  },

  fundWager(wagerId: number, txHash: string, telegramId: string) {
    return request<any>(`/wagers/${wagerId}/fund`, {
      method: "PATCH",
      body: JSON.stringify({ txHash, telegramId }),
    });
  },

  linkWallet(telegramId: string, walletAddress: string) {
    return request<any>(`/users/${telegramId}/wallet`, {
      method: "PATCH",
      body: JSON.stringify({ walletAddress }),
    });
  },
};
