import { describe, expect, it } from 'vitest';
import {
  calculateMinesMultiplier,
  calculateNextMinesMultiplier,
  cashoutMinesGame,
  clickMinesTile,
  generateMineLocations,
  MAX_MINES,
  MIN_MINES,
  MIN_MINES_STAKE,
  MINES_GRID_SIZE,
  MINES_HOUSE_EDGE,
  startMinesGame,
  type MinesGameState,
} from './crypto-mines-model';

import {
  calculatePredictionOdds,
  calculatePredictionPayout,
  createPredictionBetTicket,
  INITIAL_PREDICTION_MARKETS,
  MIN_PREDICTION_STAKE,
  resolvePredictionBetTicket,
  validatePredictionStake,
} from './crypto-predictions-model';

import {
  calculatePassiveCommission,
  calculateReferralKickback,
  getReferralCommissionRate,
  REFERRAL_CASH_KICKBACK_RATE,
  REFERRAL_COMMISSION_TIERS,
} from '@empire/game-core';

describe('CHALLENGER 1: ADVERSARIAL MATHEMATICAL STRESS HARNESS', () => {
  // =========================================================================
  // VECTOR 1: CRYPTO MINES MATHEMATICAL ORACLE & FUZZING
  // =========================================================================
  describe('Vector 1: Crypto Mines Math & Grid Engine', () => {
    describe('Constants & Configuration Invariants', () => {
      it('verifies mines boundary constants', () => {
        expect(MIN_MINES).toBe(1);
        expect(MAX_MINES).toBe(24);
        expect(MIN_MINES_STAKE).toBe(10);
        expect(MINES_GRID_SIZE).toBe(25);
        expect(MINES_HOUSE_EDGE).toBe(0.03);
      });
    });

    describe('Exhaustive Multiplier Oracle: All 300 (m, k) Combinations', () => {
      it('verifies exact mathematical formula (1 - 0.03) * Product_{i=0}^{k-1} (25-i)/(25-m-i) across all m in [1..24] and k in [1..25-m]', () => {
        let combinationsTested = 0;

        for (let m = 1; m <= 24; m++) {
          const maxSafe = 25 - m;
          let prevMult = 1.0;

          for (let k = 1; k <= maxSafe; k++) {
            // Independent high-precision oracle calculation
            let product = 1.0;
            for (let i = 0; i < k; i++) {
              product *= (25 - i) / (25 - m - i);
            }
            const rawExpected = product * (1 - MINES_HOUSE_EDGE);
            const expectedRounded = Math.max(
              1.01,
              Math.round(rawExpected * 100) / 100,
            );

            // Actual implementation
            const actual = calculateMinesMultiplier(k, m);
            expect(actual).toBe(expectedRounded);

            // Verify next multiplier helper consistency
            const nextMult = calculateNextMinesMultiplier(k - 1, m);
            expect(nextMult).toBe(expectedRounded);

            // Monotonicity check: as gems revealed increases, multiplier strictly increases
            expect(actual).toBeGreaterThan(prevMult);
            prevMult = actual;

            combinationsTested++;
          }
        }

        // Sum of (25 - m) for m=1..24 is 24*25/2 = 300
        expect(combinationsTested).toBe(300);
      });

      it('verifies extreme multiplier boundary anchors', () => {
        // 24 mines, 1 safe tile: (25/1) * 0.97 = 24.25
        expect(calculateMinesMultiplier(1, 24)).toBe(24.25);

        // 1 mine, 24 safe tiles: (25/1) * 0.97 = 24.25
        expect(calculateMinesMultiplier(24, 1)).toBe(24.25);

        // 20 mines, 5 safe tiles: 53130 * 0.97 = 51536.1
        expect(calculateMinesMultiplier(5, 20)).toBe(51536.1);

        // 1 mine, 1 safe tile: (25/24) * 0.97 = 1.0104... -> clamped to 1.01
        expect(calculateMinesMultiplier(1, 1)).toBe(1.01);
      });

      it('handles invalid or out-of-range inputs safely', () => {
        // Zero or negative revealedCount returns 1.0
        expect(calculateMinesMultiplier(0, 3)).toBe(1.0);
        expect(calculateMinesMultiplier(-1, 3)).toBe(1.0);
        expect(calculateMinesMultiplier(-100, 5)).toBe(1.0);

        // revealedCount exceeding safe tiles returns 1.0
        expect(calculateMinesMultiplier(25, 1)).toBe(1.0); // only 24 safe
        expect(calculateMinesMultiplier(2, 24)).toBe(1.0); // only 1 safe
        expect(calculateMinesMultiplier(100, 10)).toBe(1.0);
      });
    });

    describe('Fisher-Yates Shuffle Fuzzing Harness (2,500 Iterations)', () => {
      it('fuzzes 2,500 rounds: strictly zero duplicates, all indices in [0..24], correct length', () => {
        for (let iter = 0; iter < 2500; iter++) {
          const mineCount = Math.floor(Math.random() * 24) + 1; // 1..24
          const exclude = iter % 2 === 0 ? iter % 25 : undefined;

          const mines = generateMineLocations(mineCount, exclude);

          // Correct length
          expect(mines).toHaveLength(mineCount);

          // Zero duplicates
          const uniqueSet = new Set(mines);
          expect(uniqueSet.size).toBe(mineCount);

          // Strictly within [0..24]
          for (const tile of mines) {
            expect(Number.isInteger(tile)).toBe(true);
            expect(tile).toBeGreaterThanOrEqual(0);
            expect(tile).toBeLessThan(MINES_GRID_SIZE);
          }

          // Exclude index strictly preserved
          if (exclude !== undefined) {
            expect(mines.includes(exclude)).toBe(false);
          }
        }
      });

      it('strictly enforces excludeIndex with 24 mines (only 1 safe tile possible)', () => {
        for (let targetSafe = 0; targetSafe < 25; targetSafe++) {
          const mines = generateMineLocations(24, targetSafe);
          expect(mines).toHaveLength(24);
          expect(mines.includes(targetSafe)).toBe(false);
          // The remaining tile must be targetSafe
          const allTiles = new Set(Array.from({ length: 25 }, (_, i) => i));
          for (const m of mines) {
            allTiles.delete(m);
          }
          expect(Array.from(allTiles)).toEqual([targetSafe]);
        }
      });

      it('statistically verifies uniform distribution over 5,000 samples', () => {
        const counts = new Array(25).fill(0);
        const iterations = 5000;
        const minesPerGame = 5;

        for (let i = 0; i < iterations; i++) {
          const locations = generateMineLocations(minesPerGame);
          for (const loc of locations) {
            counts[loc]++;
          }
        }

        // Expected count per tile: 5000 * 5 / 25 = 1000
        // With 5,000 iterations, every tile should fall comfortably within [750..1250]
        for (let tile = 0; tile < 25; tile++) {
          expect(counts[tile]).toBeGreaterThan(750);
          expect(counts[tile]).toBeLessThan(1250);
        }
      });
    });

    describe('Game State Transitions: Bust vs Cashout Invariants', () => {
      it('bust invariant: always results in payout 0, multiplier 0, and busted status', () => {
        const state = startMinesGame(500, 3);
        const mineIdx = state.mineLocations[0]!;

        const result = clickMinesTile(state, mineIdx);
        expect(result.hitMine).toBe(true);
        expect(result.nextState.status).toBe('busted');
        expect(result.nextState.payoutCash).toBe(0);
        expect(result.nextState.currentMultiplier).toBe(0);
        expect(result.nextState.nextMultiplier).toBe(0);

        // Attempting to cashout after bust yields 0
        const postBustCashout = cashoutMinesGame(result.nextState);
        expect(postBustCashout.payoutCash).toBe(0);
        expect(postBustCashout.netProfit).toBe(0);
      });

      it('cashout invariant: matches exact Math.floor(stake * multiplier)', () => {
        const stakes = [10, 50, 100, 333, 777, 10000, 100000];

        for (const stake of stakes) {
          const state = startMinesGame(stake, 5);
          const safeIdx = Array.from({ length: 25 }, (_, i) => i).find(
            (idx) => !state.mineLocations.includes(idx),
          )!;

          const afterClick = clickMinesTile(state, safeIdx).nextState;
          const cashout = cashoutMinesGame(afterClick);

          const expectedMultiplier = calculateMinesMultiplier(1, 5);
          const expectedPayout = Math.floor(stake * expectedMultiplier);
          const expectedNetProfit = expectedPayout - stake;

          expect(cashout.payoutCash).toBe(expectedPayout);
          expect(cashout.netProfit).toBe(expectedNetProfit);
          expect(cashout.nextState.status).toBe('cashed_out');
        }
      });

      it('auto-cashout invariant when board cleared (all safe tiles revealed)', () => {
        // 23 mines = 2 safe tiles
        const fakeMines = Array.from({ length: 23 }, (_, i) => i); // 0..22 are mines, 23 & 24 are safe
        const state: MinesGameState = {
          status: 'playing',
          stake: 200,
          mineCount: 23,
          mineLocations: fakeMines,
          revealedTiles: [],
          currentMultiplier: 1.0,
          nextMultiplier: calculateMinesMultiplier(1, 23),
          payoutCash: 0,
          startTime: Date.now(),
        };

        // First safe tile
        const step1 = clickMinesTile(state, 23);
        expect(step1.nextState.status).toBe('playing');

        // Second safe tile (clearing board)
        const step2 = clickMinesTile(step1.nextState, 24);
        expect(step2.nextState.status).toBe('cashed_out');
        expect(step2.nextState.revealedTiles).toEqual([23, 24]);
        const expectedFinalMult = calculateMinesMultiplier(2, 23);
        expect(step2.nextState.payoutCash).toBe(
          Math.floor(200 * expectedFinalMult),
        );
      });
    });
  });

  // =========================================================================
  // VECTOR 2: CRYPTO PREDICTIONS MATHEMATICAL & BOOKMAKER INTEGRITY
  // =========================================================================
  describe('Vector 2: Crypto Predictions Math & Margin Engine', () => {
    describe('Payout Formula: Math.floor(stake * odds)', () => {
      it('truncates fractional payouts correctly with Math.floor', () => {
        expect(calculatePredictionPayout(100, 1.85)).toBe(185);
        expect(calculatePredictionPayout(333, 1.85)).toBe(616); // 333 * 1.85 = 616.05 -> 616
        expect(calculatePredictionPayout(77, 1.95)).toBe(150); // 77 * 1.95 = 150.15 -> 150
        expect(calculatePredictionPayout(55, 1.455)).toBe(80); // 55 * 1.455 = 80.025 -> 80
      });

      it('survives extreme stakes and high odds up to JavaScript safe integer limits', () => {
        // 1 Billion stake
        expect(calculatePredictionPayout(1_000_000_000, 2.15)).toBe(
          2_150_000_000,
        );

        // 10 Billion stake
        expect(calculatePredictionPayout(10_000_000_000, 1.75)).toBe(
          17_500_000_000,
        );

        // Long shot high odds (e.g. 500x)
        expect(calculatePredictionPayout(50, 500)).toBe(25_000);

        // Non-positive returns 0
        expect(calculatePredictionPayout(0, 1.85)).toBe(0);
        expect(calculatePredictionPayout(-100, 1.85)).toBe(0);
        expect(calculatePredictionPayout(100, 0)).toBe(0);
        expect(calculatePredictionPayout(100, -2)).toBe(0);
      });
    });

    describe('Bookmaker Overround Margin: All 7 Initial Markets', () => {
      it('proves bookmaker overround (1/yesOdds + 1/noOdds > 1.0) on all 7 markets', () => {
        expect(INITIAL_PREDICTION_MARKETS).toHaveLength(7);

        for (const market of INITIAL_PREDICTION_MARKETS) {
          const yesProb = 1 / market.yesOdds;
          const noProb = 1 / market.noOdds;
          const totalImpliedProb = yesProb + noProb;
          const overroundPercent = (totalImpliedProb - 1) * 100;

          // Bookmaker margin MUST be positive (house advantage)
          expect(totalImpliedProb).toBeGreaterThan(1.0);

          // Overround is balanced and competitive (between 4.5% and 7.5%)
          expect(overroundPercent).toBeGreaterThan(4.5);
          expect(overroundPercent).toBeLessThan(7.5);

          // Sanity check odds range
          expect(market.yesOdds).toBeGreaterThanOrEqual(1.5);
          expect(market.yesOdds).toBeLessThanOrEqual(3.0);
          expect(market.noOdds).toBeGreaterThanOrEqual(1.5);
          expect(market.noOdds).toBeLessThanOrEqual(3.0);

          // Odds calculation helper matches market properties
          expect(calculatePredictionOdds(market, 'yes')).toBe(market.yesOdds);
          expect(calculatePredictionOdds(market, 'no')).toBe(market.noOdds);
        }
      });
    });

    describe('Stake Validation: Rejecting Invalid, Negative, Float, < 50, > Balance', () => {
      it('accepts valid stakes >= 50 and <= balance', () => {
        expect(MIN_PREDICTION_STAKE).toBe(50);
        expect(validatePredictionStake(50, 50)).toEqual({ valid: true });
        expect(validatePredictionStake(50, 1000)).toEqual({ valid: true });
        expect(validatePredictionStake(1000, 1000)).toEqual({ valid: true });
        expect(validatePredictionStake(100000, 500000)).toEqual({
          valid: true,
        });
      });

      it('rejects stakes strictly below 50', () => {
        expect(validatePredictionStake(49, 1000).valid).toBe(false);
        expect(validatePredictionStake(1, 1000).valid).toBe(false);
        expect(validatePredictionStake(0, 1000).valid).toBe(false);
      });

      it('rejects stakes strictly exceeding user balance', () => {
        expect(validatePredictionStake(51, 50).valid).toBe(false);
        expect(validatePredictionStake(1000, 999).valid).toBe(false);
        expect(validatePredictionStake(100000, 50000).valid).toBe(false);
      });

      it('rejects non-integers (fractional cash)', () => {
        expect(validatePredictionStake(50.5, 1000).valid).toBe(false);
        expect(validatePredictionStake(99.99, 1000).valid).toBe(false);
        expect(validatePredictionStake(50.00001, 1000).valid).toBe(false);
      });

      it('rejects negative numbers, NaN, and infinities', () => {
        expect(validatePredictionStake(-1, 1000).valid).toBe(false);
        expect(validatePredictionStake(-50, 1000).valid).toBe(false);
        expect(validatePredictionStake(NaN, 1000).valid).toBe(false);
        expect(validatePredictionStake(Infinity, 1000).valid).toBe(false);
        expect(validatePredictionStake(-Infinity, 1000).valid).toBe(false);
      });
    });

    describe('Bet Ticket Settlement Invariants', () => {
      it('settles winning ticket: full potential payout awarded and net profit = payout - stake', () => {
        const ticket = createPredictionBetTicket({
          marketId: 'pred_ton_ath',
          choice: 'yes',
          stake: 200,
          odds: 1.9,
        });

        const settlement = resolvePredictionBetTicket(ticket, 'yes');
        expect(settlement.won).toBe(true);
        expect(settlement.payoutCash).toBe(380);
        expect(settlement.netProfit).toBe(180);
      });

      it('settles losing ticket: 0 payout and net profit = -stake', () => {
        const ticket = createPredictionBetTicket({
          marketId: 'pred_ton_ath',
          choice: 'yes',
          stake: 200,
          odds: 1.9,
        });

        const settlement = resolvePredictionBetTicket(ticket, 'no');
        expect(settlement.won).toBe(false);
        expect(settlement.payoutCash).toBe(0);
        expect(settlement.netProfit).toBe(-200);
      });
    });
  });

  // =========================================================================
  // VECTOR 3: TURNOVER & REFERRAL COMMISSION MATHEMATICAL ORACLE
  // =========================================================================
  describe('Vector 3: Turnover Kickback & Tiered Referral Commission', () => {
    describe('0.1% (1/1000) Direct Kickback Verification', () => {
      it('yields exactly 1,000 cash on 1,000,000 turnover', () => {
        expect(calculateReferralKickback(1_000_000)).toBe(1_000);
        expect(REFERRAL_CASH_KICKBACK_RATE).toBe(0.001);
      });

      it('tests turnover boundaries and floor truncation', () => {
        expect(calculateReferralKickback(0)).toBe(0);
        expect(calculateReferralKickback(-500_000)).toBe(0);
        expect(calculateReferralKickback(999)).toBe(0); // 999 * 0.001 = 0.999 -> 0
        expect(calculateReferralKickback(1_000)).toBe(1); // 1,000 * 0.001 = 1
        expect(calculateReferralKickback(10_000_000)).toBe(10_000);
        expect(calculateReferralKickback(100_000_000)).toBe(100_000);
      });
    });

    describe('Commission Rates & Tier Boundaries (Zero Off-By-One)', () => {
      it('verifies exact rates across tier boundary integers: 10, 11, 30, 31', () => {
        // Tier 1: 0 - 10 invites -> 3%
        expect(getReferralCommissionRate(0)).toBe(0.03);
        expect(getReferralCommissionRate(9)).toBe(0.03);
        expect(getReferralCommissionRate(10)).toBe(0.03); // Upper bound of Tier 1

        // Tier 2: 11 - 30 invites -> 5%
        expect(getReferralCommissionRate(11)).toBe(0.05); // Lower bound of Tier 2
        expect(getReferralCommissionRate(20)).toBe(0.05);
        expect(getReferralCommissionRate(30)).toBe(0.05); // Upper bound of Tier 2

        // Tier 3: 31+ invites -> 7%
        expect(getReferralCommissionRate(31)).toBe(0.07); // Lower bound of Tier 3
        expect(getReferralCommissionRate(50)).toBe(0.07);
        expect(getReferralCommissionRate(1000)).toBe(0.07);
      });

      it('conforms strictly to REFERRAL_COMMISSION_TIERS constant specification', () => {
        expect(REFERRAL_COMMISSION_TIERS[0]!.minInvites).toBe(0);
        expect(REFERRAL_COMMISSION_TIERS[0]!.maxInvites).toBe(10);
        expect(REFERRAL_COMMISSION_TIERS[0]!.ratePercent).toBe(3);

        expect(REFERRAL_COMMISSION_TIERS[1]!.minInvites).toBe(11);
        expect(REFERRAL_COMMISSION_TIERS[1]!.maxInvites).toBe(30);
        expect(REFERRAL_COMMISSION_TIERS[1]!.ratePercent).toBe(5);

        expect(REFERRAL_COMMISSION_TIERS[2]!.minInvites).toBe(31);
        expect(REFERRAL_COMMISSION_TIERS[2]!.maxInvites).toBe(Infinity);
        expect(REFERRAL_COMMISSION_TIERS[2]!.ratePercent).toBe(7);
      });
    });

    describe('calculatePassiveCommission: 1M Cash Yields 30K, 50K, 70K', () => {
      it('yields exactly 30,000 for Tier 1 (<= 10 invites)', () => {
        expect(calculatePassiveCommission(1_000_000, 0)).toBe(30_000);
        expect(calculatePassiveCommission(1_000_000, 5)).toBe(30_000);
        expect(calculatePassiveCommission(1_000_000, 10)).toBe(30_000);
      });

      it('yields exactly 50,000 for Tier 2 (11 - 30 invites)', () => {
        expect(calculatePassiveCommission(1_000_000, 11)).toBe(50_000);
        expect(calculatePassiveCommission(1_000_000, 20)).toBe(50_000);
        expect(calculatePassiveCommission(1_000_000, 30)).toBe(50_000);
      });

      it('yields exactly 70,000 for Tier 3 (31+ invites)', () => {
        expect(calculatePassiveCommission(1_000_000, 31)).toBe(70_000);
        expect(calculatePassiveCommission(1_000_000, 50)).toBe(70_000);
        expect(calculatePassiveCommission(1_000_000, 100)).toBe(70_000);
      });

      it('verifies contrast ratio between passive commission and 0.1% kickback', () => {
        const turnover = 1_000_000;
        const kickback = calculateReferralKickback(turnover); // 1,000

        const t1Passive = calculatePassiveCommission(turnover, 10); // 30,000
        const t2Passive = calculatePassiveCommission(turnover, 20); // 50,000
        const t3Passive = calculatePassiveCommission(turnover, 50); // 70,000

        expect(t1Passive / kickback).toBe(30);
        expect(t2Passive / kickback).toBe(50);
        expect(t3Passive / kickback).toBe(70);
      });
    });
  });
});
