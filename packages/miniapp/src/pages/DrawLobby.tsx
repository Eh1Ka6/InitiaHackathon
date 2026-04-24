import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { api, type Draw, type CommunityDraw } from "../services/api";

// Adapt a backend CommunityDraw to the Draw shape DrawCard already knows how
// to render. ticketsSold is mapped to a synthetic participants array so the
// existing progress-bar math (participants.length / maxParticipants) works.
function communityToDraw(cd: CommunityDraw): Draw {
  return {
    id: String(cd.onChainId),
    status: cd.status === "OPEN" ? "OPEN" : "SETTLED",
    entryFeeInit: (() => {
      try {
        // ticketPrice is wei; show short-form INIT value
        const wei = BigInt(cd.ticketPrice || "0");
        const whole = Number(wei / 10n ** 18n);
        return String(whole);
      } catch {
        return "?";
      }
    })(),
    deadline: cd.endTimestamp * 1000,
    multiplierConfigId: 0,
    participants: Array.from({ length: cd.ticketsSold }, () => ({
      walletAddress: "",
      homeChainId: "interwoven-1",
    })),
    maxParticipants: cd.maxTickets,
    createdAt: Date.now(),
  };
}

function fmtCountdown(ms: number): string {
  if (ms <= 0) return "closed";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}h ${rm}m`;
  }
  return `${m}m ${rs}s`;
}

function configLabel(id: number): string {
  return ["Conservative", "Balanced", "Aggressive", "Moonshot"][id] || `Config ${id}`;
}

function DrawCard({
  draw,
  onJoin,
  style,
}: {
  draw: Draw;
  onJoin: () => void;
  style?: React.CSSProperties;
}) {
  const [countdown, setCountdown] = useState(draw.deadline - Date.now());

  useEffect(() => {
    const t = setInterval(() => setCountdown(draw.deadline - Date.now()), 1000);
    return () => clearInterval(t);
  }, [draw.deadline]);

  const participantPct = Math.round(
    (draw.participants.length / draw.maxParticipants) * 100
  );

  return (
    <motion.div
      layout
      className="rounded-3xl p-6 w-full"
      style={{
        fontFamily: "var(--font-sequel-sans)",
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.06) 100%)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.3)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.35), 0 20px 60px rgba(0,0,0,0.35)",
        color: "#fff",
        ...style,
      }}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <div
            className="text-white/60 text-[10px] uppercase tracking-[0.35em]"
            style={{ fontWeight: 500 }}
          >
            Draw #{draw.id}
          </div>
          <div
            className="text-white text-2xl mt-1"
            style={{ fontWeight: 600, letterSpacing: "-0.5px" }}
          >
            {draw.entryFeeInit} INIT entry
          </div>
        </div>
        <div
          className="px-2 py-1 rounded-full text-[9px] uppercase tracking-widest"
          style={{
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.2)",
          }}
        >
          {draw.status.toLowerCase().replace(/_/g, " ")}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div
          className="rounded-2xl p-3"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.14)",
          }}
        >
          <div className="text-white/60 text-[10px] uppercase tracking-widest">
            Closes in
          </div>
          <div className="text-white text-base mt-1" style={{ fontWeight: 600 }}>
            {fmtCountdown(countdown)}
          </div>
        </div>
        <div
          className="rounded-2xl p-3"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.14)",
          }}
        >
          <div className="text-white/60 text-[10px] uppercase tracking-widest">
            Multiplier
          </div>
          <div className="text-white text-base mt-1" style={{ fontWeight: 600 }}>
            {configLabel(draw.multiplierConfigId)}
          </div>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-xs text-white/60 mb-1">
          <span>
            {draw.participants.length}/{draw.maxParticipants} players
          </span>
          <span>{participantPct}% full</span>
        </div>
        <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: "linear-gradient(90deg, #40C4FF, #A855F7)",
            }}
            animate={{ width: `${participantPct}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>

      <button
        onClick={onJoin}
        disabled={draw.status !== "OPEN" || countdown <= 0}
        className="w-full py-3 rounded-xl text-white disabled:opacity-50"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0.1))",
          border: "1px solid rgba(255,255,255,0.4)",
          fontWeight: 700,
          letterSpacing: "-0.5px",
          fontSize: "1rem",
        }}
      >
        Join Draw
      </button>
    </motion.div>
  );
}

export default function DrawLobby() {
  const navigate = useNavigate();
  const [draws, setDraws] = useState<Draw[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    // Fetch both community draws (primary) and protocol draws in parallel,
    // merge into one list. Community draws come first so /draws launched
    // from the bot shows user-created ones prominently.
    Promise.all([
      api.getActiveCommunityDraws(10).catch(() => []),
      api.getActiveDraws().catch(() => [] as Draw[]),
    ])
      .then(([community, protocol]) => {
        if (!alive) return;
        const merged = [...community.map(communityToDraw), ...protocol];
        setDraws(merged);
      })
      .catch((e) => alive && setError(String(e?.message || e)));
    return () => {
      alive = false;
    };
  }, []);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || !draws || draws.length < 2) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 50) return;
    const dir = dx < 0 ? 1 : -1;
    setActiveIdx((i) => (i + dir + draws.length) % draws.length);
  };

  return (
    <div
      className="fixed inset-0 overflow-hidden flex flex-col items-center"
      style={{
        background:
          "radial-gradient(ellipse 50% 45% at 0% 0%, #013f88 0%, transparent 100%), radial-gradient(ellipse 50% 50% at 100% 100%, #608ec9 0%, transparent 80%), linear-gradient(180deg,#013f88 0%,#1c5199 50%,#5586c1 100%)",
        fontFamily: "var(--font-sequel-sans)",
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="w-full max-w-[420px] px-4 pt-14 pb-6">
        <div
          className="text-white/60 text-[10px] uppercase tracking-[0.35em] text-center"
          style={{ fontWeight: 500 }}
        >
          Draws
        </div>
        <h1
          className="text-white text-center text-4xl mt-1 mb-6"
          style={{
            fontWeight: 600,
            letterSpacing: "-1.5px",
          }}
        >
          Win Different
        </h1>

        {error && (
          <div className="text-red-300 text-xs text-center mb-3">{error}</div>
        )}

        {draws === null && (
          <div className="text-white/60 text-center text-sm py-10">
            Loading draws…
          </div>
        )}

        {draws && draws.length === 0 && (
          <div className="text-white/60 text-center text-sm py-10">
            No active draws. Check back soon.
          </div>
        )}

        {draws && draws.length > 0 && (
          <div style={{ perspective: "1200px" }}>
            <motion.div
              key={activeIdx}
              initial={{ rotateY: -40, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              transition={{ type: "spring", damping: 22, stiffness: 160 }}
              style={{ transformStyle: "preserve-3d" }}
            >
              <DrawCard
                draw={draws[activeIdx]}
                onJoin={() => navigate(`/draw/${draws[activeIdx].id}`)}
              />
            </motion.div>

            {draws.length >= 2 && (
              <div className="mt-4 flex justify-center gap-2">
                {draws.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveIdx(i)}
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: i === activeIdx ? 24 : 8,
                      background:
                        i === activeIdx ? "#fff" : "rgba(255,255,255,0.4)",
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => navigate("/")}
          className="w-full mt-8 py-3 rounded-xl text-white/70 text-sm"
          style={{ border: "1px solid rgba(255,255,255,0.12)" }}
        >
          ← Home
        </button>
      </div>
    </div>
  );
}
