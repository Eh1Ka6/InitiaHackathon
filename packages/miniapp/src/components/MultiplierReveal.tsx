import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  /** Final multiplier to land on (e.g. 8, 10, 20, 50, 100, 300). */
  finalMultiplier: number;
  /** Total duration in ms, before settling. Default 2500. */
  durationMs?: number;
  /** Fires when the reveal has settled. */
  onComplete?: () => void;
}

const SEQUENCE = [8, 10, 20, 50, 100, 300];

export default function MultiplierReveal({
  finalMultiplier,
  durationMs = 2500,
  onComplete,
}: Props) {
  const [idx, setIdx] = useState(0);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const start = performance.now();
    const tick = () => {
      if (cancelled) return;
      const elapsed = performance.now() - start;
      const t = Math.min(1, elapsed / durationMs);
      // Ease-out so flickers slow down before landing
      const eased = 1 - Math.pow(1 - t, 3);
      const flickersPerSecond = 12;
      const totalFlickers = Math.floor(
        (durationMs / 1000) * flickersPerSecond * (1 - eased) + eased * 4
      );
      setIdx((prev) => (prev + Math.max(1, totalFlickers % 6)) % SEQUENCE.length);
      if (t < 1) {
        setTimeout(tick, 60 + eased * 160);
      } else {
        const finalIdx = SEQUENCE.indexOf(finalMultiplier);
        setIdx(finalIdx >= 0 ? finalIdx : 0);
        setSettled(true);
        onComplete?.();
      }
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [finalMultiplier, durationMs, onComplete]);

  const value = settled ? finalMultiplier : (SEQUENCE[idx] ?? SEQUENCE[0]);

  return (
    <div className="flex flex-col items-center justify-center">
      <div
        className="text-white/60 text-[10px] uppercase tracking-[0.4em] mb-3"
        style={{ fontWeight: 500 }}
      >
        Multiplier
      </div>
      <div
        className="relative"
        style={{ perspective: "600px" }}
      >
        <AnimatePresence mode="popLayout">
          <motion.div
            key={`${value}-${settled}`}
            initial={{ scale: 0.6, opacity: 0, rotateX: -40 }}
            animate={{
              scale: settled ? 1 : 1.05,
              opacity: 1,
              rotateX: 0,
            }}
            exit={{ scale: 0.6, opacity: 0, rotateX: 40 }}
            transition={{
              type: "spring",
              damping: settled ? 10 : 20,
              stiffness: settled ? 140 : 400,
            }}
            className="text-center"
            style={{
              fontFamily: "'Orbitron', monospace",
              fontSize: "clamp(5rem, 22vw, 8rem)",
              fontWeight: 900,
              letterSpacing: "-4px",
              lineHeight: 1,
              background: settled
                ? "linear-gradient(135deg, #FFD700, #FF4D6D, #A855F7)"
                : "linear-gradient(135deg, #40C4FF, #A855F7)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: settled
                ? "drop-shadow(0 0 60px rgba(255,215,0,0.6))"
                : "drop-shadow(0 0 40px rgba(64,196,255,0.5))",
            }}
          >
            x{value}
          </motion.div>
        </AnimatePresence>
        {settled && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full border-2 pointer-events-none"
              style={{ borderColor: "rgba(255,215,0,0.6)" }}
              initial={{ scale: 0.4, opacity: 1 }}
              animate={{ scale: 3, opacity: 0 }}
              transition={{ duration: 1 }}
            />
            <motion.div
              className="absolute inset-0 rounded-full border-2 pointer-events-none"
              style={{ borderColor: "rgba(168,85,247,0.55)" }}
              initial={{ scale: 0.4, opacity: 1 }}
              animate={{ scale: 3, opacity: 0 }}
              transition={{ duration: 1, delay: 0.15 }}
            />
          </>
        )}
      </div>
    </div>
  );
}
