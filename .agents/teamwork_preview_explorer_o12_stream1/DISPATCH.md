## 2026-09-17T10:52:49Z
You are Explorer Stream 1 (teamwork_preview_explorer).

## Identity & Paths
- Your working directory: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_o12_stream1`
- Parent Orchestrator ID: `4fb5c810-ec2d-4451-a45c-639a7bf5c7c7`
- Project Workspace Root: `c:\Users\Administrator\Desktop\telegram kripto oyunu`
- Path to User Request: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md` (see timestamp section `## 2026-09-17T10:50:36Z`)
- Path to Project Architecture: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_orchestrator_12\PROJECT.md`

## Mission & Scope: Stream 1 (Core Math & Game Engine Unit Tests)
Analyze the codebase to determine the current state of core math implementations and their test suites for:
1. **Mines (Crypto Mines)**:
   - Check `apps/web/src/game/crypto-mines-model.ts` (and any related files in `packages/game-core`).
   - Multiplier formula: (1 - edge) * \prod (25 - i)/(25 - m - i).
   - 1-20 mine limits, house edge rules, valid cashout and bust scenarios.
   - Fisher-Yates non-repeating 25-grid generation, first-move fair multiplier/safe rules.
   - Check if unit tests exist (e.g. `crypto-mines-model.test.ts`), whether they run and pass, or what tests are missing.
2. **Predictions (Crypto Predictions)**:
   - Check `apps/web/src/game/crypto-predictions-model.ts` (and any game-core equivalents).
   - YES/NO odd calculations, coupon payout multipliers, stake deduction, settlement & profit claim limit tests.
   - Current test coverage and gaps.
3. **Crash & Adaptive House Algorithm**:
   - Check `packages/game-core/src/crypto-crash.ts` and `apps/web/src/game/crypto-crash-model.ts`.
   - Low vs high stake dynamic risk multiplier, sudden bet spike penalties, crash point verification.
   - Existing crash tests in `packages/game-core/src/crypto-crash.test.ts` or web tests.
4. **Turnover (0.1% / Binde 1) & Tiered Referral Commission**:
   - 1M turnover -> 1,000 cash, plus 3%, 5%, 7% commission tiers.
   - Check where this math is located in `packages/game-core` or `apps/api/src/referrals/` or `packages/shared/`.
5. **Daily Streak Progression Bonuses**:
   - Bonus thresholds (7d, 30d, 90d, 180d, 365d) math and reward formulas.
   - Where is it defined and tested?

## Constraints
- READ-ONLY exploration. DO NOT edit or modify source code files.
- Document all findings in `handoff.md` and `progress.md` in your working directory.
- Test commands can be run in read-only mode to assess current status (e.g. `pnpm vitest run crypto-mines` or similar).
- Send message to parent orchestrator with high-level summary and link to `handoff.md` when done.
