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
