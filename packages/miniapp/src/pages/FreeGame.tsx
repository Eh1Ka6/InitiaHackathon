import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const GAME_MODES = [
  {
    id: "stack",
    title: "Stack",
    mode: "SCORE_BASED",
    description: "Tap to place, chain perfects",
    gradient: "from-purple-500 to-pink-500",
    badge: "Score",
    emoji: "📦",
  },
  {
    id: "reaction",
    title: "Reaction",
    mode: "REALTIME",
    description: "Tap fast, race the clock",
    gradient: "from-teal-400 to-cyan-500",
    badge: "Realtime",
    emoji: "⚡",
    disabled: true,
  },
  {
    id: "streak",
    title: "Streak",
    mode: "LIVE_PROGRESSION",
    description: "Beat levels in order",
    gradient: "from-blue-500 to-indigo-600",
    badge: "Progress",
    emoji: "🔥",
    disabled: true,
  },
];

export default function FreeGame() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      {/* Hero header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center pt-8 pb-6 px-6"
      >
        <div className="text-gray-400 text-xs tracking-[0.3em] uppercase mb-2">
          Free Games
        </div>
        <h1
          className="font-bold mb-2"
          style={{
            fontSize: "clamp(2rem, 8vw, 2.75rem)",
            color: "#003e89",
            fontFamily: "'Orbitron', monospace",
            letterSpacing: "-0.02em",
          }}
        >
          Play Free
        </h1>
        <p className="text-gray-500 text-sm max-w-[280px] mx-auto">
          Practice, climb leaderboards, no stakes.
        </p>
      </motion.div>

      {/* Games grid */}
      <div className="px-4 pb-8 space-y-3">
        {GAME_MODES.map((game, i) => (
          <motion.button
            key={game.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            whileTap={game.disabled ? {} : { scale: 0.97 }}
            onClick={() => {
              if (game.disabled) return;
              navigate("/play-free/" + game.id);
            }}
            disabled={game.disabled}
            className="w-full relative rounded-2xl overflow-hidden text-left disabled:opacity-60"
            style={{
              border: "1.25px solid rgba(0,62,137,0.08)",
              boxShadow: "0 2px 24px rgba(0,62,137,0.07)",
            }}
          >
            <div
              className={`h-32 bg-gradient-to-br ${game.gradient} p-4 flex flex-col justify-between relative`}
            >
              <div className="absolute top-3 right-3">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-white"
                  style={{ background: "rgba(0,0,0,0.25)" }}
                >
                  {game.badge}
                </span>
              </div>
              <div className="text-5xl drop-shadow-lg">{game.emoji}</div>
              <div className="text-white">
                <div
                  className="font-bold text-2xl"
                  style={{
                    fontFamily: "'Orbitron', monospace",
                    textShadow: "0 2px 10px rgba(0,0,0,0.3)",
                  }}
                >
                  {game.title}
                </div>
                <div className="text-white/85 text-xs">{game.description}</div>
              </div>
              {game.disabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <div className="bg-white/90 px-3 py-1 rounded-full text-xs font-bold text-[#003e89]">
                    Coming Soon
                  </div>
                </div>
              )}
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
