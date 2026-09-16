## 2026-09-16T12:49:15Z
You are Worker Stream 1 (Core Math, Adaptive Crash Engine & Streak Milestones).
Your working directory is: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_o10_stream1
Please maintain your progress in progress.md inside your directory.

MANDATORY FIRST STEP: Read the user request at:
c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md under timestamp ## 2026-09-16T12:42:13Z.
Read the Stream 1 Explorer handoff report at:
c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_o10_stream1\handoff.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Exclusive File Ownership:
- `packages/game-core/src/crypto-crash.ts`
- `packages/game-core/src/missions.ts`
- `packages/game-core/src/crypto-crash.test.ts`
- `packages/game-core/src/missions.test.ts`
- `apps/api/src/arcade/store.ts`
- `apps/api/src/arcade/routes.ts` (if needed)
- `apps/api/src/arcade/arcade.test.ts` (if needed)
(DO NOT TOUCH ANY FILE IN `apps/web/` - that belongs exclusively to Worker Stream 2).

Tasks:
1. Implement free-range stake validation ($10 \le \text{stake} \le \text{userBalance}$) in `packages/game-core/src/crypto-crash.ts` (`validateCrashStake`) and integrate it into `apps/api/src/arcade/store.ts`.
2. Implement the adaptive crash engine in `packages/game-core/src/crypto-crash.ts` and `apps/api/src/arcade/store.ts`:
   - Calculate risk severity $k_{\text{risk}} \in [0, 1]$ based on player recent stake ratio ($\lambda = \text{currentStake} / \bar{S}$) and consecutive wins $W$.
   - When player bets normal/modest amounts, preserve high win engagement (baseline Pareto distribution, $P(M < 1.50) \approx 35.35\%$).
   - When player spikes stake (e.g. $>2.5\times$ average or after consecutive wins), shift crash probability toward early dump ($1.01\times - 1.48\times$) scaling $P(M < 1.50)$ up to 75%-80% to protect house edge.
   - Maintain provable fairness (deterministic based on HMAC-SHA256 and context).
   - Ensure backward compatibility: context is optional so that calls without context use the standard Pareto distribution.
   - In `apps/api/src/arcade/store.ts`, maintain player's `crashAdaptive` history (recent 10 stakes rolling window, consecutive wins).
3. Implement extended streak milestones in `packages/game-core/src/missions.ts`:
   - Milestones:
     - 7 Days: 1.0x SRU + 500 Cash
     - 30 Days (1 Ay): 2.5x SRU + 5,000 Cash
     - 90 Days (3 Ay): 5.0x SRU + 25,000 Cash
     - 180 Days (6 Ay): 10.0x SRU + 100,000 Cash
     - 365 Days (1 Yıl): 25.0x SRU + 500,000 Cash + "imperial_veteran" Badge
   - In `evaluateStreak`, allow streaks to continue incrementally past Day 7 (replace modulo reset with continuous increment `currentStreak + 1`), only resetting if a day is missed.
   - Export `STREAK_MILESTONES`, `ExtendedStreakReward`, `calculateExtendedStreakReward`.
4. Tests:
   - In `packages/game-core/src/missions.test.ts`, update the streak test to reflect continuous increment and test all milestones (7, 30, 90, 180, 365 days).
   - In `packages/game-core/src/crypto-crash.test.ts`, add unit tests for `validateCrashStake` and Monte Carlo fuzzing tests for `generateAdaptiveCrashMultiplier` proving normal bets vs. spike bets distribution shift.
   - Run tests using `pnpm --filter @empire/game-core test` and `pnpm --filter @empire/api exec vitest run src/arcade`.
5. Document all code changes and test execution output in `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_o10_stream1\handoff.md`.
6. Send a message to parent when done.
