// Stub for @initia/interwovenkit-react until real package is available
import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface AutoSign {
  enable: (chainId: string, options?: any) => Promise<void>;
  disable: (chainId: string) => Promise<void>;
  isEnabledByChain: Record<string, boolean>;
}

interface InterwovenKitContextType {
  address: string | null;
  isConnected: boolean;
  connect: () => Promise<void>;
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
  const [autoSignState, setAutoSignState] = useState<Record<string, boolean>>({});

  const connect = useCallback(async () => {
    // Simulate connection delay
    await new Promise((r) => setTimeout(r, 500));
    const mockAddr = generateMockAddress();
    setAddress(mockAddr);
    console.log("[InterwovenKit Stub] Connected:", mockAddr);
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setAutoSignState({});
    console.log("[InterwovenKit Stub] Disconnected");
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
        isConnected: address !== null,
        connect,
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
