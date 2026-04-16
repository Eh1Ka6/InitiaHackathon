/** Seeded PRNG (mulberry32) */
export function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h |= 0;
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Get deterministic speed step for a given block index */
export function getSpeedStep(seed: string, blockIndex: number): number {
  const rng = seededRandom(seed + blockIndex.toString());
  return 3 + rng() * 5; // Range: 3-8 px/s increment
}
