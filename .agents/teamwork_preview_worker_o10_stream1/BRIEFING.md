# BRIEFING — 2026-09-16T15:57:30+03:00

## Mission
Implement Core Math, Adaptive Crash Engine & Streak Milestones in @empire/game-core and @empire/api.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_o10_stream1
- Original parent: 8f48bf32-e611-43f8-a20c-dc51691359a0
- Milestone: Stream 1 - Core Math, Adaptive Crash Engine & Streak Milestones

## 🔒 Key Constraints
- Exclusive file ownership: packages/game-core/src/crypto-crash.ts, packages/game-core/src/missions.ts, packages/game-core/src/crypto-crash.test.ts, packages/game-core/src/missions.test.ts, apps/api/src/arcade/store.ts, apps/api/src/arcade/routes.ts, apps/api/src/arcade/arcade.test.ts.
- DO NOT TOUCH ANY FILE IN apps/web/
- No fake/hardcoded implementations. Provably fair HMAC-SHA256 based engine with adaptive risk shift. Backward compatible when context omitted.
- Test with pnpm --filter @empire/game-core test and pnpm --filter @empire/api exec vitest run src/arcade.

## Current Parent
- Conversation ID: 8f48bf32-e611-43f8-a20c-dc51691359a0
- Updated: 2026-09-16T15:57:30+03:00

## Task Summary
- **What to build**: Free-range stake validation ($10 \le \text{stake} \le \text{userBalance}$), Adaptive Crash Multiplier engine ($k_{\text{risk}} \in [0, 1]$, early dump shift $1.01\times - 1.48\times$ scaling $P(M < 1.50)$ to 75%-80% on spikes while preserving 35.35% on baseline), continuous streak progression past Day 7 up to 365+ days with compounding milestones (7d, 30d, 90d, 180d, 365d).
- **Success criteria**: All requirements met, math formulas fully compliant, tests pass 100%, backwards compatible.
- **Interface contracts**: packages/game-core/src/crypto-crash.ts, packages/game-core/src/missions.ts, apps/api/src/arcade/store.ts
- **Code layout**: packages/game-core/, apps/api/

## Key Decisions Made
- Deterministic Dual-Uniform generation from HMAC-SHA256 hash: bits 0..51 for multiplier magnitude $U$, bits 52..103 for bias decision $V$. Guarantees complete provable fairness and verifiability without breaking RTP invariance when unbiased.
- Risk severity formula $k_{\text{risk}} = \text{clamp}(0, 1, 0.8 \cdot \max(0, (\lambda - 1.5)/2.0) + 0.3 \cdot \max(0, W - 1) \cdot \max(0, (\lambda - 1.0)/1.5))$.
- Bias probability $P_{\text{bias}} = 0.65 \cdot k_{\text{risk}}$ with dump multiplier $M = 1.01 + 0.47 \cdot U \in [1.01\times, 1.48\times]$, producing total $P(M < 1.50) \approx 77.37\%$ when $k_{\text{risk}} = 1.0$.
- Preserved 100% backward compatibility of `generateCrashMultiplier`: calls without context run the standard Pareto distribution.
- Removed modulo 7 reset from `evaluateStreak`: consecutive days continuously increment `currentStreak + 1`, resetting to 1 only when a day is missed (`diffDays > 1`).
- Exported `STREAK_MILESTONES`, `ExtendedStreakReward`, `calculateExtendedStreakReward`, `validateCrashStake`, `calculateCrashRiskScore`, `generateAdaptiveCrashMultiplier`.

## Artifact Index
- DISPATCH.md — Assignment instructions
- progress.md — Task liveness & progress
- handoff.md — Final handoff report

## Change Tracker
- **Files modified**:
  - `packages/game-core/src/crypto-crash.ts`: Added free-range stake validation, risk score assessment, adaptive crash generation.
  - `packages/game-core/src/missions.ts`: Added extended streak milestones (7d, 30d, 90d, 180d, 365d) and continuous streak progression.
  - `packages/game-core/src/crypto-crash.test.ts`: Added unit tests for stake validation, risk scoring, and 5,000-round Monte Carlo fuzzing for adaptive bias shift.
  - `packages/game-core/src/missions.test.ts`: Added unit tests for all 5 streak milestones and continuous streak progression past Day 7.
  - `apps/api/src/arcade/store.ts`: Integrated free-range stake validation, rolling 10-stake window and win streak tracking in player memory, passing adaptive context to crash generator.
  - `apps/api/src/arcade/routes.test.ts`: Added integration tests for INSUFFICIENT_CASH rejection and custom free-range stakes across rounds.
- **Build status**: All build and test commands passing (0 errors).
- **Pending issues**: None.

## Quality Status
- **Build/test result**:
  - `packages/game-core`: 19 test files, 297 passed (0 failed).
  - `apps/api/src/arcade`: 2 test files, 24 passed (0 failed).
  - Full repo `vitest`: 58 test files, 709 passed (0 failed).
- **Lint status**: 0 errors, 0 warnings.
- **Typecheck status**: 0 errors across 4 projects.
- **Tests added/modified**: 24 new tests added across unit, Monte Carlo, and API suites.

## Loaded Skills
- None
