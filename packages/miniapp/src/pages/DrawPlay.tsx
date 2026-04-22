import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import StackGame from "../game/StackGame";
import GameIntro from "../components/GameIntro";
import { api, type Draw } from "../services/api";
import { useInterwovenKit } from "../lib/interwovenkit-stub";

export default function DrawPlay() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { address } = useInterwovenKit();

  const [draw, setDraw] = useState<Draw | null>(null);
  const [intro, setIntro] = useState(true);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number>(0);

  useEffect(() => {
    if (!id) return;
    api
      .getDraw(id)
      .then(setDraw)
      .catch((e) => setError(String(e?.message || e)));
  }, [id]);

  useEffect(() => {
    if (!intro && startedAt === 0) {
      setStartedAt(Date.now());
    }
  }, [intro, startedAt]);

  const handleGameOver = async (score: number) => {
    setFinalScore(score);
    setHasPlayed(true);
    if (!id || !address) {
      navigate(`/draw/${id}/status`);
      return;
    }
    setSubmitting(true);
    try {
      const playTimeMs = Date.now() - (startedAt || Date.now());
      await api.submitDrawScore(id, score, playTimeMs, address);
    } catch (err: any) {
      setError(err?.message || "Failed to submit score");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="relative min-h-screen flex flex-col"
      style={{
        background:
          "radial-gradient(ellipse at center, #0e0130 0%, #030310 70%, #000 100%)",
      }}
    >
      <div className="p-3 text-center relative z-10">
        <div
          className="text-white/60 text-[10px] uppercase tracking-[0.3em]"
          style={{ fontWeight: 500 }}
        >
          Draw #{id}
        </div>
        <div
          className="text-white text-sm mt-0.5"
          style={{ fontFamily: "var(--font-sequel-sans)", fontWeight: 600 }}
        >
          Entry: {draw?.entryFeeInit ?? "—"} INIT
        </div>
      </div>

      {!intro && !hasPlayed && (
        <div className="flex-1 flex items-center justify-center">
          <StackGame
            gameSeed={`draw-${id}-${address ?? "anon"}`}
            onGameOver={handleGameOver}
            autoStart={true}
          />
        </div>
      )}

      {hasPlayed && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex-1 flex flex-col items-center justify-center px-6"
          style={{ fontFamily: "'Orbitron', monospace" }}
        >
          <div className="text-white/60 text-xs tracking-[0.4em] uppercase mb-3">
            {submitting ? "Submitting…" : "Score Submitted"}
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
          {error && (
            <div className="text-red-300 text-xs mb-3 text-center">{error}</div>
          )}
          <div className="text-white/70 text-sm mb-8 text-center">
            Waiting for the draw to settle.
            <br />
            Qualifiers filtered at ≥80% of top score.
          </div>

          <div className="space-y-3 w-full max-w-[280px]">
            <button
              onClick={() => navigate(`/draw/${id}/status`)}
              className="w-full py-3 rounded-xl text-white"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0.1))",
                border: "1px solid rgba(255,255,255,0.4)",
                fontFamily: "var(--font-sequel-sans)",
                fontWeight: 700,
              }}
            >
              View status →
            </button>
            <button
              onClick={() => navigate("/draws")}
              className="w-full py-3 rounded-xl text-white/70 text-sm"
              style={{
                border: "1px solid rgba(255,255,255,0.1)",
                fontFamily: "var(--font-sequel-sans)",
              }}
            >
              Back to lobby
            </button>
          </div>
        </motion.div>
      )}

      {intro && <GameIntro onComplete={() => setIntro(false)} />}
    </div>
  );
}
