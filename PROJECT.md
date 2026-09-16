# Project: Project Empire Arcade Suite Overhaul

## Architecture
Two strictly isolated streams respecting the user's CRITICAL constraint of Maximum 2 Concurrent Agents:

1. **Stream 1 - Core Math Models, Simulation & Economy Engine**:
   - Scope: `packages/game-core/src/`, `packages/shared/src/`, `apps/api/src/`
   - Responsibilities:
     - `minigames-config.ts`: Configuration constants for Notcoin Tap, Catizen Merge, Candlestick Crash, Dynasty Cipher, and Stars SKUs.
     - `notcoin-tap.ts`: Energy regeneration dynamics, tap power scaling (`base * 1.5^lvl`), critical hits (5% chance, 5x multiplier), cash upgrade curves, offline TapBot accumulator with energy conservation bound, Telegram Stars SKU bindings.
     - `catizen-merge.ts`: 12-tier collectible progression with super-linear passive generation ($R_{k+1} > 2 R_k$), mystery parcel drops (75% T1, 20% T2, 5% T3), and $O(N)$ auto-merge macro solver with guaranteed finite termination.
     - `crypto-crash.ts`: Provably fair HMAC-SHA256 Pareto distribution with 3% house edge, guaranteed 97.00% RTP invariant (zero hyperinflation proof), continuous exponential trajectory $M(t)=\exp(0.06t)$, discrete candlestick tick generator, risk/reward payout calculation.
     - `dynasty-cipher.ts`: Sequence scaling $L(r) = 3 + \lfloor(r-1)/2\rfloor$ up to 12, combo multipliers ($1.0\times$ to $3.0\times$), time-attack pressure, and round rewards.
     - Shared DTOs and Zod validation schemas in `packages/shared/src/index.ts`.
     - Arcade store & HTTP routes in `apps/api/src/arcade/`.
     - Unit & invariant tests in `packages/game-core/src/`.

2. **Stream 2 - Rich Interactive Frontend Mini-Games & Mini App UI**:
   - Scope: `apps/web/src/components/`, `apps/web/src/screens/`, `apps/web/src/game/`
   - Responsibilities:
     - `CatizenMergeGame`: 4x3 (12 slots) living grid, 10+ collectible emblems, drag/drop & click merge, particle burst feedback, mystery parcel drops (15-20s), idle DPS coin tickers, auto-bot toggle.
     - `DynastyCipherGame`: Cyberpunk terminal styling, scanline overlay, audio/visual decrypt pulse, combo multipliers, time-attack countdown, firewall progress bar.
     - `NotcoinTapGame`: 3D tactile squish coin with perspective tilt, multi-touch listener, floating trajectory numbers (+1, +5 CRIT!), animated energy bar, dual-currency upgrade drawer (Cash & Telegram Stars), TapBot offline modal.
     - `CryptoCrashGame`: Real-time 60fps candlestick canvas chart, rising multiplier, stake selector, Boğa / Kârı Al button, win/crash animations, round history strip.
     - `arcade-audio.ts`: Web Audio API zero-asset procedural sound synthesizer.
     - `arcade-haptics.ts`: Telegram WebApp HapticFeedback abstraction.
     - `arcade.css`: Astra 6.0 theming, zero layout shift, mobile 320px–390px zero overflow.
     - Standalone `ArcadeScreen` and embedded `EmpireArcade` widget in `EmpireScreen`.

## Feature Inventory
Every feature from the Survey phase is mapped to its assigned milestone:
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Notcoin Tap Core Math | Energy dynamics, tap scaling ($1.5^{\text{lvl}-1}$), crit hits, offline TapBot accumulator, Stars SKUs | M1 | Survey Stream 1 |
| 2 | Catizen Merge Core Math | 12-tier emblem scaling, passive rates ($2.5^{k-1}$), parcel probabilities, $O(N)$ auto-merge solver | M1 | Survey Stream 1 |
| 3 | Candlestick Crash Math | Provably fair HMAC-SHA256 Pareto distribution, 97% RTP invariant, candlestick generator, settlement | M1 | Survey Stream 1 |
| 4 | Dynasty Cipher Core Math | Dynamic sequence length $L(r)$, combo multipliers ($1.0\times-3.0\times$), reward formula | M1 | Survey Stream 1 |
| 5 | Shared DTOs & Schemas | Zod validation schemas and DTO types for all 4 arcade games in packages/shared | M1 | Survey Stream 1 |
| 6 | API Arcade Store & Routes | REST endpoints for arcade game actions and balance settlements in apps/api/src/arcade/ | M1 | Survey Stream 1 |
| 7 | Core Math Invariant Tests | Unit & stress test suites in packages/game-core proving energy conservation, RTP, solver termination | M1 | Survey Stream 1 |
| 8 | Web Audio & Haptics Engine | Procedural sound synthesizer (AudioContext) & Telegram HapticFeedback abstraction | M2 | Survey Stream 2 |
| 9 | Catizen Merge Component | 4x3 living board, drag/drop & click merge, particle burst, mystery parcel drops, auto-bot toggle | M2 | Survey Stream 2 |
| 10 | Dynasty Cipher Component | Cyberpunk terminal, scanlines, decrypt pulse, combo multipliers, firewall breach progress | M2 | Survey Stream 2 |
| 11 | Notcoin Tap Component | 3D tactile squish coin, floating digits, animated energy bar, dual-currency upgrade drawer | M2 | Survey Stream 2 |
| 12 | Candlestick Crash Component | 60fps canvas chart, rising multiplier, stake selector, Boğa / Kârı Al button, win/crash animations | M2 | Survey Stream 2 |
| 13 | Arcade CSS & Responsiveness | Astra 6.0 styling, 320px–390px mobile viewport zero overflow, reduced motion support | M2 | Survey Stream 2 |
| 14 | Arcade Hub & Screen Integration | Standalone ArcadeScreen, EmpireArcade widget update, design preview support | M2 | Survey Stream 2 |
| 15 | Monorepo Quality Gate | `pnpm check` (lint, format:check, typecheck, test, build) passes with 0 errors | M3 | Acceptance Criteria |
| 16 | Adversarial Challenge & Audit | Challenger tests & Forensic Auditor verification with strict binary veto | M3 | Acceptance Criteria |
| 17 | Handoff & Documentation | Update HANDOFF.md with mechanics, mathematical formulas, and test evidence | M4 | Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Stream 1: Core Math Models & Economy Engine | packages/game-core/src/, packages/shared/src/, apps/api/src/arcade/ | none | IN_PROGRESS |
| M2 | Stream 2: Rich Interactive Frontend Mini-Games UI | apps/web/src/components/, apps/web/src/screens/, apps/web/src/game/ | none | IN_PROGRESS |
| M3 | Quality Gate, Adversarial & Forensic Verification | Full monorepo check, Reviewers, Challengers, Auditor | M1, M2 | PLANNED |
| M4 | Final Handoff & Reporting | HANDOFF.md and completion report | M3 | PLANNED |

## Interface Contracts

### Notcoin Tap Contract
- `POST /arcade/tap/click`:
  - Request: `{ tapCount: number, requestId: string }`
  - Response: `{ apiVersion: 'v1', tapsExecuted: number, coinsEarned: number, newCash: number, remainingEnergy: number, criticalHitsCount: number, energyRechargeRate: number }`
- `POST /arcade/tap/upgrade`:
  - Request: `{ upgradeType: 'multitap' | 'capacity' | 'recharge_speed' | 'unlock_bot', currency: 'cash' | 'stars', requestId: string }`
  - Response: `{ apiVersion: 'v1', upgradeType: string, newLevel: number, cashCost: number, newCash: number }`
- `POST /arcade/tap/claim-bot`:
  - Request: `{ requestId: string }`
  - Response: `{ apiVersion: 'v1', claimedCash: number, newCash: number, offlineSecondsElapsed: number, botTapsCount: number }`

### Catizen Merge Contract
- `POST /arcade/merge/action`:
  - Request: `{ sourceIndex: number, targetIndex: number, actionType: 'move' | 'merge' | 'unbox_parcel', requestId: string }`
  - Response: `{ apiVersion: 'v1', grid: number[], rewardCash: number, newCash: number, unlockedTier?: number }`
- `POST /arcade/merge/auto`:
  - Request: `{ autoUnbox: boolean, requestId: string }`
  - Response: `{ apiVersion: 'v1', grid: number[], totalMergesExecuted: number, parcelsOpened: number, totalRewardCash: number, newCash: number, newPassiveRatePerSecond: number }`

### Crypto Candlestick Crash Contract
- `POST /arcade/crash/start`:
  - Request: `{ stake: number, clientSeed?: string, requestId: string }`
  - Response: `{ apiVersion: 'v1', roundId: string, stake: number, serverSeedHash: string, startTime: string }`
- `POST /arcade/crash/cashout`:
  - Request: `{ roundId: string, claimMultiplier: number, requestId: string }`
  - Response: `{ apiVersion: 'v1', roundId: string, status: 'won' | 'crashed', crashMultiplier: number, cashoutMultiplier: number, payoutCash: number, netProfit: number, newCash: number, serverSeed: string }`

### Dynasty Cipher Contract
- `POST /arcade/cipher/submit`:
  - Request: `{ round: number, combo: number, completedSuccessfully: boolean, requestId: string }`
  - Response: `{ apiVersion: 'v1', round: number, combo: number, rewardCash: number, newCash: number }`

## Code Layout
- Exclusive File Boundaries for Workers:
  - **Worker Stream 1 Owns Exclusively**:
    - `packages/game-core/src/minigames-config.ts`
    - `packages/game-core/src/notcoin-tap.ts`
    - `packages/game-core/src/catizen-merge.ts`
    - `packages/game-core/src/crypto-crash.ts`
    - `packages/game-core/src/dynasty-cipher.ts`
    - `packages/game-core/src/index.ts`
    - `packages/game-core/src/*.test.ts` (new minigame test files)
    - `packages/shared/src/index.ts` (arcade DTO additions)
    - `apps/api/src/arcade/store.ts`
    - `apps/api/src/arcade/routes.ts`
    - `apps/api/src/arcade/routes.test.ts`
    - `apps/api/src/index.ts` (wiring arcade routes)
  - **Worker Stream 2 Owns Exclusively**:
    - `apps/web/src/components/catizen-merge-game.tsx`
    - `apps/web/src/components/dynasty-cipher-game.tsx`
    - `apps/web/src/components/notcoin-tap-game.tsx`
    - `apps/web/src/components/crypto-crash-game.tsx`
    - `apps/web/src/components/arcade.css`
    - `apps/web/src/components/micro-games.tsx` (re-export adapter)
    - `apps/web/src/components/empire-arcade.tsx`
    - `apps/web/src/screens/arcade-screen.tsx`
    - `apps/web/src/screens/arcade-screen.test.tsx`
    - `apps/web/src/game/arcade-audio.ts`
    - `apps/web/src/game/arcade-haptics.ts`
    - `apps/web/src/game/catizen-merge-model.ts`
    - `apps/web/src/game/catizen-merge-model.test.ts`
    - `apps/web/src/game/notcoin-tap-model.ts`
    - `apps/web/src/game/notcoin-tap-model.test.ts`
    - `apps/web/src/game/crypto-crash-model.ts`
    - `apps/web/src/game/crypto-crash-model.test.ts`
    - `apps/web/src/preview/design-preview.tsx`
- **Zero File Overlap**: Worker 1 and Worker 2 have completely disjoint write boundaries. Neither worker will ever touch a file owned by the other.
