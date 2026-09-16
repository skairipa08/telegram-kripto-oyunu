# BRIEFING — 2026-09-16T11:26:00Z

## Mission
Implement Stream 1: Core Math Models, Simulation & Economy Engine for the Project Empire arcade suite (Notcoin Tap, Catizen Merge, Candlestick Crash, Dynasty Cipher, Shared DTOs, Arcade API Store & Routes, and Invariant Tests).

## 🔒 My Identity
- Archetype: teamwork_preview_worker_stream1
- Roles: implementer, qa, specialist
- Working directory: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_stream1
- Original parent: 2e32ba88-38e2-412d-876d-ed44df3fb85e
- Milestone: M1 (Core Math Models & Economy Engine)

## 🔒 Key Constraints
- EXCLUSIVE FILE OWNERSHIP:
  - packages/game-core/src/minigames-config.ts
  - packages/game-core/src/notcoin-tap.ts
  - packages/game-core/src/catizen-merge.ts
  - packages/game-core/src/crypto-crash.ts
  - packages/game-core/src/dynasty-cipher.ts
  - packages/game-core/src/index.ts
  - packages/game-core/src/notcoin-tap.test.ts
  - packages/game-core/src/catizen-merge.test.ts
  - packages/game-core/src/crypto-crash.test.ts
  - packages/game-core/src/dynasty-cipher.test.ts
  - packages/game-core/src/minigames-simulation-stress.test.ts
  - packages/shared/src/index.ts
  - apps/api/src/arcade/store.ts
  - apps/api/src/arcade/routes.ts
  - apps/api/src/arcade/routes.test.ts
  - apps/api/src/index.ts
- MANDATORY INTEGRITY:
  - No cheating, no hardcoded test results, no dummy facade implementations.
  - Every math model must maintain real state and produce real behavior.
  - 100% green tests across game-core, shared, and api.

## Current Parent
- Conversation ID: 2e32ba88-38e2-412d-876d-ed44df3fb85e
- Updated: not yet

## Task Summary
- **What to build**: Pure math models and simulation engines in `packages/game-core`, Shared DTOs in `packages/shared`, Store & REST routes in `apps/api/src/arcade/`, and unit/invariant test suites.
- **Success criteria**: Energy conservation invariant, 97% RTP crash invariant, O(N) merge termination invariant, 100% green tests.
- **Interface contracts**: PROJECT.md & survey handoff.md.
- **Code layout**: packages/game-core/src/, packages/shared/src/, apps/api/src/.

## Key Decisions Made
- Follow the exact formulas and constants established in Survey & Formula Blueprint:
  - Notcoin: base energy 1000, step 500, recharge 1/s, step 1/s, tap power base 1 * 1.5^(lvl-1), crit 5% @ 5x, bot cadence 0.333 tap/s, efficiency 0.70.
  - Catizen: 12 tiers with R_k = round(1 * 2.5^(k-1)), merge reward W_k = round(10 * 2.2^(k-1)), parcel drops (75% T1, 20% T2, 5% T3), O(N) auto-merge solver.
  - Crypto Crash: HMAC-SHA256 Pareto distribution with 3% house edge, 1.00x crash if h % 33 === 0, multiplier curve M(t) = exp(0.06t), candlestick tick generator.
  - Dynasty Cipher: sequence length 3 + floor((r-1)/2) up to 12, combo mult 1.0 + 0.25*(c-1) up to 3.0x.
  - Stars SKUs: tap_bot_unlock (100 Stars), extenders (6h/50, 12h/100, 24h/200), energy refill (25 Stars). Zero Season Points multiplier.

## Artifact Index
- `.agents/teamwork_preview_worker_stream1/progress.md` — Liveness and progress tracker
- `.agents/teamwork_preview_worker_stream1/handoff.md` — Final handoff report

## Change Tracker
- **Files modified**:
  - `packages/game-core/src/minigames-config.ts`: Configuration constants for Notcoin, Catizen, Crash, Cipher, Stars SKUs.
  - `packages/game-core/src/notcoin-tap.ts`: Tap energy dynamics, scaling curves, bot accumulator with energy conservation bound.
  - `packages/game-core/src/catizen-merge.ts`: 12-tier progression, super-linear rates, mystery unboxing, O(N) auto-merge solver.
  - `packages/game-core/src/crypto-crash.ts`: Provably fair HMAC-SHA256 Pareto distribution, 97% RTP invariant, candlestick tick simulation.
  - `packages/game-core/src/dynasty-cipher.ts`: Dynamic sequence scaling, combo multiplier, daily cap mechanics.
  - `packages/game-core/src/index.ts`: Re-exported all new arcade modules.
  - `packages/game-core/src/notcoin-tap.test.ts`: Energy conservation invariant, scaling, crit distribution, offline accumulator tests.
  - `packages/game-core/src/catizen-merge.test.ts`: Super-linearity proof, 1,000-board fuzzing finite termination invariant tests.
  - `packages/game-core/src/crypto-crash.test.ts`: 50,000-round Monte Carlo 97.0% RTP +/- 0.5% proof, provably fair determinism tests.
  - `packages/game-core/src/dynasty-cipher.test.ts`: Sequence length scaling and combo capping tests.
  - `packages/game-core/src/minigames-simulation-stress.test.ts`: 10,000 iteration multi-game economic simulation proof.
  - `packages/shared/src/index.ts`: Added Zod schemas and DTO types for all 4 arcade games.
  - `apps/api/src/arcade/store.ts`: ArcadeStore interface, MemoryArcadeStore and SupabaseArcadeStore.
  - `apps/api/src/arcade/routes.ts`: REST API routes for tap, merge, crash, and cipher.
  - `apps/api/src/arcade/routes.test.ts`: Integration test suite for arcade API endpoints (14 tests).
  - `apps/api/src/index.ts`: Wired arcade store and routes under / and /api.
- **Build status**: 100% green across all packages (`pnpm -r build` passed)
- **Pending issues**: None

## Quality Status
- **Build/test result**: 53 test files passed, 622 tests passed (0 failures, 100% green).
- **Lint status**: 0 errors, 0 warnings (`eslint .` clean).
- **Format status**: All 16 owned files match Prettier code style (`prettier --check` clean).
- **Typecheck status**: 4 workspace packages typechecked clean (`tsc -p tsconfig.json` clean).
- **Tests added/modified**: +98 new tests (+84 unit/stress tests in game-core, +14 integration tests in api).

## Loaded Skills
- None
