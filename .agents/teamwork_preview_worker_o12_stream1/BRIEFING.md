# BRIEFING — 2026-09-17T14:02:30+03:00

## Mission
Implement pure calculation helpers and comprehensive unit tests for Crypto Mines, Crypto Predictions, and Referral Commission Tiers.

## 🔒 My Identity
- Archetype: teamwork_preview_worker
- Roles: implementer, qa, specialist
- Working directory: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_o12_stream1
- Original parent: 4fb5c810-ec2d-4451-a45c-639a7bf5c7c7
- Milestone: milestone_o12_stream1

## 🔒 Key Constraints
- Exclusively own and modify/create ONLY:
  - apps/web/src/game/crypto-mines-model.test.ts (create new)
  - apps/web/src/game/crypto-predictions-model.ts (export calculation helpers, keep backwards compatible)
  - apps/web/src/game/crypto-predictions-model.test.ts (create new)
  - packages/game-core/src/referral.test.ts (add tests for commission tiers)
- DO NOT TOUCH ANY OTHER FILES.
- DO NOT CHEAT. All implementations genuine. No hardcoding or dummy facades.

## Current Parent
- Conversation ID: 4fb5c810-ec2d-4451-a45c-639a7bf5c7c7
- Updated: 2026-09-17T14:02:30+03:00

## Task Summary
- **What to build**:
  1. Crypto Mines math and engine unit test suite (24 tests)
  2. Crypto Predictions pure calculation helpers and unit test suite (18 tests)
  3. Referral tiered commission rate and passive earning tests (9 new tests, 26 total)
- **Success criteria**: 100% test pass rate via `vitest run`, full typecheck pass, zero lint violations, code style formatted.
- **Interface contracts**: PROJECT.md & Explorer handoff.
- **Code layout**: apps/web and packages/game-core.

## Key Decisions Made
- Preserved 100% backwards compatibility in `crypto-predictions-model.ts` while exporting `calculatePredictionPayout`, `validatePredictionStake`, `calculatePredictionOdds`, `createPredictionBetTicket`, and `resolvePredictionBetTicket`.
- Created thorough combinatorial and boundary tests for Mines multiplier formula (with 3% house edge), Fisher-Yates generator safety, bust behavior, and auto-cashout on board clear.
- Added comprehensive boundary coverage for referral commission tiers (3%, 5%, 7%) at exact thresholds (0, 1, 10, 11, 29, 30, 31, 100) and verified contrast with direct 0.1% kickback.

## Artifact Index
- `apps/web/src/game/crypto-mines-model.test.ts` — Comprehensive unit test suite for Crypto Mines math, shuffle, game transitions, cashout
- `apps/web/src/game/crypto-predictions-model.ts` — Pure helpers for stake validation, odds retrieval, ticket creation & settlement
- `apps/web/src/game/crypto-predictions-model.test.ts` — Comprehensive unit test suite for Predictions calculations and market bookmaker margins
- `packages/game-core/src/referral.test.ts` — Extended test suite verifying tiered referral commissions (3%, 5%, 7%) and kickback

## Change Tracker
- **Files modified**:
  - `apps/web/src/game/crypto-predictions-model.ts` (added exported pure helpers and MIN_PREDICTION_STAKE constant)
  - `packages/game-core/src/referral.test.ts` (added tiered referral commission and passive earnings test suite)
  - `apps/web/src/game/crypto-mines-model.test.ts` (created unit test suite with 24 tests)
  - `apps/web/src/game/crypto-predictions-model.test.ts` (created unit test suite with 18 tests)
- **Build status**: PASS (`pnpm typecheck` passed cleanly across all 4 projects)
- **Pending issues**: None

## Quality Status
- **Build/test result**: 68/68 tests passed (100% pass rate)
- **Lint status**: 0 errors (`eslint` and `prettier` both passed)
- **Tests added/modified**: 51 new unit tests (24 mines, 18 predictions, 9 referral tiers)

## Loaded Skills
- None
