export const config = {
  PORT: parseInt(process.env.PORT || "3001"),
  DATABASE_URL: process.env.DATABASE_URL || "",
  BOT_TOKEN: process.env.BOT_TOKEN || "",
  JWT_SECRET: process.env.JWT_SECRET || "dev-secret-change-me",
  RESOLVER_PRIVATE_KEY: process.env.RESOLVER_PRIVATE_KEY || "",
  INITIA_RPC_URL: process.env.INITIA_RPC_URL || "http://localhost:8545",
  INITIA_WS_URL: process.env.INITIA_WS_URL || "ws://localhost:8546",
  INITIA_CHAIN_ID: parseInt(process.env.INITIA_CHAIN_ID || "1"),
  ACCESS_REGISTRY_ADDR: process.env.ACCESS_REGISTRY_ADDR || "",
  FEE_ROUTER_ADDR: process.env.FEE_ROUTER_ADDR || "",
  ESCROW_ADDR: process.env.ESCROW_ADDR || "",
  WAGER_CONTRACT_ADDR: process.env.WAGER_CONTRACT_ADDR || "",
};
