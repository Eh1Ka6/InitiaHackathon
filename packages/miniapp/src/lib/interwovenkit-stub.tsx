// Stub for @initia/interwovenkit-react until real package is available
import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import BridgeModal from "../components/BridgeModal";

interface AutoSign {
  enable: (chainId: string, options?: any) => Promise<void>;
  disable: (chainId: string) => Promise<void>;
  isEnabledByChain: Record<string, boolean>;
}

export interface BridgeTransferDetails {
  srcChainId: string; // e.g. "137", "56", "interwoven-1"
  srcDenom: string; // native token address/denom
  dstChainId: string;
  dstDenom: string;
  amount: string; // as string to avoid BigNumber issues
}

interface BridgeModalState {
  open: boolean;
  details: BridgeTransferDetails | null;
  resolve: ((res: { txHash: string }) => void) | null;
  reject: ((err: Error) => void) | null;
}

interface InterwovenKitContextType {
  address: string | null;
  chainId: string; // current chain id the connected wallet reports
  walletType: "web3" | "initia" | null;
  isConnected: boolean;
  connect: () => Promise<void>;
  connectWeb3: () => Promise<void>;
  createInitiaWallet: () => Promise<void>;
  disconnect: () => void;
  requestTxSync: (params: any) => Promise<{ txHash: string }>;
  autoSign: AutoSign;
  // Simple legacy entry kept for other callers
  openBridgeLegacy: () => void;
  // Stubbed programmatic bridge — opens a modal, resolves with fake tx hash
  openBridge: (details: BridgeTransferDetails) => Promise<{ txHash: string }>;
  // Tries the real SDK if VITE_USE_REAL_BRIDGE, else falls back to deep link
  openBridgeReal: (
    details: BridgeTransferDetails
  ) => Promise<{ txHash: string } | { fallback: true; url: string }>;
  // Dev helper: query a wallet's INIT balance (in INIT units, as a string)
  getInitiaBalance: (addr?: string | null) => Promise<string>;
  // Dev helper: let the stub simulate a chain switch (used in local dev only)
  _devSetChainId: (chainId: string) => void;
}

const InterwovenKitContext = createContext<InterwovenKitContextType | null>(
  null
);

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
  return "0x" + hash;
}

export function InterwovenKitProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<"web3" | "initia" | null>(null);
  const [chainId, setChainId] = useState<string>("interwoven-1");
  const [autoSignState, setAutoSignState] = useState<Record<string, boolean>>(
    {}
  );

  // Per-address mocked balance — grows after a successful simulated bridge
  const [mockBalances, setMockBalances] = useState<Record<string, string>>({});

  // Bridge modal state (stubbed flow)
  const [bridgeModal, setBridgeModal] = useState<BridgeModalState>({
    open: false,
    details: null,
    resolve: null,
    reject: null,
  });

  const createInitiaWallet = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 600));
    const mockAddr = generateMockAddress();
    setAddress(mockAddr);
    setWalletType("initia");
    setChainId("interwoven-1");
    console.log("[InterwovenKit] Created Initia wallet:", mockAddr);
  }, []);

  const connectWeb3 = useCallback(async () => {
    const eth = (window as any).ethereum;
    if (!eth) {
      const msg =
        "No Web3 wallet detected. Install MetaMask or another wallet.";
      if (window.Telegram?.WebApp?.showAlert) {
        window.Telegram.WebApp.showAlert(msg);
      } else {
        alert(msg);
      }
      return;
    }
    try {
      const accounts: string[] = await eth.request({
        method: "eth_requestAccounts",
      });
      if (accounts && accounts[0]) {
        setAddress(accounts[0]);
        setWalletType("web3");
        try {
          const cid: string = await eth.request({ method: "eth_chainId" });
          // MetaMask returns hex; convert to decimal string for consistency
          const asDecimal = cid.startsWith("0x")
            ? String(parseInt(cid, 16))
            : cid;
          setChainId(asDecimal);
        } catch {
          setChainId("137");
        }
        console.log("[Web3] Connected:", accounts[0]);
      }
    } catch (err: any) {
      console.error("[Web3] Connect failed:", err);
    }
  }, []);

  // Legacy default connect = create Initia wallet
  const connect = createInitiaWallet;

  const disconnect = useCallback(() => {
    setAddress(null);
    setWalletType(null);
    setAutoSignState({});
    console.log("[Wallet] Disconnected");
  }, []);

  const requestTxSync = useCallback(
    async (_params: any): Promise<{ txHash: string }> => {
      await new Promise((r) => setTimeout(r, 1000));
      const txHash = generateMockTxHash();
      console.log("[InterwovenKit Stub] TX submitted:", txHash);
      return { txHash };
    },
    []
  );

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

  const openBridgeLegacy = useCallback(() => {
    if (window.Telegram?.WebApp?.showAlert) {
      window.Telegram.WebApp.showAlert(
        "Bridge coming soon! Use Interwoven Bridge to move assets between chains."
      );
    } else {
      alert("Bridge coming soon!");
    }
  }, []);

  const openBridge = useCallback(
    (details: BridgeTransferDetails): Promise<{ txHash: string }> => {
      return new Promise((resolve, reject) => {
        setBridgeModal({
          open: true,
          details,
          resolve,
          reject,
        });
      });
    },
    []
  );

  const handleModalConfirm = useCallback(async () => {
    const m = bridgeModal;
    if (!m.details || !m.resolve) return;
    // Simulate bridge finalization — 5s
    await new Promise((r) => setTimeout(r, 5000));
    const txHash = generateMockTxHash();
    // Simulate INIT balance arriving on the destination (if an Initia wallet is connected)
    if (address && m.details.dstChainId === "interwoven-1") {
      setMockBalances((prev) => {
        const current = parseFloat(prev[address] || "0");
        const added = parseFloat(m.details!.amount) || 0;
        return { ...prev, [address]: String(current + added) };
      });
    }
    m.resolve({ txHash });
    setBridgeModal({ open: false, details: null, resolve: null, reject: null });
  }, [bridgeModal, address]);

  const handleModalCancel = useCallback(() => {
    if (bridgeModal.reject) {
      bridgeModal.reject(new Error("Bridge cancelled by user"));
    }
    setBridgeModal({ open: false, details: null, resolve: null, reject: null });
  }, [bridgeModal]);

  const openBridgeReal = useCallback(
    async (details: BridgeTransferDetails) => {
      const useReal = import.meta.env.VITE_USE_REAL_BRIDGE === "true";
      if (useReal) {
        try {
          // The real @initia/interwovenkit-react package exposes openBridge
          // only through a hook, which can't be called from here. A swap-in
          // integration should (1) install the package, (2) wrap its provider
          // around this one, and (3) overwrite this function from a
          // component that does have hook access. Until then, deep-link.
          throw new Error(
            "Real InterwovenKit hook not wired — install @initia/interwovenkit-react and inject via component"
          );
        } catch (err) {
          console.warn(
            "[InterwovenKit] Real bridge unavailable, falling back to deep link:",
            err
          );
        }
      }
      const url = `https://bridge.testnet.initia.xyz/?srcChainId=${encodeURIComponent(
        details.srcChainId
      )}&dstChainId=${encodeURIComponent(
        details.dstChainId
      )}&amount=${encodeURIComponent(details.amount)}`;
      window.open(url, "_blank", "noopener");
      return { fallback: true as const, url };
    },
    []
  );

  const getInitiaBalance = useCallback(
    async (addr?: string | null): Promise<string> => {
      const target = addr ?? address;
      if (!target) return "0";
      // In the stub this returns the mocked balance accumulated from simulated bridges
      // Real implementation would query the Initia LCD/RPC
      return mockBalances[target] || "0";
    },
    [address, mockBalances]
  );

  const _devSetChainId = useCallback((newChainId: string) => {
    setChainId(newChainId);
    console.log("[InterwovenKit Stub] chainId set to", newChainId);
  }, []);

  return (
    <InterwovenKitContext.Provider
      value={{
        address,
        chainId,
        walletType,
        isConnected: address !== null,
        connect,
        connectWeb3,
        createInitiaWallet,
        disconnect,
        requestTxSync,
        autoSign,
        openBridgeLegacy,
        openBridge,
        openBridgeReal,
        getInitiaBalance,
        _devSetChainId,
      }}
    >
      {children}
      {bridgeModal.open && bridgeModal.details && (
        <BridgeModal
          details={bridgeModal.details}
          onConfirm={handleModalConfirm}
          onCancel={handleModalCancel}
        />
      )}
    </InterwovenKitContext.Provider>
  );
}

export function useInterwovenKit(): InterwovenKitContextType {
  const ctx = useContext(InterwovenKitContext);
  if (!ctx) {
    throw new Error(
      "useInterwovenKit must be used within <InterwovenKitProvider>"
    );
  }
  return ctx;
}

export function useUsernameQuery(
  _address: string | null
): { data: string | null; isLoading: boolean } {
  return { data: null, isLoading: false };
}
