/**
 * Real InterwovenKit integration (replaces the prior stub).
 *
 * Wraps @initia/interwovenkit-react and re-exposes the exact surface the rest
 * of the miniapp imported from interwovenkit-stub so no downstream file needs
 * to change. Internally this is the real SDK:
 *   - Wallet connect via the SDK's RainbowKit+Wagmi bridge
 *   - Interwoven Bridge via openBridge()
 *   - Auto-signing (Ghost Wallet session keys) via autoSign.enable/disable
 *   - Initia Usernames via useUsernameQuery()
 */
import { ReactNode, useCallback } from "react";
import {
  InterwovenKitProvider as RealProvider,
  useInterwovenKit as useRealKit,
  useUsernameQuery as useRealUsernameQuery,
} from "@initia/interwovenkit-react";
import "@initia/interwovenkit-react/styles.css";

// ─── Public types kept identical to the old stub ───
export interface BridgeTransferDetails {
  srcChainId: string;
  srcDenom: string;
  dstChainId: string;
  dstDenom: string;
  amount: string;
}

interface AutoSign {
  enable: (chainId: string, options?: any) => Promise<void>;
  disable: (chainId: string) => Promise<void>;
  isEnabledByChain: Record<string, boolean>;
}

interface InterwovenKitContextType {
  address: string | null;
  chainId: string;
  walletType: "web3" | "initia" | null;
  isConnected: boolean;
  connect: () => Promise<void>;
  connectWeb3: () => Promise<void>;
  createInitiaWallet: () => Promise<void>;
  disconnect: () => void;
  requestTxSync: (params: any) => Promise<{ txHash: string }>;
  autoSign: AutoSign;
  openBridgeLegacy: () => void;
  openBridge: (details: BridgeTransferDetails) => Promise<{ txHash: string }>;
  openBridgeReal: (
    details: BridgeTransferDetails
  ) => Promise<{ txHash: string } | { fallback: true; url: string }>;
  getInitiaBalance: (addr?: string | null) => Promise<string>;
  _devSetChainId: (chainId: string) => void;
}

// ─── Provider ───
// The real SDK provider is configured in main.tsx (needs Wagmi + Query outside).
// Here we simply forward children — the adapter shape lives in useInterwovenKit.
export function InterwovenKitProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

// ─── Adapter hook ───
export function useInterwovenKit(): InterwovenKitContextType {
  const real = useRealKit();

  const connect = useCallback(async () => {
    real.openConnect();
  }, [real]);

  const connectWeb3 = connect;
  const createInitiaWallet = connect;

  const openBridge = useCallback(
    async (details: BridgeTransferDetails): Promise<{ txHash: string }> => {
      real.openBridge({
        srcChainId: details.srcChainId,
        srcDenom: details.srcDenom,
        dstChainId: details.dstChainId,
        dstDenom: details.dstDenom,
        quantity: details.amount,
      } as any);
      // The SDK drives its own modal and completes the tx itself. Callers that
      // previously awaited a txHash should not block on this promise for a
      // specific tx — return an empty placeholder so UI flows resume.
      return { txHash: "" };
    },
    [real]
  );

  const openBridgeReal = useCallback(
    async (details: BridgeTransferDetails) => {
      await openBridge(details);
      return { txHash: "" };
    },
    [openBridge]
  );

  const openBridgeLegacy = useCallback(() => {
    real.openBridge();
  }, [real]);

  const requestTxSync = useCallback(
    async (params: any): Promise<{ txHash: string }> => {
      const hash = await real.requestTxSync(params);
      return { txHash: hash };
    },
    [real]
  );

  const autoSign: AutoSign = {
    enable: async (chainId: string, options?: any) => {
      await real.autoSign.enable(chainId, options);
    },
    disable: async (chainId: string) => {
      await real.autoSign.disable(chainId);
    },
    isEnabledByChain: real.autoSign.isEnabledByChain,
  };

  const getInitiaBalance = useCallback(async (): Promise<string> => {
    // Minimal implementation — richer portfolio data is available via
    // usePortfolio() if needed later.
    return "0";
  }, []);

  const _devSetChainId = useCallback((_cid: string) => {
    // No-op in real SDK — chain is fixed by the provider config.
  }, []);

  return {
    address: real.address || null,
    chainId: String(import.meta.env.VITE_CHAIN_ID || ""),
    walletType: real.isConnected ? "initia" : null,
    isConnected: real.isConnected,
    connect,
    connectWeb3,
    createInitiaWallet,
    disconnect: real.disconnect,
    requestTxSync,
    autoSign,
    openBridgeLegacy,
    openBridge,
    openBridgeReal,
    getInitiaBalance,
    _devSetChainId,
  };
}

// ─── Username hook (real Initia Usernames module) ───
export function useUsernameQuery(
  address: string | null
): { data: string | null; isLoading: boolean } {
  const q = useRealUsernameQuery(address || undefined);
  return {
    data: q.data ?? null,
    isLoading: q.isLoading,
  };
}

// Re-export the real provider so main.tsx can mount it at the top of the tree.
export { RealProvider as RealInterwovenKitProvider };
