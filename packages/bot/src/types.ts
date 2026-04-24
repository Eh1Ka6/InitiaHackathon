export interface TelegramUser {
  id: number;
  telegramId: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  walletAddress: string | null;
  initiaUsername: string | null;
}

export interface WagerEntry {
  id: number;
  wagerId: number;
  userId: number;
  user: TelegramUser;
  side: number;
  funded: boolean;
  score: number | null;
  playTimeMs: number | null;
  payout: string | null;
}

export interface Wager {
  id: number;
  onChainId: number | null;
  type: "DUEL" | "POOL";
  status: string;
  description: string;
  entryFee: string;
  deadline: string;
  maxPlayers: number;
  creatorId: number;
  creator: TelegramUser;
  chatId: string;
  messageId: string | null;
  gameSeed: string | null;
  winnerId: number | null;
  entries: WagerEntry[];
}

export type CommunityDrawStatus =
  | "NONE"
  | "OPEN"
  | "RANDOMNESS_REQUESTED"
  | "SETTLED"
  | "CANCELLED";

export interface CommunityDraw {
  id: number;
  onChainId: number | null;
  status: CommunityDrawStatus;
  title: string;
  creatorId: number;
  creator?: TelegramUser;
  prizeAmount: string;
  ticketPrice: string;
  maxTickets: number;
  ticketsSold: number;
  winnerCount: number;
  endTimestamp: number; // seconds
  chatId: string;
}
