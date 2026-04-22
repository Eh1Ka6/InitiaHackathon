import { PrismaClient } from "@prisma/client";
import { recordQualifiersOnChain, triggerRandomness } from "./drawResolver";

const prisma = new PrismaClient();

const TICK_MS = 30_000;
const QUALIFIER_GRACE_MS = 2 * 60 * 1000; // 2 min past deadline waiting for scores

/**
 * One tick of the draw lifecycle. Intentionally per-draw try/catch so a single
 * failure doesn't block other draws.
 */
async function tick(): Promise<void> {
  const now = new Date();

  /* --------------------------------------------------------------------- */
  /* 1. OPEN → AWAITING_QUALIFIERS: deadline has passed                     */
  /* --------------------------------------------------------------------- */
  const expiredOpen = await prisma.draw.findMany({
    where: { status: "OPEN", deadline: { lt: now } },
  });

  for (const draw of expiredOpen) {
    try {
      await prisma.draw.update({
        where: { id: draw.id },
        data: { status: "AWAITING_QUALIFIERS" },
      });
      console.log(`[drawLifecycleBot] Draw ${draw.id} OPEN → AWAITING_QUALIFIERS`);
    } catch (err) {
      console.error(
        `[drawLifecycleBot] Failed to transition draw ${draw.id} to AWAITING_QUALIFIERS:`,
        err
      );
    }
  }

  /* --------------------------------------------------------------------- */
  /* 2. AWAITING_QUALIFIERS → recordQualifiers on-chain                     */
  /*    condition: all deposited entries have a score, OR deadline+grace    */
  /* --------------------------------------------------------------------- */
  const awaiting = await prisma.draw.findMany({
    where: { status: "AWAITING_QUALIFIERS" },
    include: { entries: true },
  });

  for (const draw of awaiting) {
    try {
      const depositedEntries = draw.entries.filter((e) => e.deposited);
      const allScored =
        depositedEntries.length > 0 &&
        depositedEntries.every((e) => e.score !== null);

      const graceElapsed =
        draw.deadline.getTime() + QUALIFIER_GRACE_MS < now.getTime();

      if (allScored || graceElapsed) {
        await recordQualifiersOnChain(draw.id);
      }
    } catch (err) {
      console.error(
        `[drawLifecycleBot] recordQualifiersOnChain failed for draw ${draw.id}:`,
        err
      );
    }
  }

  /* --------------------------------------------------------------------- */
  /* 3. QUALIFIED → requestRandomness on-chain                              */
  /* --------------------------------------------------------------------- */
  const qualified = await prisma.draw.findMany({
    where: { status: "QUALIFIED" },
    include: { entries: true },
  });

  for (const draw of qualified) {
    try {
      const qualifierCount = draw.entries.filter((e) => e.qualified).length;
      if (qualifierCount > 0) {
        await triggerRandomness(draw.id);
      }
    } catch (err) {
      console.error(
        `[drawLifecycleBot] triggerRandomness failed for draw ${draw.id}:`,
        err
      );
    }
  }
}

export function startDrawLifecycleBot(): void {
  console.log(`[drawLifecycleBot] starting, tick=${TICK_MS}ms`);
  // Fire once immediately so transitions aren't delayed by up to TICK_MS on boot
  tick().catch((err) => console.error("[drawLifecycleBot] initial tick failed:", err));
  setInterval(() => {
    tick().catch((err) => console.error("[drawLifecycleBot] tick failed:", err));
  }, TICK_MS);
}
