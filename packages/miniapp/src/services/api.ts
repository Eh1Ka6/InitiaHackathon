const BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
const MOCK = import.meta.env.VITE_MOCK_API === "true";

let authToken = "";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Bypass-Tunnel-Reminder": "true",
  };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  // Include Telegram initData in a second header so the backend can verify it
  const initData =
    typeof window !== "undefined"
      ? window.Telegram?.WebApp?.initData || ""
      : "";
  if (initData) headers["X-Telegram-Init-Data"] = initData;

  const res = await fetch(`${BASE}${path}`, { headers, ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error: ${res.status}`);
  }
  return res.json();
}

// --- Draw types ---

export type DrawStatus =
  | "OPEN"
  | "AWAITING_QUALIFIERS"
  | "QUALIFIED"
  | "RANDOMNESS_REQUESTED"
  | "SETTLED"
  | "CANCELLED";

export interface DrawParticipant {
  walletAddress: string;
  homeChainId: string; // "137" | "56" | "interwoven-1"
  displayName?: string;
  score?: number;
  qualified?: boolean;
  isWinner?: boolean;
}

export interface Draw {
  id: string;
  status: DrawStatus;
  entryFeeInit: string; // e.g. "1"
  deadline: number; // unix ms
  multiplierConfigId: number; // 0..3
  participants: DrawParticipant[];
  maxParticipants: number;
  finalMultiplier?: number;
  winner?: string;
  payoutInit?: string;
  createdAt: number;
}

// --- Mock data ---

function mockDraws(): Draw[] {
  const now = Date.now();
  return [
    {
      id: "1",
      status: "OPEN",
      entryFeeInit: "1",
      deadline: now + 15 * 60 * 1000,
      multiplierConfigId: 0,
      participants: [
        {
          walletAddress: "init1abcd1234567890",
          homeChainId: "interwoven-1",
          displayName: "Player C",
        },
      ],
      maxParticipants: 3,
      createdAt: now - 60_000,
    },
    {
      id: "2",
      status: "OPEN",
      entryFeeInit: "5",
      deadline: now + 20 * 60 * 1000,
      multiplierConfigId: 1,
      participants: [],
      maxParticipants: 3,
      createdAt: now - 30_000,
    },
  ];
}

function mockDraw(id: string): Draw {
  const all = mockDraws();
  const found = all.find((d) => d.id === id);
  if (found) return found;
  return {
    ...all[0],
    id,
  };
}

// --- API ---

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

  submitScore(
    wagerId: number,
    score: number,
    playTimeMs: number,
    telegramId: string
  ) {
    return request<any>(`/wagers/${wagerId}/score`, {
      method: "POST",
      body: JSON.stringify({ score, playTimeMs, telegramId }),
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

  // --- Draw endpoints ---

  async getActiveDraws(): Promise<Draw[]> {
    if (MOCK) return mockDraws();
    try {
      return await request<Draw[]>(`/draws/active`);
    } catch (err) {
      console.warn(
        "[api.getActiveDraws] backend not ready, using mock data:",
        err
      );
      return mockDraws();
    }
  },

  async getDraw(id: string): Promise<Draw> {
    if (MOCK) return mockDraw(id);
    try {
      return await request<Draw>(`/draws/${id}`);
    } catch (err) {
      console.warn("[api.getDraw] backend not ready, using mock data:", err);
      return mockDraw(id);
    }
  },

  async joinDraw(
    id: string,
    walletAddress: string,
    homeChainId: string
  ): Promise<void> {
    if (MOCK) return;
    try {
      await request<void>(`/draws/${id}/join`, {
        method: "POST",
        body: JSON.stringify({ walletAddress, homeChainId }),
      });
    } catch (err) {
      console.warn("[api.joinDraw] backend error (mock fallback):", err);
    }
  },

  async submitDrawScore(
    id: string,
    score: number,
    playTimeMs: number,
    walletAddress: string
  ): Promise<void> {
    if (MOCK) return;
    try {
      await request<void>(`/draws/${id}/submit-score`, {
        method: "POST",
        body: JSON.stringify({ score, playTimeMs, walletAddress }),
      });
    } catch (err) {
      console.warn("[api.submitDrawScore] backend error (mock fallback):", err);
    }
  },
};
