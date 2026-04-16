export function validateScore(
  score: number,
  playTimeMs: number
): { valid: boolean; reason?: string } {
  if (typeof score !== "number" || score < 0) {
    return { valid: false, reason: "Invalid score value" };
  }
  if (score > 500) {
    return { valid: false, reason: "Score exceeds maximum possible" };
  }
  if (typeof playTimeMs !== "number" || playTimeMs < 0) {
    return { valid: false, reason: "Invalid play time" };
  }

  // Min ~300ms per block at max speed
  const minTimeMs = score * 300;
  if (playTimeMs < minTimeMs) {
    return { valid: false, reason: "Play time too short for reported score" };
  }

  // Must have played at least 1 second
  if (playTimeMs < 1000 && score > 0) {
    return { valid: false, reason: "Play time suspiciously short" };
  }

  return { valid: true };
}
