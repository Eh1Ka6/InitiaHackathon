export const CHAIN_CONFIG = {
  chainId: import.meta.env.VITE_CHAIN_ID || "weezdraw-1",
  rpcUrl: import.meta.env.VITE_RPC_URL || "http://localhost:8545",
};

export const CONTRACTS = {
  WAGER: import.meta.env.VITE_WAGER_CONTRACT || "",
  ESCROW: import.meta.env.VITE_ESCROW_CONTRACT || "",
};
