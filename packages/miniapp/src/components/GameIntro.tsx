import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  onComplete: () => void;
}

export default function GameIntro({ onComplete }: Props) {
  const [step, setStep] = useState<"ready" | 3 | 2 | 1 | "go">("ready");

  useEffect(() => {
    const seq: Array<"ready" | 3 | 2 | 1 | "go" | "done"> = [
      "ready",
      3,
      2,
      1,
      "go",
      "done",
    ];
    let i = 0;
    const timings = [900, 700, 700, 700, 600, 0];

    const tick = () => {
      i++;
      if (i >= seq.length) {
        onComplete();
        return;
      }
      if (seq[i] === "done") {
        onComplete();
        return;
      }
      setStep(seq[i] as any);
      setTimeout(tick, timings[i]);
    };

    const t = setTimeout(tick, timings[0]);
    return () => clearTimeout(t);
  }, [onComplete]);

  const renderContent = () => {
    if (step === "ready") {
      return (
        <motion.div
          key="ready"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20, scale: 1.2 }}
          className="text-center"
        >
          <div
            className="text-white/60 text-xs tracking-[0.4em] uppercase mb-3"
            style={{ fontWeight: 500 }}
          >
            Stack Game
          </div>
          <div
            className="text-white"
            style={{
              fontSize: "clamp(3rem, 12vw, 5rem)",
              fontWeight: 700,
              letterSpacing: "-2.5px",
              lineHeight: 1,
            }}
          >
            Get Ready
          </div>
        </motion.div>
      );
    }

    if (step === "go") {
      return (
        <motion.div
          key="go"
          initial={{ scale: 0.4, opacity: 0, rotate: -8 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 2.2, opacity: 0 }}
          transition={{ type: "spring", damping: 10, stiffness: 200 }}
          className="text-center"
          style={{
            fontSize: "clamp(6rem, 28vw, 12rem)",
            fontWeight: 900,
            letterSpacing: "-6px",
            background: "linear-gradient(135deg, #40C4FF, #A855F7, #FF4D6D)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 0 40px rgba(255,200,100,0.6))",
            lineHeight: 1,
          }}
        >
          GO!
        </motion.div>
      );
    }

    // Numbers 3, 2, 1
    return (
      <motion.div
        key={step}
        initial={{ scale: 2.2, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.5, opacity: 0 }}
        transition={{ type: "spring", damping: 18, stiffness: 220 }}
        className="text-white"
        style={{
          fontSize: "clamp(7rem, 32vw, 14rem)",
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: "-8px",
          textShadow: "0 0 60px rgba(64,196,255,0.6), 0 0 100px rgba(168,85,247,0.3)",
        }}
      >
        {step}
      </motion.div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at center, #0e0130 0%, #030310 70%, #000 100%)",
        fontFamily: "'Orbitron', monospace",
      }}
    >
      {/* Pulse rings on GO */}
      {step === "go" && (
        <>
          <motion.div
            className="absolute w-32 h-32 rounded-full border-2"
            style={{ borderColor: "rgba(64,196,255,0.5)" }}
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 6, opacity: 0 }}
            transition={{ duration: 0.8 }}
          />
          <motion.div
            className="absolute w-32 h-32 rounded-full border-2"
            style={{ borderColor: "rgba(168,85,247,0.5)" }}
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 6, opacity: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
          />
        </>
      )}

      <AnimatePresence mode="wait">{renderContent()}</AnimatePresence>
    </div>
  );
}
