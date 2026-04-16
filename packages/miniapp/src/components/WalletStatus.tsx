import { useInterwovenKit, useUsernameQuery } from "../lib/interwovenkit-stub";

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

export default function WalletStatus() {
  const { address, isConnected, connect, disconnect } = useInterwovenKit();
  const { data: username } = useUsernameQuery(address);

  if (!isConnected) {
    return (
      <button
        onClick={connect}
        className="w-full py-3 rounded-xl text-[var(--btn-text)] font-semibold"
        style={{ background: "var(--btn)" }}
      >
        Connect Wallet
      </button>
    );
  }

  return (
    <div className="flex items-center justify-between bg-[var(--secondary-bg)] rounded-xl px-4 py-3">
      <div className="flex flex-col">
        <div className="text-sm font-semibold">
          {username ? `${username}.init` : truncateAddress(address!)}
        </div>
        <div className="text-xs text-[var(--hint)]">Balance: -- INIT</div>
      </div>
      <button
        onClick={disconnect}
        className="text-xs text-[var(--hint)] hover:text-[var(--link)] transition-colors"
      >
        Disconnect
      </button>
    </div>
  );
}
