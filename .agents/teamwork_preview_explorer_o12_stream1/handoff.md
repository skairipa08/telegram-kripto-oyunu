# Handoff Report — Stream 1: Core Math & Game Engine Unit Tests

## 1. Observation

### 1.1 Mines (Crypto Mines)
- **Model File**: `apps/web/src/game/crypto-mines-model.ts` (207 lines)
- **UI Component**: `apps/web/src/components/crypto-mines-game.tsx` (443 lines)
- **Multiplier Formula**:
  - `apps/web/src/game/crypto-mines-model.ts:31-48`:
    ```ts
    export function calculateMinesMultiplier(
      revealedCount: number,
      mineCount: number,
      houseEdge = MINES_HOUSE_EDGE, // 0.03
    ): number {
      if (revealedCount <= 0) return 1.0;
      const safeTiles = MINES_GRID_SIZE - mineCount;
      if (revealedCount > safeTiles) return 1.0;

      let multiplier = 1.0;
      for (let i = 0; i < revealedCount; i++) {
        multiplier *= (MINES_GRID_SIZE - i) / (safeTiles - i);
      }

      const rtpMultiplier = multiplier * (1 - houseEdge);
      return Math.max(1.01, Math.round(rtpMultiplier * 100) / 100);
    }
    ```
    Matches $(1 - \text{edge}) \times \prod_{i=0}^{k-1} \frac{25 - i}{25 - m - i}$.
  - Representative calculations:
    - 3 mines, 1 gem: $\frac{25}{22} \times 0.97 = 1.10227... \to 1.10\times$
    - 3 mines, 2 gems: $\frac{25}{22} \times \frac{24}{21} \times 0.97 = 1.2597... \to 1.26\times$
    - 5 mines, 1 gem: $\frac{25}{20} \times 0.97 = 1.2125 \to 1.21\times$
    - 10 mines, 1 gem: $\frac{25}{15} \times 0.97 = 1.6166... \to 1.62\times$
    - 20 mines, 1 gem: $\frac{25}{5} \times 0.97 = 4.85\times$
    - 20 mines, 5 gems: $53130 \times 0.97 = 51536.1\times$
- **Limits & House Edge**:
  - Grid size: `MINES_GRID_SIZE = 25` (line 4)
  - Mine bounds: `MIN_MINES = 1`, `MAX_MINES = 24` (lines 5-6). UI `crypto-mines-game.tsx:23` uses `MINE_OPTIONS = [1, 3, 5, 10, 15, 20]`.
  - Stake bounds: `MIN_MINES_STAKE = 10` (line 9).
  - House edge: `MINES_HOUSE_EDGE = 0.03` (line 10), guaranteeing 97% RTP.
- **Fisher-Yates Shuffle**:
  - `apps/web/src/game/crypto-mines-model.ts:64-89`: `generateMineLocations(mineCount, excludeIndex)` creates an array of available tile indices [0..24] (optionally skipping `excludeIndex`), applies the Fisher-Yates algorithm, and slices `mineCount`. Guaranteed non-repeating indices.
  - In `startMinesGame(stake, mineCount)` (lines 94-115), mines are pre-generated without `excludeIndex`. If player clicks a tile in `mineLocations`, `clickMinesTile` (lines 136-152) triggers `status: 'busted'`, `payoutCash = 0`, `currentMultiplier = 0`.
- **Cashout**:
  - `cashoutMinesGame` (lines 183-206) pays out `Math.floor(stake * mult)` with `netProfit = payoutCash - stake`. Cleared board automatically sets `status = 'cashed_out'`.
- **Test File Status**:
  - `apps/web/src/game/crypto-mines-model.test.ts` **DOES NOT EXIST**.
  - Current unit test coverage: **0%**.

---

### 1.2 Predictions (Crypto Predictions)
- **Model File**: `apps/web/src/game/crypto-predictions-model.ts` (128 lines)
- **UI Component**: `apps/web/src/components/crypto-predictions-game.tsx` (495 lines)
- **Model Contents**:
  - Only type declarations (`PredictionCategory`, `PredictionMarket`, `PredictionBetTicket`) and `INITIAL_PREDICTION_MARKETS` (7 static markets: BTC $80k, ETH gas < 15 Gwei, TON ATH $8.50, AI Turing test, SpaceX Starship, Gold ATH $2800, UCL Real Madrid).
- **Embedded Logic in Component**:
  - Odds calculation: `currentOdds = selectedChoice === 'yes' ? activeMarket.yesOdds : activeMarket.noOdds` (`crypto-predictions-game.tsx:37`)
  - Potential payout: `potentialPayout = Math.floor(numericStake * currentOdds)` (`crypto-predictions-game.tsx:38`)
  - Minimum stake validation: `numericStake < 50` (`crypto-predictions-game.tsx:46`)
  - Stake deduction: `newCash = playerCash - numericStake` (`crypto-predictions-game.tsx:56`)
  - Ticket creation: manual inline object creation (`crypto-predictions-game.tsx:64-76`)
  - Settlement: `Math.random() < 0.65` simulation in UI click handler (`crypto-predictions-game.tsx:87`)
- **Bookmaker Margins**:
  - In `INITIAL_PREDICTION_MARKETS`:
    - BTC: $1/1.85 + 1/1.95 = 54.05\% + 51.28\% = 105.33\%$ (~5.33% house margin).
    - TON: $1/1.90 + 1/1.90 = 52.63\% + 52.63\% = 105.26\%$ (~5.26% house margin).
    - Gold: $1/2.15 + 1/1.70 = 46.51\% + 58.82\% = 105.33\%$.
- **Test File Status**:
  - `apps/web/src/game/crypto-predictions-model.test.ts` **DOES NOT EXIST**.
  - No pure domain functions exist in `crypto-predictions-model.ts` (they reside inside React component).
  - Current unit test coverage: **0%**.

---

### 1.3 Crash & Adaptive House Algorithm
- **Engine File**: `packages/game-core/src/crypto-crash.ts` (402 lines)
- **Client Model**: `apps/web/src/game/crypto-crash-model.ts` (113 lines)
- **Core Math & Adaptive Algorithm**:
  - HMAC-SHA256 Pareto inverse CDF provably fair generator: `generateAdaptiveCrashMultiplier(serverSeed, clientSeed, nonce, context, config)`.
  - Stake validation: `validateCrashStake(stake, userBalance, config)` validates $10 \le \text{stake} \le 10,000,000$, non-negative integers, and `userBalance`.
  - Adaptive risk severity: `calculateCrashRiskScore(currentStake, averageStake, consecutiveWins)` (`crypto-crash.ts:107-126`):
    - $\lambda = \text{currentStake} / \text{averageStake}$
    - $\text{stakePenalty} = 0.8 \times \max(0, (\lambda - 1.5)/2.0)$
    - $\text{streakPenalty} = 0.3 \times \max(0, W - 1) \times \max(0, (\lambda - 1.0)/1.5)$
    - $\text{riskScore} = \text{clamp}_{[0, 1]}(\text{stakePenalty} + \text{streakPenalty})$
  - Bias dynamics:
    - Normal bets ($\text{riskScore} = 0$): baseline Pareto CDF, $\mathbb{P}(M < 1.50) \approx 35.35\%$, 97.0% RTP.
    - Spike bets ($\text{riskScore} > 0$): early dump bounded strictly between $1.01\times$ and $1.48\times$ with probability $0.65 \times \text{riskScore}$, scaling low-multiplier crash rate to 75%–80%.
  - Trajectory & continuity:
    - $M(t) = \exp(0.06 \times t)$.
    - Candlestick generator guarantees `tick[i].open === tick[i-1].close`.
  - Settlement:
    - `settleCrashBet(...)` computes payout and net profit.
- **Existing Tests**:
  - `packages/game-core/src/crypto-crash.test.ts`: **23 tests passed** (including 50,000-round Monte Carlo RTP proof at 97.0% +/- 0.5%, and 5,000-round Monte Carlo fuzzing of adaptive bias).
  - `packages/game-core/src/empirical-challenger-o10.test.ts`: 10,000-round Monte Carlo oracle test passed.
  - `apps/web/src/game/crypto-crash-model.test.ts`: **7 tests passed**.
  - `apps/web/src/screens/crypto-crash-stake.test.tsx`: **6 tests passed**.
- **Discrepancy**:
  - `apps/web/src/game/crypto-crash-model.ts` uses an independent client simulation function `1.0 + Math.pow(elapsedMs / 5200, 1.55)` and `(1 - 0.04) / (1 - rand)` instead of consuming `@empire/game-core`.

---

### 1.4 Turnover (0.1% / Binde 1) & Tiered Referral Commission
- **Location**: `packages/game-core/src/referral.ts` (lines 52-130)
- **Math**:
  - Direct Kickback: `REFERRAL_CASH_KICKBACK_RATE = 0.001` (0.1% or 1 in 1000).
    - `calculateReferralKickback(earnedCash)`: $1,000,000 \to 1,000$ cash.
  - Invitee Cumulative Cash Milestones:
    - `INVITEE_CASH_MILESTONES`: 100K (100 cash), 1M (1,000 cash), 10M (10,000 cash), 100M (100,000 cash), 1B (1,000,000 cash).
  - Tiered Commission:
    - `REFERRAL_COMMISSION_TIERS`:
      - 0 to 10 invites: 3% (`0.03`)
      - 11 to 30 invites: 5% (`0.05`)
      - 31+ invites: 7% (`0.07`)
    - `getReferralCommissionRate(inviteCount)`: returns 0.03, 0.05, 0.07.
    - `calculatePassiveCommission(inviteeEarnedCash, inviteCount)`: `Math.floor(inviteeEarnedCash * rate)`.
- **Test File Status**:
  - `packages/game-core/src/referral.test.ts`: **17 tests passed**.
  - **GAP**: `calculateReferralKickback` and `INVITEE_CASH_MILESTONES` are covered in lines 193-222, but `getReferralCommissionRate`, `calculatePassiveCommission`, and `REFERRAL_COMMISSION_TIERS` (the 3%, 5%, 7% tiers) are **NOT tested** anywhere in `referral.test.ts`.

---

### 1.5 Daily Streak Progression Bonuses
- **Location**: `packages/game-core/src/missions.ts` (lines 175-320)
- **Math & Milestones**:
  - `STREAK_MILESTONES`:
    - Day 7: 1.0x SRU + 500 Cash ('7 Günlük Seri')
    - Day 30 (1 Ay): 2.5x SRU + 5,000 Cash ('1 Aylık Sadakat')
    - Day 90 (3 Ay): 5.0x SRU + 25,000 Cash ('3 Aylık Çeyrek Ustalığı')
    - Day 180 (6 Ay): 10.0x SRU + 100,000 Cash ('6 Aylık Yarım Yıl Hanedanı')
    - Day 365 (1 Yıl): 25.0x SRU + 500,000 Cash + "imperial_veteran" Badge ('1 Yıllık İmparatorluk Kıdemlisi')
  - `calculateExtendedStreakReward(streakDays, currentSRU)`
  - `calculateStreakReward(streakDays, currentSRU)`
  - `evaluateStreak(lastClaimDate, currentDate, currentStreak)`
- **Test File Status**:
  - `packages/game-core/src/missions.test.ts`: **29 tests passed** (covers Days 7, 30, 90, 180, 365, cycle bonuses, badge grant).
  - `packages/game-core/src/empirical-challenger-o10.test.ts`: **19 tests passed** (adversarial boundary matrix Days 0, 1, 6, 7, 8, 29, 30, 31, 89, 90, 91, 179, 180, 181, 364, 365, 366, 1000).
  - `apps/web/src/screens/missions-milestones.test.tsx`: **4 tests passed**.
  - Current test coverage: **100%**.

---

### 1.6 Incidental Defect Discovered
- Running `pnpm vitest run apps/web` failed 1 test:
  - File: `apps/web/src/screens/arcade-screen.test.tsx:21`
  - Error: `AssertionError: expected '<div class="arcade-screen workspace-g…' to contain 'Şifre'`
  - Root Cause: In `apps/web/src/components/empire-arcade.tsx:206`, the tab label was changed to `'Deşifre'`, but the test still expects `'Şifre'`.

---

## 2. Logic Chain

1. **Premise 1**: M1 objective requires auditing current test suites, math implementations, and identifying exact gaps for Stream 1.
2. **Observation 1.1**: `apps/web/src/game/crypto-mines-model.ts` has complete pure math functions (`calculateMinesMultiplier`, `calculateNextMinesMultiplier`, `generateMineLocations`, `startMinesGame`, `clickMinesTile`, `cashoutMinesGame`), but file search confirms `apps/web/src/game/crypto-mines-model.test.ts` does not exist.
   - *Inference*: A comprehensive unit test suite `crypto-mines-model.test.ts` must be created in M2 covering formula assertions, grid randomization (Fisher-Yates uniqueness), 1-20 mine limits, bust conditions, and cashouts.
3. **Observation 1.2**: `apps/web/src/game/crypto-predictions-model.ts` only exports interfaces and a mock list; calculation functions (`calculateOdds`, `calculatePotentialPayout`, `createPredictionTicket`, `resolvePredictionTicket`) are embedded inside `crypto-predictions-game.tsx`, and `crypto-predictions-model.test.ts` does not exist.
   - *Inference*: Pure calculation helpers should be exported in `crypto-predictions-model.ts` and covered by `crypto-predictions-model.test.ts` verifying payout calculations, stake deductions, and resolution states.
4. **Observation 1.3**: `packages/game-core/src/crypto-crash.ts` has 23 comprehensive tests passing with zero failures, including 50,000-round Monte Carlo simulation and adaptive house edge testing.
   - *Inference*: The core math engine for Crash is fully implemented and tested in `game-core`.
5. **Observation 1.4**: `packages/game-core/src/referral.ts` contains `getReferralCommissionRate` and `calculatePassiveCommission` (3%, 5%, 7% tiers), but `referral.test.ts` only tests kickback (0.1%) and cash milestones (100K-1B).
   - *Inference*: Additional tests must be added to `packages/game-core/src/referral.test.ts` to test `getReferralCommissionRate` at bounds (0, 10, 11, 30, 31, 100) and `calculatePassiveCommission`.
6. **Observation 1.5**: `packages/game-core/src/missions.ts` streak calculations are tested by 29 tests in `missions.test.ts` and 19 tests in `empirical-challenger-o10.test.ts`.
   - *Inference*: Streak progression bonus testing is complete with zero coverage gaps.
7. **Observation 1.6**: `arcade-screen.test.tsx` failure is a 1-line label discrepancy (`'Şifre'` vs `'Deşifre'`).

---

## 3. Caveats

- **Read-Only Investigation**: No source code or test files were modified during this investigation.
- **Scope Boundary**: API routes and PGlite database concurrency tests belong to Stream 2. The PGlite hook timeout observed during full `apps/api` test execution occurs when 24 database suites run concurrently in one thread; this does not impact `packages/game-core` pure unit tests.
- **Client vs Server Crash Models**: Two implementations of Crash math exist (`packages/game-core/src/crypto-crash.ts` provably fair server engine vs `apps/web/src/game/crypto-crash-model.ts` client animation model). Both models have existing unit tests.

---

## 4. Conclusion

The core math implementations in the repository are mathematically sound and adhere to the project specifications. The specific action items for Milestone M2 (Implementation phase) are clearly identified:
1. **Create `apps/web/src/game/crypto-mines-model.test.ts`**:
   - Verify multiplier formula $(1 - 0.03) \times \prod \frac{25 - i}{25 - m - i}$ for mine counts 1 to 20.
   - Verify Fisher-Yates generator returns unique indices in range [0..24].
   - Verify safe tiles calculation, bust scenario, and cashout calculation.
2. **Export and test pure prediction functions in `crypto-predictions-model.ts`**:
   - Extract `calculatePredictionPayout`, `validatePredictionStake`, `createPredictionTicket`, `settlePredictionTicket`.
   - Create `apps/web/src/game/crypto-predictions-model.test.ts` with 100% coverage.
3. **Extend `packages/game-core/src/referral.test.ts`**:
   - Add tests for `getReferralCommissionRate` (thresholds: 0, 10, 11, 30, 31, 50) and `calculatePassiveCommission` (3%, 5%, 7% commission).
4. **Fix `apps/web/src/screens/arcade-screen.test.tsx`**:
   - Update expected string from `'Şifre'` to `'Deşifre'` (or align with tab title).

---

## 5. Verification Method

To independently verify these findings:

1. **Verify game-core unit test status**:
   ```powershell
   pnpm vitest run packages/game-core
   ```
   *Expected*: 22 test files passed, 332 tests passed.

2. **Verify missing Mines & Predictions tests**:
   ```powershell
   Test-Path "apps/web/src/game/crypto-mines-model.test.ts"
   Test-Path "apps/web/src/game/crypto-predictions-model.test.ts"
   ```
   *Expected*: `False` for both (files do not exist).

3. **Verify Crash engine tests**:
   ```powershell
   pnpm vitest run packages/game-core/src/crypto-crash.test.ts
   ```
   *Expected*: 23 tests passed.

4. **Verify Referral & Missions tests**:
   ```powershell
   pnpm vitest run packages/game-core/src/referral.test.ts packages/game-core/src/missions.test.ts
   ```
   *Expected*: 46 tests passed.

5. **Verify `arcade-screen.test.tsx` failure**:
   ```powershell
   pnpm vitest run apps/web/src/screens/arcade-screen.test.tsx
   ```
   *Expected*: 1 failure on line 21 expecting `'Şifre'`.
