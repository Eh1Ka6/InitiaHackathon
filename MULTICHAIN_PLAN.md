# INITIATE Multichain Implementation Plan (v2)

**Target**: Three-player draw with Polygon / BNB / Initia wallet origins, single draw on Initia, winner paid on Initia with optional bridge-back.
**Deadline**: 2026-04-26 00:00 UTC (4 days from 2026-04-22).
**Author perspective**: Software architect, hackathon-grade scope.
**Revision**: v2 — supersedes v1. Collapses to Initia-only hub; removes LayerZero; uses Interwoven Bridge for value movement; replaces on-chain score logic with backend-filtered qualifier list; replaces tiered multiplier with 4 pre-defined probability configs.

---

## 0. Corrections to the brief (read first)

Three clarifications from the user override v1. Read these before any section below.

**(a) The 80% qualifier filter is backend-only.** On-chain state only knows "these N players qualified." DrawHub does NOT hold scores, does NOT verify score EIP-712 signatures, and does NOT expose `submitScore()`. Replaced with a single admin entrypoint:

```
recordQualifiers(uint256 drawId, address[] qualifiedPlayers)   // onlyRole(RESOLVER_ROLE)
```

The backend computes the 80% threshold off-chain using the same scoring source it already trusts for `WeezWager` settlement, then calls `recordQualifiers` once per draw. No per-player EIP-712 typehash. No nonce/deadline machinery for scores.

**(b) Multiplier = 4 pre-defined probability configs, not 4-tier on-chain derivation.** Each draw is created with a `multiplierConfigId ∈ {0, 1, 2, 3}`. Each config has 6 multipliers (x300, x100, x50, x20, x10, x8) with probabilities summing to exactly 100%. Precision is 10^-8 (100 million buckets). Implemented as cumulative threshold arrays inside a new library `MultiplierLib.sol`. Verified sums: all 4 configs equal exactly `100_000_000` (unit test).

**(c) Value bridging uses Interwoven Bridge, not a lockbox + LayerZero message ledger.** Real funds move to Initia BEFORE the draw starts. Each remote player bridges native asset (MATIC, BNB, etc.) into INIT via `InterwovenKit.openBridge(...)`. Deposits into the draw are ALWAYS local on Initia. Winner receives INIT on Initia; the miniapp optionally prompts a reverse bridge back to the player's home chain.

**Consequence**: there is NO `CrossChainEscrow.sol`, NO `LzReceiverHub.sol`, NO LayerZero OApp on any chain, NO LZ message schema, NO `MockLzEndpoint.sol`. `DrawHub.sol` is Initia-only. The "multichain" narrative is told via wallet origin + Interwoven Bridge flows in the miniapp, not via cross-chain smart contracts.

**Critical risk verified up front**: `InterwovenKit.openBridge(bridgeTransferDetails)` is a **UI modal**, not a programmatic/headless API. Contracts cannot invoke it. Users must confirm interactively. Day 1 must verify that `openBridge` actually supports `srcChainId = 137` (Polygon) / `56` (BNB) → `interwoven-1` (Initia). If it only supports rollup-to-rollup, fallback is a deep link to the standalone bridge UI at `bridge.initia.xyz` / `bridge.testnet.initia.xyz` with pre-filled query params.

---

## 1. Contract topology — who lives where

### Initia (the only chain with contracts)

- `AccessRegistry.sol` (ported, unchanged)
- `FeeRouter.sol` (ported, unchanged)
- `WeezEscrow.sol` (ported, unchanged — now holds ALL three players' bridged INIT, not just one)
- `WeezWager.sol` (ported, unchanged — stays for future duel/pool flows, not on the demo path)
- **NEW** [RandomnessAdapter.sol](packages/contracts/contracts/core/RandomnessAdapter.sol) — Band VRF wrapper exposing a Chainlink-VRFv2-shaped API (`requestRandomWord(drawId)` / internal `fulfillRandomWord(requestId, randomWord)` calling a registered consumer). One file, one role: translate Band's callback shape so the draw logic is portable.
- **NEW** [DrawHub.sol](packages/contracts/contracts/core/DrawHub.sol) — single-chain draw state machine on Initia. Tracks participants, stake amounts, qualifier list, `multiplierConfigId`, VRF request, winner, and final multiplier. Only contract that calls `RandomnessAdapter`. Calls `WeezEscrow.releaseToWinners` + `FeeRouter.depositFees` on settlement.
- **NEW** [MultiplierLib.sol](packages/contracts/contracts/libraries/MultiplierLib.sol) — immutable library holding the 4 cumulative-threshold arrays. Pure function `pickMultiplier(uint8 configId, uint256 entropy) → uint16 multiplierX1` (returns integer multiplier, e.g. `300` for 3.00x).

### Polygon, BNB, and every other chain

**Zero contracts.** These chains exist only as wallet origins. The miniapp detects the user's connected wallet chain and offers a bridge-in if the chain is not Initia. Nothing else.

### Diagram

```
    POLYGON WALLET            BNB WALLET              INITIA WALLET
   ┌──────────────┐         ┌──────────────┐        ┌──────────────┐
   │  MetaMask    │         │  MetaMask    │        │ InterwovenKit│
   │  chainId 137 │         │  chainId 56  │        │ interwoven-1 │
   │ (MATIC bal.) │         │ (BNB bal.)   │        │  (INIT bal.) │
   └──────┬───────┘         └──────┬───────┘        └──────┬───────┘
          │                        │                       │
          │ openBridge()           │ openBridge()          │ (native, no bridge)
          │ or bridge.initia.xyz   │ or bridge.initia.xyz  │
          ▼                        ▼                       ▼
   ┌─────────────────────────────────────────────────────────────┐
   │                   INITIA (hub, only chain w/ contracts)     │
   │                                                             │
   │   AccessRegistry  FeeRouter  WeezEscrow                     │
   │                                                             │
   │   DrawHub ──► RandomnessAdapter ──► Band VRF                │
   │     │                                                       │
   │     └── imports MultiplierLib (4 probability configs)       │
   └─────────────────────────────────────────────────────────────┘
          │                        │                       │
          │ (winner paid in INIT on Initia — always)       │
          │                        │                       │
          ▼                        ▼                       ▼
     optional openBridge() reverse  ◄──── winner chooses ───► keep as INIT
```

**Hub chain**: Initia. Only chain. Everything happens on Initia.

---

## 2. Deposit flow — bridge first, then deposit locally

### Two paths

#### Path 1: Player C (Initia native)
- Wallet: InterwovenKit, chain `interwoven-1`.
- No bridging.
- Miniapp calls `DrawHub.depositLocal{value: 1 INIT}(drawId)`.
- `DrawHub` locks funds into `WeezEscrow.lock(drawId, player, amount)` and records `participants[drawId].push(player)`, `stake[drawId][player] = amount`.

#### Path 2: Players A (Polygon) and B (BNB)
- Wallet: MetaMask connected to chain 137 (A) or chain 56 (B).
- Miniapp renders `BridgePrompt`. Two-step UX:

**Step 2a — Bridge via InterwovenKit modal**

```ts
const { openBridge } = useInterwovenKit();

await openBridge({
  srcChainId: '137',               // or '56' for BNB
  srcDenom: MATIC_ADDRESS,         // native token address on Polygon
  dstChainId: 'interwoven-1',
  dstDenom: 'uinit',               // INIT on Initia
  amount: targetInitEquivalent,    // miniapp converts via FX shown to user
});
```

User confirms the modal → waits for bridge to finalize. Miniapp polls Initia-side wallet balance via `useBridgeStatus` hook (see section 8) until INIT balance ≥ target. Typically seconds to a few minutes depending on corridor.

**Step 2b — Local deposit on Initia**

Once INIT balance appears, the miniapp prompts the user to switch wallet context to InterwovenKit (if not already open in parallel) and calls `DrawHub.depositLocal{value: 1 INIT}(drawId)` exactly like Path 1. From `DrawHub`'s perspective there is no difference between Player A, B, or C — all three deposits are native Initia transactions.

### Fallback: bridge SDK lacks EVM-origin support

If Day 1 verification shows `openBridge` does not support `srcChainId = 137` or `56`, the miniapp falls back to a deep link:

```
https://bridge.testnet.initia.xyz/?srcChainId=137&srcDenom=<MATIC>&dstChainId=interwoven-1&dstDenom=uinit&amount=<N>
```

Opens in a new tab. User completes the bridge on the standalone site and returns. Miniapp continues to poll Initia balance to detect completion. UX is clunkier but functionally identical.

### Entry fee

One fixed amount in INIT per player per draw (e.g. `1 INIT`). Set at `createDraw(drawId, entryFeeInit, deadline, multiplierConfigId)`. No per-chain normalization — everyone pays the same INIT amount. Players A and B pre-bridge enough MATIC/BNB to cover fee + gas + bridge slippage; backend shows a "bridge at least X MATIC" hint.

### DrawHub deposit logic

```
DrawHub.depositLocal(uint256 drawId) payable:
  require(draws[drawId].status == Open)
  require(msg.value == draws[drawId].entryFee)
  require(!hasEntered[drawId][msg.sender])
  require(block.timestamp < draws[drawId].deadline)

  hasEntered[drawId][msg.sender] = true
  participants[drawId].push(msg.sender)
  WeezEscrow.lock{value: msg.value}(drawId, msg.sender, msg.value)

  emit ParticipantEnrolled(drawId, msg.sender, msg.value)
```

No LayerZero path, no `recordDeposit`, no `homeChain` parameter on-chain. The home-chain origin is a frontend concern (shown in the UI, logged to backend for analytics), not a contract concern.

---

## 3. VRF flow — Band VRF on Initia, qualifiers recorded by backend

### Lifecycle

```
Open → (all 3 deposits in, deadline elapsed) → AwaitingQualifiers
     → recordQualifiers() → Qualified
     → requestRandomness() → RandomnessRequested
     → Band VRF callback → Settled
```

### Steps

1. **Deposit window closes.** After the third deposit or `block.timestamp >= deadline`, draw status → `AwaitingQualifiers`.
2. **Backend filters qualifiers off-chain.** `drawResolver.ts` reads scores from the backend's existing Stack-game score store, applies the ≥ 80% filter, then calls:

   ```
   DrawHub.recordQualifiers(uint256 drawId, address[] qualifiers)   // onlyRole(RESOLVER_ROLE)
   ```

   If `qualifiers.length == 0` → `DrawHub.cancel(drawId)` → refund every deposit from `WeezEscrow` locally. Done.

3. **Admin triggers VRF.** After qualifiers are recorded and deadline has elapsed, any `RESOLVER_ROLE` or `PROTOCOL_ADMIN_ROLE` can call:

   ```
   DrawHub.requestRandomness(uint256 drawId)
   ```

   which calls `RandomnessAdapter.requestRandomWord(drawId)`. Adapter stores `requestId → drawId` and calls the Band VRF contract on Initia (follow the Zaar Chain integration sample as the reference for the request side).

4. **VRF callback.** Band delivers `fulfillRandomWord(requestId, uint256 randomWord)`. Adapter forwards to `DrawHub.onRandomness(drawId, randomWord)`.

5. **Winner + multiplier derivation (inside `DrawHub.onRandomness`).** Use two independent slices of the random word so winner pick and multiplier pick are uncorrelated:

   ```
   uint256 wEntropy = uint256(keccak256(abi.encode(randomWord, "winner")));
   uint256 mEntropy = uint256(keccak256(abi.encode(randomWord, "multiplier")));

   uint256 winnerIdx   = wEntropy % qualifiers[drawId].length;
   address winner      = qualifiers[drawId][winnerIdx];

   uint16  multiplier  = MultiplierLib.pickMultiplier(draws[drawId].configId, mEntropy);
   ```

   Status → `Settled`. Emit `DrawSettled(drawId, winner, multiplier, payout)`.

### The 4 multiplier configs

Each config: 6 multipliers `[x300, x100, x50, x20, x10, x8]`, probabilities sum to exactly 100% at 10^-8 precision (`100_000_000` buckets).

| Config | x300        | x100       | x50       | x20        | x10         | x8           |
|--------|-------------|------------|-----------|------------|-------------|--------------|
| 0      | 0.00006%    | 2.008%     | 6.12%     | 12.00%     | 44.00%      | 35.87194%    |
| 1      | 0.00006%    | 0.008%     | 0.12%     | 6.00%      | 54.00%      | 39.87194%    |
| 2      | 0.00004%    | 0.004%     | 0.04%     | 3.20%      | 46.00%      | 50.75596%    |
| 3      | 0.00003%    | 0.003%     | 0.03%     | 2.50%      | 42.00%      | 55.46697%    |

**Bucket counts (10^-8 precision):**

| Config | x300 | x100       | x50       | x20        | x10        | x8         | Sum          |
|--------|------|------------|-----------|------------|------------|------------|--------------|
| 0      | 60   | 2,008,000  | 6,120,000 | 12,000,000 | 44,000,000 | 35,871,940 | 100,000,000 ✓ |
| 1      | 60   | 8,000      | 120,000   | 6,000,000  | 54,000,000 | 39,871,940 | 100,000,000 ✓ |
| 2      | 40   | 4,000      | 40,000    | 3,200,000  | 46,000,000 | 50,755,960 | 100,000,000 ✓ |
| 3      | 30   | 3,000      | 30,000    | 2,500,000  | 42,000,000 | 55,466,970 | 100,000,000 ✓ |

**Cumulative thresholds** (to copy verbatim into `MultiplierLib.sol`; order: x300, x100, x50, x20, x10, x8):

```
Config 0: [60,  2_008_060,  8_128_060, 20_128_060, 64_128_060, 100_000_000]
Config 1: [60,      8_060,    128_060,  6_128_060, 60_128_060, 100_000_000]
Config 2: [40,      4_040,     44_040,  3_244_040, 49_244_040, 100_000_000]
Config 3: [30,      3_030,     33_030,  2_533_030, 44_533_030, 100_000_000]
```

Each row's final entry is exactly `100_000_000`, which is the required invariant — enforce it in a unit test.

### MultiplierLib.pickMultiplier — exact algorithm

```
function pickMultiplier(uint8 configId, uint256 entropy) pure returns (uint16 mult):
    require(configId < 4, "bad config")

    uint32 roll = uint32(entropy % 100_000_000)
    uint32[6] memory thresholds = _CONFIG[configId]
    uint16[6] memory values     = [300, 100, 50, 20, 10, 8]

    for (uint i = 0; i < 6; i++):
        if (roll < thresholds[i]):
            return values[i]

    revert "unreachable"   // guaranteed by invariant: thresholds[5] == 100_000_000
```

`_CONFIG[0..3]` holds the four cumulative threshold arrays above as `uint32[6]` constants. Linear scan is fine — 6 elements, gas is noise.

### Pot + payout math

- `gross = sum of all stakes in draw = entryFee * participants.length`
- `(net, feeAmount) = FeeRouter.calculateFees(drawId, gross)`
- `boosted = net * multiplier`
- `payout = min(boosted, gross)` — cap at gross because we have no jackpot pool on a hackathon budget
- If `boosted > gross`: emit `MultiplierCapped(drawId, multiplier, boosted, payout)` for honesty

### Contrast with v1

- v1 had on-chain score submission with per-player EIP-712 sig → v2 has a single `recordQualifiers(drawId, addresses[])` call.
- v1 had 4 hardcoded tier bands keyed off the random word → v2 has `multiplierConfigId` chosen at draw creation and a library-held probability table.
- v1 winner pick and multiplier pick both used the same `randomWord` directly (slight correlation) → v2 derives two independent entropies via `keccak256(..., "winner")` and `keccak256(..., "multiplier")`.

---

## 4. Settlement flow — single chain, optional reverse bridge

Everything is on Initia.

### On-chain settlement

Inside `DrawHub.onRandomness` immediately after picking winner + multiplier:

```
(uint256 net, uint256 feeAmt) = FeeRouter.calculateFees(drawId, gross)
uint256 boosted = net * multiplier
uint256 payout  = boosted > gross ? gross : boosted

address[] memory winners = new address[](1); winners[0] = winner
uint256[] memory payouts = new uint256[](1); payouts[0] = payout

WeezEscrow.releaseToWinners(drawId, winners, payouts)
FeeRouter.depositFees{value: feeAmt}(drawId)

emit DrawSettled(drawId, winner, multiplier, payout)
```

Winner's INIT wallet balance increases. No cross-chain messaging required.

### Optional reverse bridge (miniapp UX, not on-chain)

After `DrawSettled`, the miniapp shows the winner their payout in INIT and offers:

- **Keep as INIT** — nothing to do.
- **Bridge back to Polygon** → miniapp calls

  ```ts
  openBridge({
    srcChainId: 'interwoven-1',
    srcDenom:    'uinit',
    dstChainId:  '137',
    dstDenom:    MATIC_ADDRESS,
    amount:      payout,
  });
  ```

- **Bridge back to BNB** → same shape, `dstChainId: '56'`.

If the SDK doesn't support Initia → EVM direction either, fall back to the same `bridge.initia.xyz` deep link as Section 2 (reverse parameters).

Losing players' deposits: they sit in `WeezEscrow` as part of the settled payout pot and have already been distributed to winner + fee router. No per-loser refund.

---

## 5. Failure modes + mitigations

Shorter than v1 — no LayerZero to fail.

| Failure | What breaks | Mitigation |
|---|---|---|
| **Band VRF callback never fires** | Draw stuck in `RandomnessRequested` | `DrawHub.adminResetVrf(drawId)` after 1h grace → status back to `Qualified`, can re-request. If Band is dead entirely, `adminSettleWithSeed(drawId, uint256 seed)` gated by `PROTOCOL_ADMIN_ROLE` with a 10-min on-chain commit-reveal. Demo runs: pre-test VRF 10 times before recording the final take. |
| **Player doesn't finish bridge before deadline** | Only 1-2 deposits land; draw can't reach 3 participants | After deadline, `DrawHub.cancelDraw(drawId)` callable by admin → `WeezEscrow` refunds each deposit back to depositor's Initia wallet. Player can then reverse-bridge at their leisure. Honest demo behavior: set deadline generously (15-30 min post-launch). |
| **Zero qualifiers after score filtering** | No one qualifies for the draw | `drawResolver.ts` calls `DrawHub.cancelDraw(drawId)` instead of `recordQualifiers` → same refund path. |
| **Winner's reverse bridge fails** | Winnings sit on Initia | Funds are already in the winner's Initia wallet. They retry `openBridge` at any time. No contract intervention required. Miniapp shows "Your INIT is safe in your Initia wallet; retry bridge anytime." |
| **RESOLVER key compromised** | Attacker records false qualifier list | Out of scope for hackathon. Noted as a production hardening item: multisig + Ghost Wallet session keys for the resolver. |

---

## 6. Contract changes in `InitiaHackathon/packages/contracts/contracts/`

### New files

| Path | Purpose | Approx LOC |
|---|---|---|
| [core/DrawHub.sol](packages/contracts/contracts/core/DrawHub.sol) | Single-chain draw authority on Initia. States: Open → AwaitingQualifiers → Qualified → RandomnessRequested → Settled / Cancelled. Integrates with `AccessRegistry`, `WeezEscrow`, `FeeRouter`, `RandomnessAdapter`, `MultiplierLib`. | 300 |
| [core/RandomnessAdapter.sol](packages/contracts/contracts/core/RandomnessAdapter.sol) | Band VRF wrapper exposing `requestRandomWord(drawId)` + callback that forwards `(drawId, randomWord)` to a registered `IRandomnessConsumer`. | 120 |
| [libraries/MultiplierLib.sol](packages/contracts/contracts/libraries/MultiplierLib.sol) | Immutable library holding the 4 cumulative-threshold arrays and `pickMultiplier(configId, entropy)` pure function. | 90 |
| [interfaces/IRandomnessConsumer.sol](packages/contracts/contracts/interfaces/IRandomnessConsumer.sol) | Single function `fulfillRandomWord(uint256 requestId, uint256 randomWord)`. Implemented by `DrawHub`. | 10 |
| [mocks/MockBandVRF.sol](packages/contracts/contracts/mocks/MockBandVRF.sol) | Admin-triggerable `fulfill(requestId, randomWord)` for local testing. | 40 |

### Deleted from v1 (never build)

- `core/CrossChainEscrow.sol` — not needed
- `core/LzReceiverHub.sol` — not needed
- `interfaces/ICrossChainMessenger.sol` — not needed
- `mocks/MockLzEndpoint.sol` — not needed

### Modified files

| Path | Change |
|---|---|
| `core/AccessRegistry.sol` | None — reuse. |
| `core/FeeRouter.sol` | None — reuse. |
| `core/WeezEscrow.sol` | None — `DrawHub` registers as an active module and calls `lock` / `releaseToWinners` the same way `WeezWager` already does. |
| `core/WeezWager.sol` | None. Not on the demo path. |

None of the existing ported contracts need changes. All new work is additive.

### Deployment order (Initia only)

1. `AccessRegistry`
2. `WeezEscrow`
3. `FeeRouter`
4. `RandomnessAdapter` (constructor takes Band VRF address)
5. `DrawHub` (constructor takes `AccessRegistry`, `WeezEscrow`, `FeeRouter`, `RandomnessAdapter`; `MultiplierLib` is linked, not passed)
6. Register `DrawHub` as an active module in `AccessRegistry`
7. `RandomnessAdapter.setConsumer(drawHubAddr)`

No remote-chain deployments.

---

## 7. Backend + bot changes

### Backend (`packages/backend/src/`)

Single-chain listeners only — provider count drops from 3 to 1.

**New files:**
- [services/drawResolver.ts](packages/backend/src/services/drawResolver.ts) — on deadline reached (or all 3 scores submitted), reads scores from the existing Stack-game store, applies `score >= 80` filter, signs nothing (RESOLVER_ROLE is an on-chain role, not a signer), calls `DrawHub.recordQualifiers(drawId, qualifiers)` with a `RESOLVER_ROLE`-privileged key. If `qualifiers.length == 0` → `DrawHub.cancelDraw(drawId)`.
- [services/drawLifecycleBot.ts](packages/backend/src/services/drawLifecycleBot.ts) — after `recordQualifiers` is confirmed and deadline elapsed, calls `DrawHub.requestRandomness(drawId)`.
- [services/bridgeStatusPoller.ts](packages/backend/src/services/bridgeStatusPoller.ts) — polls each player's Initia wallet balance after they initiate a bridge; emits `BridgeCompleted(drawId, player)` over WS so miniapp can proceed. If Interwoven Bridge Scan API is available (verify Day 1), prefer that over balance polling for reliability.
- [routes/draws.ts](packages/backend/src/routes/draws.ts) — REST:
  - `POST /api/draws` → admin creates draw: generates `drawId`, calls `DrawHub.createDraw(drawId, entryFee, deadline, multiplierConfigId)`.
  - `GET /api/draws/:id` → reads on-chain draw state from Initia.
  - `POST /api/draws/:id/submit-score` → existing Stack-score ingestion, validates via `antiCheat.ts`, persists to score store; does NOT touch the chain. Qualifier filtering happens later in `drawResolver.ts`.

**Modified files:**
- `services/contract.ts` — single Initia provider + signer (removes Polygon/BNB providers from v1 plan).
- `abi/` — add `DrawHub.json`, `RandomnessAdapter.json`, `MultiplierLib.json`. Remove any references to `CrossChainEscrow.json` / `LzEndpoint.json`.

**Removed from v1:**
- `services/lzRelayListener.ts` — not needed
- `services/multiChainEventListener.ts` — collapsed into single-chain `eventListener.ts`
- `services/gasFaucet.ts` — not needed (winner already has INIT; if bridging back, they pay gas from their Polygon/BNB wallet on that side)

### Bot (`packages/bot/src/`)

- `/draw_status <drawId>` — shows deposit progress, qualifier count, VRF status.
- Callbacks: `onParticipantEnrolled`, `onQualifiersRecorded`, `onRandomnessRequested`, `onDrawSettled` (includes winner, multiplier, payout).

---

## 8. Miniapp changes (`packages/miniapp/src/`)

### New files

- [components/BridgePrompt.tsx](packages/miniapp/src/components/BridgePrompt.tsx) — detects non-Initia wallet, renders bridge UI. Calls `useInterwovenKit().openBridge({...})`. Shows target INIT amount, current balance, progress. If SDK returns unsupported-origin error, falls back to a deep-link button to `bridge.testnet.initia.xyz`.
- [hooks/useBridgeStatus.ts](packages/miniapp/src/hooks/useBridgeStatus.ts) — polls the user's Initia wallet balance every 5s after a bridge has been initiated; resolves when `balance >= target`. Also subscribes to the backend WS event from `bridgeStatusPoller.ts` for faster signal.
- `pages/ChainOriginDetect.tsx` — first-load flow detects wallet chainId. If `137 / 56 / others` → render `<BridgePrompt>` before allowing draw join. If `interwoven-1` → skip straight to deposit.
- `pages/DrawDeposit.tsx` — single-path deposit: `DrawHub.depositLocal{value: entryFee}(drawId)` via InterwovenKit. No per-chain contract branching.
- `pages/DrawStatus.tsx` — polls `GET /api/draws/:id`. Tiles show: participants enrolled, qualifiers recorded, VRF requested, VRF fulfilled, settled with winner + multiplier animation.
- `pages/PostSettlement.tsx` — for the winner, shows INIT payout and a "Bridge back to Polygon / BNB?" prompt wired to `openBridge` in reverse (with `bridge.initia.xyz` deep-link fallback).

### Removed from v1

- `lib/walletAdapter.ts` (MetaMask + InterwovenKit dual-wallet abstraction) — no longer needed. The miniapp only ever signs transactions on Initia. MetaMask is only touched to read the user's Polygon/BNB balance + to initiate a bridge (which the Interwoven Bridge SDK handles via its own signer flow).
- Any `CrossChainEscrow`-facing deposit code.

---

## 9. Cut list (reshuffled for v2)

| # | Feature | Must/Should/Nice | Fallback if cut |
|---|---|---|---|
| 1 | Interwoven Bridge integration for Polygon/BNB origins | **Must** | If `openBridge` SDK doesn't support EVM origins → deep-link to `bridge.initia.xyz` / `bridge.testnet.initia.xyz` with pre-filled params; user bridges out-of-app in a new tab. If the standalone bridge also lacks a Polygon/BNB corridor on testnet → all-on-Initia demo with three pre-funded wallets and voiceover explaining the bridge-in step as "in production, players from Polygon/BNB would bridge here via Interwoven Bridge." |
| 2 | Band VRF on Initia | **Must** | Commit-reveal fallback via `adminSettleWithSeed` (see Section 5). Provably random for demo purposes; label honestly. |
| 3 | 4 multiplier configs + `MultiplierLib` | **Must** | Don't cut. The spec is frozen; probability tables are the differentiator. |
| 4 | 80% qualifier filter (backend) + `recordQualifiers` | **Must** | Don't cut. Core narrative. |
| 5 | Draw lifecycle (create → deposit → qualify → VRF → settle) | **Must** | Don't cut. |
| 6 | Reverse bridge after win | Should | Winner keeps INIT on Initia; miniapp displays a "Payout received in INIT" confirmation and a link to the standalone bridge for later. |
| 7 | `drawLifecycleBot.ts` automation | Should | Trigger `requestRandomness` manually from Hardhat console during demo. |
| 8 | Bridge status polling via `bridgeStatusPoller.ts` | Nice | Miniapp balance polling alone is sufficient; skip backend bridge service. |
| 9 | Telegram bot notifications | Nice | Miniapp polling suffices. |
| 10 | `adminResetVrf` UI + failure-mode handlers | Nice | Hardhat-console triggers in demo. |

**Nuclear fallback (end of Day 3, bridge doesn't work at all)**: all-on-Initia demo with three pre-funded Initia wallets. Same `DrawHub` + VRF + `MultiplierLib` story. Label the cross-chain part as "architecture designed, Interwoven Bridge verified separately — see attached screen recording of the bridge UI." Still ships a full on-chain draw with Band VRF on Initia, which is the core judging criterion.

---

## 10. Four-day schedule (2026-04-22 → 2026-04-26)

Assume 12h/day, one dev, Claude agents doing narrow coding subtasks in parallel.

### Tuesday 2026-04-22 (today) — Foundation & risk reduction

- **Morning (4h)** — **Band VRF spike.** Read Band VRF docs + Zaar Chain reference integration. Deploy `MockBandVRF`. Write `RandomnessAdapter.sol`. Get a real random word on Initia testnet via a throwaway consumer contract. Green light before lunch → proceed; red light → evaluate commit-reveal fallback.
- **Midday (2h)** — **Interwoven Bridge EVM-origin verification.** Write a throwaway page that calls `openBridge({srcChainId: '137', dstChainId: 'interwoven-1', ...})` from a MetaMask-connected Polygon Amoy wallet. If modal opens and a test bridge of a few MATIC lands as INIT on Initia testnet within 10 min → Path 1 confirmed. If SDK errors out or modal never appears for EVM origin → test the `bridge.testnet.initia.xyz` deep-link fallback instead.
- **Afternoon (4h)** — **`DrawHub` scaffold with `MultiplierLib`.** Write `MultiplierLib.sol` with all 4 cumulative threshold arrays verbatim from Section 3. Unit test: for each config, confirm `thresholds[5] == 100_000_000`. Write `DrawHub.sol` state machine: `createDraw`, `depositLocal`, `recordQualifiers`, `requestRandomness`, `onRandomness`. Local Hardhat test using `MockBandVRF`: full lifecycle end-to-end with 3 fake participants and 2 qualifiers.
- **Evening (2h)** — Integrate `DrawHub` with deployed `AccessRegistry` / `WeezEscrow` / `FeeRouter` on Initia testnet. Run live testnet draw with 3 pre-funded wallets.

### Wednesday 2026-04-23 — Backend + bridge flow

- **Morning (4h)** — Backend: `drawResolver.ts` (computes qualifier list from existing Stack scores, calls `recordQualifiers`), `drawLifecycleBot.ts` (auto-triggers `requestRandomness` after deadline), `routes/draws.ts` (REST). End-to-end: backend drives a full draw from creation through settlement.
- **Afternoon (4h)** — Miniapp: `ChainOriginDetect`, `BridgePrompt`, `useBridgeStatus`, `DrawDeposit`. Test Path 1 (Initia native) and Path 2 (bridge-then-deposit from Polygon Amoy).
- **Evening (4h)** — Miniapp: `DrawStatus` polling, Stack-game integration feeding scores to the backend. Full happy-path draw with 3 browsers + 3 wallets + real bridge.

### Thursday 2026-04-24 — Settlement UX + hardening

- **Morning (4h)** — `PostSettlement.tsx` winner UX + reverse-bridge prompt. Test the reverse bridge (or deep-link fallback) at least twice.
- **Afternoon (4h)** — Failure-mode exercises: zero qualifiers → cancel refunds cleanly; VRF stuck → `adminResetVrf` works; winner ignores reverse bridge → funds remain safely in Initia wallet; deadline elapses with only 2 of 3 deposits → cancel refunds the 2.
- **Evening (4h)** — Multiplier reveal animation. Fix first round of bugs.

### Friday 2026-04-25 — Demo prep

- **Morning (4h)** — End-to-end rehearsal with clean state. Run the demo flow 3 times top-to-bottom.
- **Afternoon (4h)** — Record demo video. Script: open miniapp in 3 browsers, each on a different wallet origin (Polygon / BNB / Initia). Players A and B bridge in via `openBridge` modal. All 3 deposit. Play Stack game. Backend filters to 2 qualifiers. Trigger VRF. Winner revealed with multiplier. Winner bridges back to Polygon. Record twice — once boring (x8), once exciting (x20+).
- **Evening (4h)** — DoraHacks submission, GitHub README with architecture diagram, deployed contract addresses JSON, link to demo video. Buffer for last-minute fixes.

### Saturday 2026-04-26 (deadline 00:00 UTC)

- Submit by 20:00 UTC local latest. Do not push code changes in the final 4 hours.

---

## Critical Files for Implementation

- [packages/contracts/contracts/core/DrawHub.sol](packages/contracts/contracts/core/DrawHub.sol)
- [packages/contracts/contracts/libraries/MultiplierLib.sol](packages/contracts/contracts/libraries/MultiplierLib.sol)
- [packages/contracts/contracts/core/RandomnessAdapter.sol](packages/contracts/contracts/core/RandomnessAdapter.sol)
- [packages/backend/src/services/drawResolver.ts](packages/backend/src/services/drawResolver.ts)
- [packages/miniapp/src/components/BridgePrompt.tsx](packages/miniapp/src/components/BridgePrompt.tsx)
