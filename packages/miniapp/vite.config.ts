import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Polyfill Buffer, process, etc. — required by @privy-io/cross-app-connect
      // and other cosmjs / walletconnect deps pulled in by @initia/interwovenkit-react.
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    allowedHosts: true,
  },
});
