import { useTelegram } from "../hooks/useTelegram";
import { useUserWagers } from "../hooks/useWager";
import WagerCard from "../components/WagerCard";
import BridgeButton from "../components/BridgeButton";
import WalletStatus from "../components/WalletStatus";

export default function Home() {
  const { user } = useTelegram();
  const { data: wagers, isLoading } = useUserWagers(user?.id?.toString() || "");

  return (
    <div className="p-4 min-h-screen">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "Orbitron, monospace" }}>
          WeezWager
        </h1>
        <p className="text-[var(--hint)] text-sm mt-1">Wager. Play. Win.</p>
      </div>

      <div className="mb-4">
        <WalletStatus />
      </div>

      <BridgeButton />

      <div className="mt-6">
        <h2 className="text-sm font-semibold text-[var(--hint)] uppercase tracking-wider mb-3">
          Your Wagers
        </h2>

        {isLoading ? (
          <div className="text-center text-[var(--hint)] py-8">Loading...</div>
        ) : !wagers?.length ? (
          <div className="text-center text-[var(--hint)] py-8">
            <p>No wagers yet</p>
            <p className="text-xs mt-2">Use /wager in a Telegram chat to create one</p>
          </div>
        ) : (
          <div className="space-y-3">
            {wagers.map((w: any) => (
              <WagerCard key={w.id} wager={w} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
