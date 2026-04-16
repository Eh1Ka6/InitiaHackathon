# WeezWager — Developer Setup Guide

## Prerequisites
- Docker Desktop (must be running)
- Go 1.22+
- Node.js 18+
- jq
- Git

## 1. Install Initia Tools

```bash
# Install weave CLI
curl -L https://weave.initia.xyz/install | bash

# Install initiad
# Follow: https://docs.initia.xyz/build-on-initia/cli/initiad

# Verify
weave --version
initiad version
```

## 2. Launch EVM Appchain

```bash
# Launch a new EVM rollup
weave rollup launch --vm evm

# This will:
# - Bootstrap a local rollup node (minitiad)
# - Start OPinit Executor
# - Start IBC Relayer
# - Create Gas Station keys

# SAVE YOUR CHAIN ID — needed for submission
# The chain ID will be displayed after launch
```

## 3. Fund Your Wallet

```bash
# Get testnet INIT tokens from faucet
# Visit: https://app.testnet.initia.xyz/faucet

# Import Gas Station keys
weave gas-station import
```

## 4. Deploy Smart Contracts

```bash
cd packages/contracts

# Copy .env
cp ../backend/.env.example .env
# Edit .env with your Chain ID, RPC URL (default http://localhost:8545), and deployer private key

# Deploy
npx hardhat run scripts/deploy.ts --network initia

# This saves addresses to deployed.json
```

## 5. Set Up Database

```bash
# Start PostgreSQL (Docker)
docker run -d --name weezwager-db -e POSTGRES_PASSWORD=weezwager -e POSTGRES_DB=weezwager -p 5432:5432 postgres:16

# Configure backend
cd packages/backend
cp .env.example .env
# Edit .env with:
# DATABASE_URL=postgresql://postgres:weezwager@localhost:5432/weezwager
# Fill in contract addresses from deployed.json
# Fill in BOT_TOKEN from BotFather

# Run migrations
npx prisma db push
```

## 6. Create Telegram Bot

1. Open Telegram, message @BotFather
2. Send `/newbot`, follow prompts
3. Name it "WeezWager" (or similar)
4. Copy the bot token to `.env` files
5. Set commands: `/setcommands` →
```
wager - Challenge someone to Stack
pool - Create a wagering pool
status - Check your wagers
cancel - Cancel a wager
link - Connect your wallet
balance - Check your balance
help - Show commands
```
6. Set Menu Button → Web App URL (your miniapp HTTPS URL)

## 7. Start Development Servers

```bash
# Terminal 1: Backend
cd packages/backend
npm run dev

# Terminal 2: Bot
cd packages/bot
npm run dev

# Terminal 3: Mini App
cd packages/miniapp
npm run dev
```

## 8. Configure Mini App HTTPS

Telegram requires HTTPS for Mini Apps. Options:
- **ngrok**: `ngrok http 5173` → use the https URL
- **Cloudflare Tunnel**: `cloudflared tunnel --url http://localhost:5173`
- **Vercel**: Deploy miniapp for production

Set the HTTPS URL as MINIAPP_URL in bot's .env.

## 9. Test End-to-End

1. Open Telegram, message your bot
2. Type `/wager @friend 50`
3. Accept the challenge
4. Open Mini App via button
5. Connect wallet, deposit
6. Play Stack game
7. Verify settlement

## 10. Submit

1. Update `.initia/submission.json` with chain_id and contract addresses
2. Record demo video
3. Push to GitHub
4. Submit on DoraHacks: https://dorahacks.io/hackathon/initiate

## Environment Variables Reference

| Variable | Where | Description |
|----------|-------|-------------|
| INITIA_RPC_URL | backend | Appchain RPC (default: http://localhost:8545) |
| INITIA_CHAIN_ID | backend, miniapp | Your appchain chain ID |
| DATABASE_URL | backend | PostgreSQL connection |
| BOT_TOKEN | backend, bot | From @BotFather |
| JWT_SECRET | backend | Random secret for auth |
| RESOLVER_PRIVATE_KEY | backend | Wallet with RESOLVER_ROLE |
| MINIAPP_URL | bot | HTTPS URL of deployed miniapp |
| VITE_API_URL | miniapp | Backend API URL |
| VITE_CHAIN_ID | miniapp | Appchain chain ID |
| VITE_WAGER_CONTRACT | miniapp | WeezWager contract address |
