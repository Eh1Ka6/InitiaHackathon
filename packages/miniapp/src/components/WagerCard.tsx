import { useNavigate } from "react-router-dom";

const statusConfig: Record<string, { emoji: string; color: string }> = {
  PENDING_ACCEPTANCE: { emoji: "⏳", color: "text-yellow-400" },
  ACCEPTED: { emoji: "✅", color: "text-green-400" },
  FUNDING: { emoji: "💰", color: "text-blue-400" },
  FUNDED: { emoji: "🔒", color: "text-blue-400" },
  PLAYING: { emoji: "🎮", color: "text-purple-400" },
  SETTLED: { emoji: "🏆", color: "text-yellow-400" },
  CANCELLED: { emoji: "❌", color: "text-red-400" },
};

export default function WagerCard({ wager }: { wager: any }) {
  const navigate = useNavigate();
  const { emoji, color } = statusConfig[wager.status] || { emoji: "❓", color: "text-gray-400" };

  return (
    <div
      onClick={() => navigate(`/wager/${wager.id}`)}
      className="bg-[var(--secondary-bg)] rounded-xl p-4 cursor-pointer active:scale-[0.98] transition-transform"
    >
      <div className="flex justify-between items-start">
        <div>
          <div className="text-sm font-semibold">Wager #{wager.id}</div>
          <div className="text-xs text-[var(--hint)] mt-0.5">{wager.description}</div>
        </div>
        <div className={`text-xs font-semibold ${color}`}>
          {emoji} {wager.status}
        </div>
      </div>
      <div className="mt-2 text-lg font-bold">{wager.entryFee} INIT</div>
      <div className="text-xs text-[var(--hint)] mt-1">
        {wager.entries?.length || 0} / {wager.maxPlayers} players
      </div>
    </div>
  );
}
