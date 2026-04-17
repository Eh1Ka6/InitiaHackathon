import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import StackGame from "../game/StackGame";
import GameIntro from "../components/GameIntro";

// Draw slides config (matches CashGame)
const DRAWS: Record<
  string,
  { amount: string; ticketPrice: string; color: string }
> = {
  "10": { amount: "$10", ticketPrice: "1 INIT", color: "#119BAF" },
  "50": { amount: "$50", ticketPrice: "5 INIT", color: "#72DBEA" },
  "500": { amount: "$500", ticketPrice: "50 INIT", color: "#40C4FF" },
};

export default function DrawGame() {
  const { slideId } = useParams();
  const navigate = useNavigate();
  const draw = DRAWS[slideId || "10"] || DRAWS["10"];

  const [intro, setIntro] = useState(true);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  const handleGameOver = (score: number) => {
    setHasPlayed(true);
    setFinalScore(score);
  };

  return (
    <div
      className="relative min-h-screen flex flex-col"
      style={{
        background:
          "radial-gradient(ellipse at center, #0e0130 0%, #030310 70%, #000 100%)",
      }}
    >
      {/* Draw header */}
      <div className="p-3 text-center relative z-10">
        <div
          className="text-white/60 text-[10px] uppercase tracking-[0.3em]"
          style={{ fontWeight: 500 }}
        >
          {draw.amount} Prize Pool
        </div>
        <div
          className="text-white text-sm mt-0.5"
          style={{ fontFamily: "var(--font-sequel-sans)", fontWeight: 600 }}
        >
          Ticket: {draw.ticketPrice}
        </div>
      </div>

      {/* Game */}
      {!intro && !hasPlayed && (
        <div className="flex-1 flex items-center justify-center">
          <StackGame
            gameSeed={`draw-${slideId}-${Date.now()}`}
            onGameOver={handleGameOver}
            autoStart={true}
          />
        </div>
      )}

      {/* Game Over screen */}
      {hasPlayed && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex-1 flex flex-col items-center justify-center px-6"
          style={{ fontFamily: "'Orbitron', monospace" }}
        >
          <div className="text-white/60 text-xs tracking-[0.4em] uppercase mb-3">
            Score Submitted
          </div>
          <div
            className="text-white mb-2"
            style={{
              fontSize: "clamp(5rem, 24vw, 8rem)",
              fontWeight: 900,
              letterSpacing: "-4px",
              lineHeight: 1,
              textShadow:
                "0 0 50px rgba(64,196,255,0.7), 0 0 100px rgba(168,85,247,0.3)",
            }}
          >
            {finalScore}
          </div>
          <div className="text-white/70 text-sm mb-8 text-center">
            You're in the {draw.amount} draw.
            <br />
            Winner announced when pool fills.
          </div>

          <div className="space-y-3 w-full max-w-[280px]">
            <button
              onClick={() => navigate("/games/cash")}
              className="w-full py-3 rounded-xl text-white"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.06))",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255,255,255,0.3)",
                fontFamily: "var(--font-sequel-sans)",
                fontWeight: 600,
              }}
            >
              ← Back to draws
            </button>
            <button
              onClick={() => navigate("/profile")}
              className="w-full py-3 rounded-xl text-white/70 text-sm"
              style={{
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              View Profile
            </button>
          </div>
        </motion.div>
      )}

      {/* Countdown intro */}
      {intro && <GameIntro onComplete={() => setIntro(false)} />}
    </div>
  );
}
