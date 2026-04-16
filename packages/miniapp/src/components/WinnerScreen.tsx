import { useTelegram } from "../hooks/useTelegram";

export default function WinnerScreen({ wager }: { wager: any }) {
  const { user } = useTelegram();
  const myEntry = wager.entries?.find((e: any) => e.user.telegramId === user?.id?.toString());
  const opponentEntry = wager.entries?.find((e: any) => e.user.telegramId !== user?.id?.toString());
  const isWinner = wager.winnerId === myEntry?.userId;
  const payout = (parseFloat(wager.entryFee) * 2 * 0.98).toFixed(2);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
      <div className="text-6xl mb-4">{isWinner ? "🏆" : "😔"}</div>
      <div className="text-2xl font-bold mb-2" style={{ fontFamily: "Orbitron, monospace" }}>
        {isWinner ? "YOU WIN!" : "YOU LOST"}
      </div>

      <div className="bg-[var(--secondary-bg)] rounded-2xl p-5 mt-4 w-full max-w-xs">
        <div className="flex justify-between mb-3">
          <div className="text-center">
            <div className="text-xs text-[var(--hint)]">Your Score</div>
            <div className="text-3xl font-bold" style={{
              color: isWinner ? "#39FF8F" : "#FF4D6D",
              fontFamily: "Orbitron, monospace",
            }}>{myEntry?.score ?? "—"}</div>
          </div>
          <div className="text-[var(--hint)] text-xl self-center">vs</div>
          <div className="text-center">
            <div className="text-xs text-[var(--hint)]">Opponent</div>
            <div className="text-3xl font-bold" style={{
              color: !isWinner ? "#39FF8F" : "#FF4D6D",
              fontFamily: "Orbitron, monospace",
            }}>{opponentEntry?.score ?? "—"}</div>
          </div>
        </div>

        {isWinner && (
          <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.1)]">
            <div className="text-xs text-[var(--hint)]">Payout</div>
            <div className="text-xl font-bold text-[#39FF8F]">{payout} INIT</div>
          </div>
        )}
      </div>

      {wager.settleTxHash && (
        <div className="mt-4 text-xs text-[var(--hint)]">
          TX: {wager.settleTxHash.slice(0, 20)}...
        </div>
      )}
    </div>
  );
}
