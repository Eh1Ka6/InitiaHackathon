// Stub for @initia/interwovenkit-react until real package is available
import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface AutoSign {
  enable: (chainId: string, options?: any) => Promise<void>;
  disable: (chainId: string) => Promise<void>;
  isEnabledByChain: Record<string, boolean>;
}

interface InterwovenKitContextType {
  address: string | null;
  walletType: "web3" | "initia" | null;
  isConnected: boolean;
  connect: () => Promise<void>;
  connectWeb3: () => Promise<void>;
  createInitiaWallet: () => Promise<void>;
  disconnect: () => void;
  requestTxSync: (params: any) => Promise<{ txHash: string }>;
  autoSign: AutoSign;
  openBridge: () => void;
}

const InterwovenKitContext = createContext<InterwovenKitContextType | null>(null);

function generateMockAddress(): string {
  const chars = "abcdef0123456789";
  let addr = "init1";
  for (let i = 0; i < 38; i++) {
    addr += chars[Math.floor(Math.random() * chars.length)];
  }
  return addr;
}

function generateMockTxHash(): string {
  const chars = "ABCDEF0123456789";
  let hash = "";
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

export function InterwovenKitProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<"web3" | "initia" | null>(null);
  const [autoSignState, setAutoSignState] = useState<Record<string, boolean>>({});

  const createInitiaWallet = useCallback(async () => {
    // Simulate Ghost Wallet creation (InterwovenKit native)
    await new Promise((r) => setTimeout(r, 600));
    const mockAddr = generateMockAddress();
    setAddress(mockAddr);
    setWalletType("initia");
    console.log("[InterwovenKit] Created Initia wallet:", mockAddr);
  }, []);

  const connectWeb3 = useCallback(async () => {
    const eth = (window as any).ethereum;
    if (!eth) {
      const msg = "No Web3 wallet detected. Install MetaMask or another wallet.";
      if (window.Telegram?.WebApp?.showAlert) {
        window.Telegram.WebApp.showAlert(msg);
      } else {
        alert(msg);
      }
      return;
    }
    try {
      const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
      if (accounts && accounts[0]) {
        setAddress(accounts[0]);
        setWalletType("web3");
        console.log("[Web3] Connected:", accounts[0]);
      }
    } catch (err: any) {
      console.error("[Web3] Connect failed:", err);
    }
  }, []);

  // Legacy default connect = create Initia wallet (for backwards compat)
  const connect = createInitiaWallet;

  const disconnect = useCallback(() => {
    setAddress(null);
    setWalletType(null);
    setAutoSignState({});
    console.log("[Wallet] Disconnected");
  }, []);

  const requestTxSync = useCallback(async (_params: any): Promise<{ txHash: string }> => {
    // Simulate tx processing delay
    await new Promise((r) => setTimeout(r, 1000));
    const txHash = generateMockTxHash();
    console.log("[InterwovenKit Stub] TX submitted:", txHash);
    return { txHash };
  }, []);

  const autoSign: AutoSign = {
    enable: async (chainId: string, _options?: any) => {
      await new Promise((r) => setTimeout(r, 300));
      setAutoSignState((prev) => ({ ...prev, [chainId]: true }));
      console.log("[InterwovenKit Stub] Auto-sign enabled for", chainId);
    },
    disable: async (chainId: string) => {
      setAutoSignState((prev) => ({ ...prev, [chainId]: false }));
      console.log("[InterwovenKit Stub] Auto-sign disabled for", chainId);
    },
    isEnabledByChain: autoSignState,
  };

  const openBridge = useCallback(() => {
    if (window.Telegram?.WebApp?.showAlert) {
      window.Telegram.WebApp.showAlert("Bridge coming soon! Use Interwoven Bridge to move assets between chains.");
    } else {
      alert("Bridge coming soon!");
    }
  }, []);

  return (
    <InterwovenKitContext.Provider
      value={{
        address,
        walletType,
        isConnected: address !== null,
        connect,
        connectWeb3,
        createInitiaWallet,
        disconnect,
        requestTxSync,
        autoSign,
        openBridge,
      }}
    >
      {children}
    </InterwovenKitContext.Provider>
  );
}

export function useInterwovenKit(): InterwovenKitContextType {
  const ctx = useContext(InterwovenKitContext);
  if (!ctx) {
    throw new Error("useInterwovenKit must be used within <InterwovenKitProvider>");
  }
  return ctx;
}

export function useUsernameQuery(address: string | null): { data: string | null; isLoading: boolean } {
  // Stub: always returns null (no .init username resolved)
  // In production, this would query the Initia username registry
  return { data: null, isLoading: false };
}
