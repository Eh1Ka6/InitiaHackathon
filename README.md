# WeezDraw — Wager. Play. Win.

A Telegram Mini App where players challenge each other to a Stack game with real crypto stakes on an Initia EVM appchain. Higher score wins — settlement is automatic.

## How It Works

1. **Challenge** — Type `/wager @friend 50` in any Telegram chat
2. **Deposit** — Both players deposit INIT stakes via auto-signing (no wallet popups)
3. **Play** — Compete in the Stack block-stacking game
4. **Win** — Higher score wins the pot, settled automatically on-chain

## Architecture

```
┌──────────────┐     ┌──────────────────┐
│ Telegram Bot │────▶│  Backend API      │
│ (grammY)     │     │  Express + Prisma │
└──────┬───────┘     └────────┬─────────┘
       │                      │
       ▼                      ▼
┌──────────────┐     ┌──────────────────┐
│ Mini App     │────▶│ Initia EVM       │
│ React + Game │     │ Appchain         │
│ InterwovenKit│     │  ├ WeezDraw      │
└──────────────┘     │  ├ WeezEscrow    │
                     │  ├ DrawHub       │
                     │  ├ CommunityDraw │
                     │  └ FeeRouter     │
                     └──────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | Initia EVM Appchain |
| Smart Contracts | Solidity 0.8.19, Hardhat, OpenZeppelin |
| Backend | Express, Prisma, PostgreSQL, ethers.js v6 |
| Telegram Bot | grammY |
| Mini App | React, Vite, TailwindCSS, Canvas |
| Wallet | InterwovenKit |

## Initia Native Features

- **Auto-signing** — Ghost Wallet for frictionless stake deposits
- **Interwoven Bridge** — Bridge from Polygon/BNB Chain into the appchain
- **Initia Usernames** — `.init` names in player lists

## Smart Contracts

| Contract | Purpose |
|----------|---------|
| `WeezDraw` | 1v1 wagering logic — create, enter, startGame, settle, cancel |
| `DrawHub` | Sponsored / protocol-run draw lifecycle (VRF-backed) |
| `CommunityDrawHub` | User-created prize draws with ticket sales + VRF settlement |
| `RandomnessAdapter` | Single-consumer VRF adapter (wraps BandVRF) — one per hub |
| `MockBandVRF` | Stand-in VRF oracle for hackathon demo |
| `WeezEscrow` | Holds all stakes / prize pools / ticket payments |
| `FeeRouter` | Platform fee collection and distribution (configurable) |
| `AccessRegistry` | Role-based access control (admin, resolver, operator, creator, community-creator) |

### Live Deployment (Initia appchain `weezdraw-1`)

- **Cosmos chain id**: `weezdraw-1`
- **EVM chain id**: `263688080101374` (`0xefd2aa588ffe`)
- **RPC**: `https://d65eejblzmppfzu2a4a8u9nu.138.201.153.194.sslip.io`
- **Deployer**: `0xE65460ae5DF23f0Ea2c88590f7b16F4703843898`

| Contract | Address |
|----------|---------|
| AccessRegistry             | `0x8fb4d8Ff0a676e5dA88234F7556B91Fb8C70F0C8` |
| FeeRouter                  | `0x7845094500CDdbCcC7139E2bA292c9ee4D3b1b14` |
| WeezEscrow                 | `0x75c8a81e660e53d8843334a9dF933FC757Ae3f18` |
| WeezDraw                   | `0xb84572d82b62e112fe3063640b5712A91BB73885` |
| DrawHub                    | `0x89D70c653DfDc28fc457d1e3c97279f9eDbdf769` |
| RandomnessAdapter          | `0xD29c06CeA355b7207739f261E13bAa43be5b8dfc` |
| MockBandVRF                | `0x361fE09a47eb7fdDcC023749AaC845c5EC488294` |
| CommunityDrawHub           | `0x5359dB33CF615eEdd738a7d72E8104de050F6B7d` |
| RandomnessAdapterCommunity | `0xE0d190A1E7949831403434E989F641c7BF4E2143` |

Canonical addresses are kept in [`packages/contracts/deployments/initia/draws.json`](packages/contracts/deployments/initia/draws.json) and [`.initia/submission.json`](.initia/submission.json).

## Game: Stack

A block-stacking game with 3D isometric rendering, particle effects, combo system, and speed ramping. Players tap to align blocks — perfect alignment (within 5px) gives +2 points. The game uses a server-generated seed for deterministic difficulty, preventing score manipulation.

Anti-cheat: seed-based RNG + play-time validation (score of 50 requires minimum ~15 seconds of play).

## Revenue Model

2% platform fee on every wager. Winner receives 98% of the combined pot.

## Cross-Chain

Players bridge funds from Polygon, BNB Chain, or other supported chains via Interwoven Bridge — one click in the Mini App.

## Project Structure

```
InitiaHackathon/
├── .initia/submission.json
├── packages/
│   ├── contracts/     — Solidity + Hardhat (core + draws + community-draws)
│   ├── backend/       — Express + Prisma (auto-settlement engine)
│   ├── bot/           — grammY (7 commands, inline keyboards)
│   └── miniapp/       — React + Canvas Stack game
└── README.md
```

## Setup

See [SETUP.md](SETUP.md) for detailed local-dev instructions.

## Running the Demo

1. Open Telegram and find the bot: **@WeezDrawBot** (token `8220632771:...`).
2. In any chat, run `/wager @friend 50` to open a 1v1 Stack challenge with a 50 INIT stake, `/draws` to browse community draws, or `/createdraw` to start your own community draw.
3. The bot replies with an inline keyboard → tap **Open** to launch the Mini App (served from Coolify; URL is published via `MINIAPP_URL` in the bot's env).
4. Connect via InterwovenKit (auto-signing Ghost Wallet), play, and settlement hits the appchain automatically.

### Developer quick-check

```
curl -sS -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
  https://d65eejblzmppfzu2a4a8u9nu.138.201.153.194.sslip.io
# → {"jsonrpc":"2.0","id":1,"result":"0xefd2aa588ffe"}
```

## Submission Artifact

The canonical hackathon submission manifest lives at [`.initia/submission.json`](.initia/submission.json).

## Demo Video

[Link to demo video]

## Team

Built by Weezdraw for the INITIATE Hackathon.

## License

MIT
