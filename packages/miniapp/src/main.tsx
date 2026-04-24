import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createConfig, http, WagmiProvider } from "wagmi";
import { mainnet } from "wagmi/chains";
import type { Chain as InitiaChain } from "@initia/initia-registry-types";
import {
  InterwovenKitProvider as RealInterwovenKitProvider,
} from "@initia/interwovenkit-react";
import { InterwovenKitProvider } from "./lib/interwovenkit";
import App from "./App";
import "./styles/globals.css";

// Cosmos chain-id for the weezdraw appchain. The EVM chain-id
// (263688080101374) is derived by minievm from keccak256(chainId).
const COSMOS_CHAIN_ID = "weezdraw-1";

// Minimal Initia-registry description of our appchain. The SDK reads this
// through `customChain` to render the chain in bridge/portfolio UIs and to
// address it in tx flows.
const weezdrawChain: InitiaChain = {
  chain_name: "weezdraw",
  chain_id: COSMOS_CHAIN_ID,
  evm_chain_id: 263688080101374,
  pretty_name: "WeezDraw",
  network_type: "testnet",
  bech32_prefix: "init",
  fees: {
    fee_tokens: [
      {
        denom: "ugas",
        fixed_min_gas_price: 0,
        low_gas_price: 0,
        average_gas_price: 0,
        high_gas_price: 0,
      },
    ],
  },
  apis: {
    rpc: [
      {
        address: "https://d65eejblzmppfzu2a4a8u9nu.138.201.153.194.sslip.io",
      },
    ],
    rest: [
      {
        address: "https://d65eejblzmppfzu2a4a8u9nu.138.201.153.194.sslip.io",
      },
    ],
    "json-rpc": [
      {
        address: "https://d65eejblzmppfzu2a4a8u9nu.138.201.153.194.sslip.io",
      },
    ],
  },
} as InitiaChain;

// Wagmi config — required because InterwovenKit's wallet-connection layer
// depends on Wagmi. We only declare mainnet here; the actual appchain txs
// go through the Initia cosmos pipeline, not Wagmi's viem transport.
const wagmiConfig = createConfig({
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(),
  },
});

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RealInterwovenKitProvider
          defaultChainId={COSMOS_CHAIN_ID}
          customChain={weezdrawChain}
          enableAutoSign={true}
          theme="dark"
        >
          <InterwovenKitProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </InterwovenKitProvider>
        </RealInterwovenKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);
