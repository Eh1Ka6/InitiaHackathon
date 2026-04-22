import { PrismaClient } from "@prisma/client";
import { getDrawHubContract } from "./contract";

const prisma = new PrismaClient();

// 80% qualifier filter — the backend's "trusted" score threshold.
// MULTICHAIN_PLAN.md Section 0(a) + Section 3 step 2: we filter off-chain
// and only publish qualifier addresses to DrawHub. Using `score >= 80` as
// the concrete backend threshold for hackathon scope.
const MAX_SCORE_FOR_80PCT = 80;

/**
 * Read DrawEntry records for a draw and return the addresses whose score
 * clears the 80% threshold. Only considers entries that actually deposited
 * on-chain (deposited=true) and have a submitted score.
 */
export async function filterQualifiers(drawId: number): Promise<string[]> {
  const entries = await prisma.drawEntry.findMany({
    where: {
      drawId,
      deposited: true,
      score: { not: null },
    },
  });

  return entries
    .filter((e) => (e.score ?? 0) >= MAX_SCORE_FOR_80PCT)
    .map((e) => e.walletAddress);
}

/**
 * Compute qualifiers and push them on-chain.
 *   - Zero qualifiers → DrawHub.cancelDraw(onChainDrawId), DB status=CANCELLED.
 *   - >0 qualifiers   → DrawHub.recordQualifiers(...), DB status=QUALIFIED,
 *                       mark matching entries qualified=true.
 */
export async function recordQualifiersOnChain(drawId: number): Promise<void> {
  const draw = await prisma.draw.findUnique({ where: { id: drawId } });
  if (!draw) throw new Error(`Draw ${drawId} not found`);

  const qualifiers = await filterQualifiers(drawId);
  const contract = getDrawHubContract();

  if (qualifiers.length === 0) {
    console.log(`[drawResolver] Draw ${drawId} has 0 qualifiers — cancelling on-chain`);
    const tx = await contract.cancelDraw(draw.onChainDrawId);
    await tx.wait();
    await prisma.draw.update({
      where: { id: drawId },
      data: { status: "CANCELLED" },
    });
    return;
  }

  console.log(
    `[drawResolver] Draw ${drawId}: recording ${qualifiers.length} qualifiers on-chain`
  );
  const tx = await contract.recordQualifiers(draw.onChainDrawId, qualifiers);
  await tx.wait();

  // Mark entries qualified in DB (case-insensitive address match)
  const lowerQualifiers = new Set(qualifiers.map((a) => a.toLowerCase()));
  const entries = await prisma.drawEntry.findMany({ where: { drawId } });
  for (const e of entries) {
    if (lowerQualifiers.has(e.walletAddress.toLowerCase())) {
      await prisma.drawEntry.update({
        where: { id: e.id },
        data: { qualified: true },
      });
    }
  }

  await prisma.draw.update({
    where: { id: drawId },
    data: { status: "QUALIFIED" },
  });
}

/**
 * Trigger Band VRF via DrawHub.requestRandomness and transition
 * DB status to RANDOMNESS_REQUESTED.
 */
export async function triggerRandomness(drawId: number): Promise<void> {
  const draw = await prisma.draw.findUnique({ where: { id: drawId } });
  if (!draw) throw new Error(`Draw ${drawId} not found`);

  const contract = getDrawHubContract();
  console.log(`[drawResolver] Draw ${drawId}: requesting randomness on-chain`);
  const tx = await contract.requestRandomness(draw.onChainDrawId);
  await tx.wait();

  await prisma.draw.update({
    where: { id: drawId },
    data: { status: "RANDOMNESS_REQUESTED" },
  });
}
