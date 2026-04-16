# InitiaHackathon

## Project Overview
**INITIATE** — Initia Appchain Hackathon submission
- **Platform**: DoraHacks (https://dorahacks.io/hackathon/initiate)
- **Prize Pool**: $25,000 USD
- **Deadline**: 2026-04-26 00:00 UTC (extended)
- **Format**: Virtual

## Stack
- **Blockchain**: Initia Appchain (custom rollup on Initia L1)
- **VM**: TBD (Move / EVM / Wasm — see track selection below)
- **Frontend**: React + Vite + InterwovenKit
- **AI** (if AI track): Offchain inference via Claude API
- **Tools**: Docker, Go 1.22+, weave CLI, initiad, minitiad

## Track Options
| Track | VM | Language |
|-------|-----|----------|
| Gaming/Consumer | Move | Move |
| DeFi/Institutional | EVM | Solidity |
| AI/Tooling | Wasm | Rust |

## Required Native Feature (pick at least one)
- Auto-signing (Ghost Wallet session keys)
- Interwoven Bridge (L1 <-> appchain asset movement)
- Initia Usernames (`.init` human-readable identities)

## Submission Checklist
- [ ] Deployed appchain with Chain ID
- [ ] Smart contracts deployed and functional
- [ ] React frontend connected via InterwovenKit
- [ ] At least one native Initia feature integrated
- [ ] GitHub repository with clean code
- [ ] Demo video recorded
- [ ] Submit on DoraHacks before 2026-04-26

## Key Resources
- Docs: https://docs.initia.xyz/hackathon/get-started
- Builder Guide: https://docs.initia.xyz/hackathon/builder-guide
- AI Track: https://docs.initia.xyz/hackathon/ai-track-guidance
- Faucet: https://app.testnet.initia.xyz/faucet
- Agent Skills: `npx skills add initia-labs/agent-skills`

## Project Structure (planned)
```
InitiaHackathon/
├── contracts/          # Smart contracts (Move/Solidity/Rust)
├── frontend/           # React + Vite app
├── scripts/            # Deployment & setup scripts
├── .env.example        # Environment template (never commit .env)
└── CLAUDE.md           # This file
```

## Conventions
- Never commit `.env` or API keys
- All contract addresses logged in `deployed.json` after deployment
- Use InterwovenKit for all wallet/signing interactions
- Follow Initia's naming conventions for modules/contracts

## Agent Instructions
- Read `AIbrain/00-System/Agent-Guidelines.md` before starting work
- Log sessions to `AIbrain/Sessions/`
- Architecture reference: `AIbrain/Projects/InitiaHackathon/Architecture.md`
