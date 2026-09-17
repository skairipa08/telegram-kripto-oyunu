## 2026-09-17T10:58:47Z
You are Worker Stream 1 (teamwork_preview_worker).

## Identity & Paths
- Your working directory: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_o12_stream1`
- Parent Orchestrator ID: `4fb5c810-ec2d-4451-a45c-639a7bf5c7c7`
- Project Workspace Root: `c:\Users\Administrator\Desktop\telegram kripto oyunu`
- Path to User Request: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md` (see timestamp section `## 2026-09-17T10:50:36Z`)
- Path to Project Architecture: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_orchestrator_12\PROJECT.md`
- Path to Stream 1 Explorer Handoff: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_o12_stream1\handoff.md`

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Exclusive File Ownership (Write Boundary)
You exclusively own and may modify or create ONLY these files:
- `apps/web/src/game/crypto-mines-model.test.ts` (create new)
- `apps/web/src/game/crypto-predictions-model.ts` (export calculation helpers, keep backwards compatible)
- `apps/web/src/game/crypto-predictions-model.test.ts` (create new)
- `packages/game-core/src/referral.test.ts` (add tests for commission tiers)
DO NOT TOUCH ANY OTHER FILES.

## Required Tasks:
1. **Crypto Mines Unit Tests (`apps/web/src/game/crypto-mines-model.test.ts`)**:
   - Test `calculateMinesMultiplier`:
     - Verify formula $(1 - \text{edge}) \times \prod_{i=0}^{k-1} \frac{25 - i}{25 - m - i}$ with 3% house edge.
     - Test Representative points: 3 mines (1 gem -> 1.10x, 2 gems -> 1.26x), 5 mines (1 gem -> 1.21x), 10 mines (1 gem -> 1.62x), 20 mines (1 gem -> 4.85x, 5 gems -> 51536.1x).
     - Test boundary and clamp conditions: $k \le 0$ returns 1.0, $k > 25 - m$ returns 1.0, minimum multiplier is 1.01.
   - Test `generateMineLocations`:
     - Fisher-Yates generates non-repeating indices strictly within $[0..24]$.
     - Respects `excludeIndex` (guarantees `excludeIndex` is not in returned mine locations).
     - Generates exact number of mines requested for mine counts 1 to 24 (and standard options 1, 3, 5, 10, 15, 20).
   - Test `startMinesGame`, `clickMinesTile`, `cashoutMinesGame`:
     - Initial game state has status `'in_progress'`, `revealedIndices: []`, multiplier 1.0.
     - Clicking a safe tile transitions tile, increments revealed count, updates `currentMultiplier` and `potentialPayout`.
     - Clicking a mine tile transitions to `status: 'busted'`, `payoutCash: 0`, and reveals all mines.
     - Cashing out transitions to `status: 'cashed_out'`, awards `payoutCash = Math.floor(stake * mult)` and `netProfit = payoutCash - stake`.
     - Revealing all safe tiles automatically cashes out.
2. **Crypto Predictions Pure Helpers & Unit Tests (`apps/web/src/game/crypto-predictions-model.ts` & `apps/web/src/game/crypto-predictions-model.test.ts`)**:
   - In `apps/web/src/game/crypto-predictions-model.ts`, export pure functions:
     - `calculatePredictionPayout(stake: number, odds: number): number` (`Math.floor(stake * odds)`)
     - `validatePredictionStake(stake: number, userBalance: number): { valid: boolean; error?: string }` (min stake 50, positive integer, <= userBalance)
     - `calculatePredictionOdds(market: PredictionMarket, choice: 'yes' | 'no'): number`
     - `createPredictionBetTicket(params: { marketId: string; choice: 'yes' | 'no'; stake: number; odds: number }): PredictionBetTicket`
     - `resolvePredictionBetTicket(ticket: PredictionBetTicket, outcome: 'yes' | 'no'): { won: boolean; payoutCash: number; netProfit: number }`
   - In `apps/web/src/game/crypto-predictions-model.test.ts`:
     - Unit test all these functions thoroughly (YES/NO odds, payout calculation, minimum stake, balance sufficiency, win/loss resolution, edge cases).
3. **Turnover & Referral Commission Tiers Unit Tests (`packages/game-core/src/referral.test.ts`)**:
   - Add unit tests for `getReferralCommissionRate(inviteCount)`:
     - 0-10 invites -> 0.03 (3%)
     - 11-30 invites -> 0.05 (5%)
     - 31+ invites -> 0.07 (7%)
     - Boundary tests at 0, 1, 10, 11, 29, 30, 31, 100.
   - Add unit tests for `calculatePassiveCommission(inviteeEarnedCash, inviteCount)`:
     - $1,000,000 \times 0.03 = 30,000$ cash
     - $1,000,000 \times 0.05 = 50,000$ cash
     - $1,000,000 \times 0.07 = 70,000$ cash
     - Also verify direct 0.1% kickback ($1,000,000 \to 1,000$ cash).
4. **Verification**:
   - Run: `pnpm vitest run apps/web/src/game/crypto-mines-model.test.ts`
   - Run: `pnpm vitest run apps/web/src/game/crypto-predictions-model.test.ts`
   - Run: `pnpm vitest run packages/game-core/src/referral.test.ts`
   - Ensure 100% tests pass!
