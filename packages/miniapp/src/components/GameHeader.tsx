export default function GameHeader({ wager }: { wager: any }) {
  const opponent = wager.entries?.find((e: any) => e.userId !== wager.creatorId);
  const opponentName = opponent?.user?.username ? `@${opponent.user.username}` : opponent?.user?.firstName || "Opponent";

  return (
    <div className="p-3 flex justify-between items-center" style={{ background: "rgba(255,77,109,0.08)" }}>
      <div>
        <div className="text-xs text-[var(--hint)] uppercase tracking-wider">Wager #{wager.id}</div>
        <div className="text-sm font-bold">{wager.entryFee} INIT</div>
      </div>
      <div className="text-right">
        <div className="text-xs text-[var(--hint)]">vs</div>
        <div className="text-sm font-semibold">{opponentName}</div>
      </div>
    </div>
  );
}
