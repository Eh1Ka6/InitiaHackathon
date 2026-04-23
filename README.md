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
│ InterwovenKit│     │  ├ WeezWager     │
└──────────────┘     │  ├ WeezEscrow    │
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
| `WeezWager` | Core wagering logic — create, enter, startGame, settle, cancel |
| `WeezEscrow` | Holds player stakes securely during wagers |
| `FeeRouter` | Platform fee collection and distribution (2%) |
| `AccessRegistry` | Role-based access control (admin, resolver, operator) |

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
│   ├── contracts/     — Solidity + Hardhat (4 contracts, 15 tests)
│   ├── backend/       — Express + Prisma (auto-settlement engine)
│   ├── bot/           — grammY (7 commands, inline keyboards)
│   └── miniapp/       — React + Canvas Stack game
└── README.md
```

## Setup

See [SETUP.md](SETUP.md) for detailed instructions.

## Demo Video

[Link to demo video]

## Team

Built by Weezdraw for the INITIATE Hackathon.

## License

MIT
