export default function WaitingScreen({ wager, myScore, opponentEntry }: {
  wager: any;
  myScore?: number | null;
  opponentEntry?: any;
}) {
  const opponentName = opponentEntry?.user?.username
    ? `@${opponentEntry.user.username}`
    : opponentEntry?.user?.firstName || "Opponent";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
      <div className="text-4xl mb-4">⏳</div>
      <div className="text-xl font-bold mb-2" style={{ fontFamily: "Orbitron, monospace" }}>
        SCORE SUBMITTED
      </div>

      <div className="bg-[var(--secondary-bg)] rounded-2xl p-5 mt-4 w-full max-w-xs">
        <div className="text-center mb-3">
          <div className="text-xs text-[var(--hint)]">Your Score</div>
          <div className="text-5xl font-bold text-white" style={{ fontFamily: "Orbitron, monospace" }}>
            {myScore ?? "—"}
          </div>
        </div>

        <div className="pt-3 border-t border-[rgba(255,255,255,0.1)]">
          {opponentEntry?.score !== null && opponentEntry?.score !== undefined ? (
            <>
              <div className="text-xs text-[var(--hint)]">{opponentName}'s Score</div>
              <div className="text-2xl font-bold text-[var(--accent)]" style={{ fontFamily: "Orbitron, monospace" }}>
                {opponentEntry.score}
              </div>
              <div className="text-xs text-[var(--hint)] mt-2">Settling on-chain...</div>
            </>
          ) : (
            <>
              <div className="text-sm text-[var(--hint)]">Waiting for {opponentName}...</div>
              <div className="mt-2 w-8 h-8 border-2 border-[var(--link)] border-t-transparent rounded-full animate-spin mx-auto" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
