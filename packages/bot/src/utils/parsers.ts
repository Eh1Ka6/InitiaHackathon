export function parseWagerCommand(text: string): { opponent: string; amount: string } | null {
  if (!text || !text.trim()) return null;

  const parts = text.trim().split(/\s+/);
  if (parts.length < 2) return null;

  let opponent = parts[0];
  if (opponent.startsWith("@")) opponent = opponent.slice(1);

  const amount = parts[1];
  if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) return null;

  return { opponent, amount };
}

export function parsePoolCommand(text: string): { description: string; duration: string } | null {
  if (!text || !text.trim()) return null;

  const parts = text.trim();
  // Last word is duration if it matches pattern like 1h, 12h, 24h, 7d
  const durationMatch = parts.match(/\s+(\d+[hHdD])$/);

  if (durationMatch) {
    return {
      description: parts.slice(0, durationMatch.index).trim(),
      duration: durationMatch[1].toLowerCase(),
    };
  }

  return { description: parts, duration: "24h" };
}

export function parseCancelCommand(text: string): number | null {
  const id = parseInt(text?.trim());
  return isNaN(id) ? null : id;
}

export function parseStatusCommand(text: string): number | null {
  if (!text?.trim()) return null;
  const id = parseInt(text.trim());
  return isNaN(id) ? null : id;
}

export interface ParsedCreateDraw {
  title: string;
  titleTruncated: boolean;
  prizeAmount: string;
  ticketPrice: string;
  maxTickets: number;
  durationHours: number;
  winnerCount: number;
}

/**
 * Parse: /createdraw "title with spaces" <prize> <ticketPrice> <maxTickets> <durationHours> [winnerCount]
 * Or:    /createdraw title <prize> <ticketPrice> <maxTickets> <durationHours> [winnerCount]
 * title must be <= 32 bytes UTF-8; longer titles are truncated and a flag is returned.
 */
export function parseCreateDrawCommand(text: string): ParsedCreateDraw | null {
  if (!text || !text.trim()) return null;

  const raw = text.trim();

  // Support quoted title: "my title" <args...>
  let title: string;
  let rest: string;
  const quoted = raw.match(/^"([^"]+)"\s+(.+)$/);
  if (quoted) {
    title = quoted[1].trim();
    rest = quoted[2].trim();
  } else {
    const parts = raw.split(/\s+/);
    if (parts.length < 5) return null;
    title = parts[0];
    rest = parts.slice(1).join(" ");
  }

  const args = rest.split(/\s+/);
  if (args.length < 4) return null;

  const prizeAmount = args[0];
  const ticketPrice = args[1];
  const maxTickets = parseInt(args[2]);
  const durationHours = parseFloat(args[3]);
  const winnerCount = args[4] !== undefined ? parseInt(args[4]) : 1;

  if (isNaN(parseFloat(prizeAmount)) || parseFloat(prizeAmount) <= 0) return null;
  if (isNaN(parseFloat(ticketPrice)) || parseFloat(ticketPrice) <= 0) return null;
  if (isNaN(maxTickets) || maxTickets <= 0) return null;
  if (isNaN(durationHours) || durationHours <= 0) return null;
  if (isNaN(winnerCount) || winnerCount <= 0 || winnerCount > maxTickets) return null;

  // Truncate title to 32 bytes (UTF-8) for bytes32 on-chain
  let titleTruncated = false;
  const encoded = Buffer.from(title, "utf8");
  if (encoded.length > 32) {
    // Truncate at byte boundary, then decode back (may drop trailing partial multibyte char)
    const truncated = encoded.subarray(0, 32).toString("utf8").replace(/�+$/, "");
    title = truncated;
    titleTruncated = true;
  }

  return {
    title,
    titleTruncated,
    prizeAmount,
    ticketPrice,
    maxTickets,
    durationHours,
    winnerCount,
  };
}
