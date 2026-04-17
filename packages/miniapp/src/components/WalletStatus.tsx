import { useState } from "react";
import { useInterwovenKit, useUsernameQuery } from "../lib/interwovenkit-stub";
import SwipeluxModal from "./SwipeluxModal";

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

export default function WalletStatus() {
  const { address, walletType, isConnected, connectWeb3, createInitiaWallet, disconnect } = useInterwovenKit();
  const { data: username } = useUsernameQuery(address);
  const [loading, setLoading] = useState<"web3" | "initia" | null>(null);
  const [showSwipelux, setShowSwipelux] = useState(false);

  const handleCreate = async () => {
    setLoading("initia");
    try {
      await createInitiaWallet();
    } finally {
      setLoading(null);
    }
  };

  const handleConnectWeb3 = async () => {
    setLoading("web3");
    try {
      await connectWeb3();
    } finally {
      setLoading(null);
    }
  };

  if (!isConnected) {
    return (
      <>
        <div className="bg-[var(--secondary-bg)] rounded-xl p-4">
          <div className="text-sm font-semibold mb-1">Get Started</div>
          <div className="text-xs text-[var(--hint)] mb-3">
            Three ways to start wagering:
          </div>
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={handleCreate}
              disabled={loading !== null}
              className="py-3 px-4 rounded-xl font-semibold text-black disabled:opacity-50 flex items-center justify-between"
              style={{ background: "linear-gradient(135deg, #40C4FF, #A855F7, #FF4D6D)" }}
            >
              <span>✨ Create Initia Wallet</span>
              <span className="text-xs opacity-75">
                {loading === "initia" ? "Creating..." : "Recommended"}
              </span>
            </button>
            <button
              onClick={handleConnectWeb3}
              disabled={loading !== null}
              className="py-3 px-4 rounded-xl font-semibold border disabled:opacity-50 flex items-center justify-between"
              style={{ borderColor: "var(--btn)", color: "var(--btn)" }}
            >
              <span>🔗 Connect Web3 Wallet</span>
              <span className="text-xs opacity-75">
                {loading === "web3" ? "Connecting..." : "MetaMask, etc."}
              </span>
            </button>
            <button
              onClick={() => setShowSwipelux(true)}
              disabled={loading !== null}
              className="py-3 px-4 rounded-xl font-semibold border disabled:opacity-50 flex items-center justify-between"
              style={{ borderColor: "#10b981", color: "#10b981" }}
            >
              <span>💳 Pay with Card</span>
              <span className="text-xs opacity-75">Swipelux onramp</span>
            </button>
          </div>
        </div>
        {showSwipelux && <SwipeluxModal onClose={() => setShowSwipelux(false)} />}
      </>
    );
  }

  const walletLabel = walletType === "web3" ? "Web3" : walletType === "initia" ? "Initia" : "";

  return (
    <div className="flex items-center justify-between bg-[var(--secondary-bg)] rounded-xl px-4 py-3">
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold">
            {username ? `${username}.init` : truncateAddress(address!)}
          </div>
          {walletLabel && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/20 text-[var(--hint)] uppercase tracking-wider">
              {walletLabel}
            </span>
          )}
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
