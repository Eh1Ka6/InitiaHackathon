import { useParams } from "react-router-dom";
import { useWager } from "../hooks/useWager";

export default function PoolView() {
  const { id } = useParams();
  const { data: pool, isLoading } = useWager(Number(id));

  if (isLoading || !pool) {
    return <div className="flex items-center justify-center min-h-screen text-[var(--hint)]">Loading...</div>;
  }

  const sideA = pool.entries?.filter((e: any) => e.side === 1) || [];
  const sideB = pool.entries?.filter((e: any) => e.side === 2) || [];

  return (
    <div className="p-4 min-h-screen">
      <div className="text-center mb-4">
        <div className="text-xs text-[var(--hint)] uppercase tracking-wider">Pool #{pool.id}</div>
        <div className="text-lg font-bold mt-1">{pool.description}</div>
        <div className="text-sm text-[var(--hint)]">{pool.entryFee} INIT entry</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <div className="text-center text-sm font-bold text-blue-400 mb-3">🅰️ Side A ({sideA.length})</div>
          {sideA.map((e: any) => (
            <div key={e.id} className="text-xs text-[var(--hint)] py-1">
              {e.user?.username ? `@${e.user.username}` : e.user?.firstName}
            </div>
          ))}
        </div>

        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="text-center text-sm font-bold text-red-400 mb-3">🅱️ Side B ({sideB.length})</div>
          {sideB.map((e: any) => (
            <div key={e.id} className="text-xs text-[var(--hint)] py-1">
              {e.user?.username ? `@${e.user.username}` : e.user?.firstName}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
