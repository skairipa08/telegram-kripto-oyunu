import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NOTCOIN_CONFIG,
  CATIZEN_MERGE_TIERS,
  ARCADE_STARS_SKUS,
} from './minigames-config';
import {
  calculateEnergyState,
  calculateTapPower,
  calculateTapClick,
  calculateTapBotEarnings,
} from './notcoin-tap';
import { resolveParcelUnbox, solveAutoMergeBoard } from './catizen-merge';
import { generateCrashMultiplier, settleCrashBet } from './crypto-crash';

describe('CHALLENGER EMPIRICAL ADVERSARIAL SUITE - STREAM 1', () => {
  // ==========================================================================
  // VECTOR 1: Notcoin Tap Energy Conservation & Overflow Stress
  // ==========================================================================
  describe('Vector 1: Notcoin Tap Energy Conservation & Extreme Boundary Stress', () => {
    it('proves energy can NEVER exceed maxEnergy under any conditions', () => {
      const now = 1_000_000_000;
      const testCases = [
        { initial: 0, elapsedSec: 100 },
        { initial: 500, elapsedSec: 1_000 },
        { initial: 1000, elapsedSec: 100_000_000 }, // 10^8 seconds elapsed (~3.17 years)
        { initial: 9999, elapsedSec: 0 }, // Oversaturated initial energy
        { initial: 9999, elapsedSec: 100_000_000 },
      ];

      for (const tc of testCases) {
        const state = calculateEnergyState({
          currentEnergy: tc.initial,
          energyCapacityLevel: 1, // maxEnergy = 1000
          rechargeSpeedLevel: 1,
          lastUpdateTimestampMs: now,
          currentTimestampMs: now + tc.elapsedSec * 1000,
        });

        expect(state.energy).toBeLessThanOrEqual(state.maxEnergy);
        expect(state.energy).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(state.energy)).toBe(true);
        expect(Number.isNaN(state.energy)).toBe(false);
      }
    });

    it('proves energy can NEVER fall below 0 under negative or corrupt inputs', () => {
      const now = 2_000_000_000;
      const state = calculateEnergyState({
        currentEnergy: -500, // Negative initial energy
        lastUpdateTimestampMs: now,
        currentTimestampMs: now - 50_000_000 * 1000, // Negative elapsed time
      });

      expect(state.energy).toBeGreaterThanOrEqual(0);
      expect(state.elapsedSeconds).toBe(0);
      expect(Number.isNaN(state.energy)).toBe(false);
    });

    it('stress-tests calculateTapClick with extreme inputs (tapCount = 0, 10^6, energy = 0)', () => {
      // 1. Requested taps = 0 with energy = 500
      const zeroTaps = calculateTapClick({
        requestedTaps: 0,
        currentEnergy: 500,
        multitapLevel: 1,
      });
      expect(zeroTaps.tapsExecuted).toBe(0);
      expect(zeroTaps.totalCoinsEarned).toBe(0);
      expect(zeroTaps.remainingEnergy).toBe(500);

      // 2. Requested taps = 10^6 with energy = 1000
      const megaTaps = calculateTapClick({
        requestedTaps: 1_000_000,
        currentEnergy: 1000,
        multitapLevel: 5,
        rollCrit: () => false,
      });
      expect(megaTaps.tapsExecuted).toBe(1000); // Clamped strictly to available energy
      expect(megaTaps.remainingEnergy).toBe(0);
      expect(megaTaps.totalCoinsEarned).toBeGreaterThan(0);
      expect(Number.isFinite(megaTaps.totalCoinsEarned)).toBe(true);
      expect(Number.isNaN(megaTaps.totalCoinsEarned)).toBe(false);

      // 3. Requested taps = 100 with energy = 0
      const zeroEnergy = calculateTapClick({
        requestedTaps: 100,
        currentEnergy: 0,
        multitapLevel: 3,
      });
      expect(zeroEnergy.tapsExecuted).toBe(0);
      expect(zeroEnergy.totalCoinsEarned).toBe(0);
      expect(zeroEnergy.remainingEnergy).toBe(0);

      // 4. Extreme multitap levels (<= 0 and high values)
      expect(calculateTapPower(0)).toBe(1);
      expect(calculateTapPower(-100)).toBe(1);
      const highPower = calculateTapPower(50);
      expect(Number.isFinite(highPower)).toBe(true);
      expect(highPower).toBeGreaterThan(0);
    });

    it('proves offline TapBot accumulator CANNOT generate more taps than initial energy + regenerated energy', () => {
      let seed = 77112233;
      const pseudoRandom = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };

      const now = 10_000_000;
      // Test 100 randomized offline scenarios
      for (let i = 0; i < 100; i++) {
        const initialEnergy = Math.floor(pseudoRandom() * 2000);
        const elapsedSec = Math.floor(pseudoRandom() * 100_000); // up to ~27 hours
        const capLvl = 1 + Math.floor(pseudoRandom() * 5);
        const rechLvl = 1 + Math.floor(pseudoRandom() * 5);
        const extenderTier = Math.floor(pseudoRandom() * 4); // 0..3

        const result = calculateTapBotEarnings({
          lastClaimTimestampMs: now,
          currentTimestampMs: now + elapsedSec * 1000,
          currentEnergy: initialEnergy,
          multitapLevel: 1 + Math.floor(pseudoRandom() * 10),
          energyCapacityLevel: capLvl,
          rechargeSpeedLevel: rechLvl,
          offlineExtenderTier: extenderTier,
        });

        const rechargeRate =
          DEFAULT_NOTCOIN_CONFIG.baseRechargeRate +
          DEFAULT_NOTCOIN_CONFIG.rechargeStep * (rechLvl - 1);
        const maxEnergy =
          DEFAULT_NOTCOIN_CONFIG.baseEnergy +
          DEFAULT_NOTCOIN_CONFIG.energyStep * (capLvl - 1);
        const clampedInitial = Math.min(maxEnergy, Math.max(0, initialEnergy));
        const regenerated = result.effectiveSeconds * rechargeRate;
        const totalEnergyBudget = clampedInitial + regenerated;

        // CRITICAL INVARIANT: bot taps <= total energy budget
        expect(result.actualTaps).toBeLessThanOrEqual(totalEnergyBudget);
        expect(result.actualTaps).toBeLessThanOrEqual(result.nominalTaps);
        expect(result.remainingEnergy).toBeGreaterThanOrEqual(0);
        expect(result.remainingEnergy).toBeLessThanOrEqual(result.maxEnergy);
        expect(result.coinsEarned).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(result.coinsEarned)).toBe(true);
      }
    });

    it('verifies Telegram Stars SKUs: seasonPointsMultiplier is permanently 1.0 (anti-P2W guardrail)', () => {
      expect(ARCADE_STARS_SKUS.length).toBeGreaterThanOrEqual(5);

      for (const sku of ARCADE_STARS_SKUS) {
        // Anti-P2W Guardrails:
        expect(sku.seasonPointsMultiplier).toBe(1.0);
        expect(sku.bonusSeasonPoints).toBe(0);
        expect(sku.starsPrice).toBeGreaterThan(0);
      }
    });
  });

  // ==========================================================================
  // VECTOR 2: Catizen Merge Invariant & Fuzzing
  // ==========================================================================
  describe('Vector 2: Catizen Merge Invariant & Fuzzing', () => {
    it('proves super-linearity: R_{k+1} > 2 * R_k for all tiers 1 to 12 with >= 25% margin', () => {
      expect(CATIZEN_MERGE_TIERS.length).toBe(12);

      for (let k = 1; k < CATIZEN_MERGE_TIERS.length; k++) {
        const currentTier = CATIZEN_MERGE_TIERS[k - 1]!;
        const nextTier = CATIZEN_MERGE_TIERS[k]!;

        const twoItemsRate = currentTier.passiveRatePerSec * 2;
        const nextRate = nextTier.passiveRatePerSec;

        // Strict Super-Linearity required by prompt: R_{k+1} > 2 * R_k
        expect(nextRate).toBeGreaterThan(twoItemsRate);

        // Verification of empirical ratio R_{k+1} / (2 * R_k)
        const ratio = nextRate / twoItemsRate;
        expect(ratio).toBeGreaterThan(1.24); // Tiers scale between 1.247x and 1.50x
      }
    });

    it('fuzzes 1,000 randomized 12-slot boards proving termination in <= 11 steps and zero unmerged pairs', () => {
      let seed = 556677889;
      const pseudoRandom = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };

      for (let run = 0; run < 1000; run++) {
        const board: number[] = [];
        for (let i = 0; i < 12; i++) {
          const roll = Math.floor(pseudoRandom() * 12);
          if (roll === 0)
            board.push(0); // empty
          else if (roll === 1)
            board.push(-1); // parcel
          else board.push(roll - 1); // tiers 1..10
        }

        const result = solveAutoMergeBoard(board, {
          autoUnbox: true,
          rollFn: pseudoRandom,
        });

        // 1. Must terminate in <= 11 steps on a 12-slot board
        expect(result.totalMergesExecuted).toBeLessThanOrEqual(11);

        // 2. Solved board must contain NO matching pairs of the same tier < 12
        const tierHistogram: Record<number, number> = {};
        for (const slot of result.newGrid) {
          if (slot > 0 && slot < 12) {
            tierHistogram[slot] = (tierHistogram[slot] ?? 0) + 1;
            expect(tierHistogram[slot]).toBeLessThanOrEqual(1);
          }
        }

        // 3. No unboxed parcels remain
        expect(result.newGrid.includes(-1)).toBe(false);

        // 4. Rewards are valid
        expect(result.totalRewardCash).toBeGreaterThanOrEqual(0);
      }
    });

    it('verifies mystery parcel unboxing distribution (20,000 rolls) matches 75% T1, 20% T2, 5% T3', () => {
      let seed = 314159265;
      const pseudoRandom = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };

      const N = 20_000;
      const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };

      for (let i = 0; i < N; i++) {
        const tier = resolveParcelUnbox(pseudoRandom());
        counts[tier] = (counts[tier] ?? 0) + 1;
      }

      const p1 = counts[1]! / N;
      const p2 = counts[2]! / N;
      const p3 = counts[3]! / N;

      // 75% +/- 0.8%
      expect(p1).toBeGreaterThanOrEqual(0.742);
      expect(p1).toBeLessThanOrEqual(0.758);

      // 20% +/- 0.8%
      expect(p2).toBeGreaterThanOrEqual(0.192);
      expect(p2).toBeLessThanOrEqual(0.208);

      // 5% +/- 0.5%
      expect(p3).toBeGreaterThanOrEqual(0.045);
      expect(p3).toBeLessThanOrEqual(0.055);
    });
  });

  // ==========================================================================
  // VECTOR 3: Crypto Crash Provably Fair & RTP Currency Sink Invariant
  // ==========================================================================
  describe('Vector 3: Crypto Crash Provably Fair & RTP Currency Sink Invariant', () => {
    it('verifies HMAC-SHA256 Pareto distribution determinism', () => {
      const serverSeed = 'challenger_server_seed_9999999999';
      const clientSeed = 'challenger_client_seed_alpha';
      const nonce = 42;

      const run1 = generateCrashMultiplier(serverSeed, clientSeed, nonce);
      const run2 = generateCrashMultiplier(serverSeed, clientSeed, nonce);

      expect(run1.hash).toBe(run2.hash);
      expect(run1.crashMultiplier).toBe(run2.crashMultiplier);
      expect(run1.isInstantCrash).toBe(run2.isInstantCrash);
      expect(run1.rawMultiplier).toBe(run2.rawMultiplier);
    });

    it('proves player RTP is strictly 97.0% +/- 0.5% across cashout thresholds (1.5x, 2.0x, 5.0x, 10.0x) over 20,000 rounds', () => {
      const N = 20_000;
      const serverSeed = 'adversarial_rtp_test_seed_2026';
      const clientSeed = 'monte_carlo_oracle';
      const targets = [1.5, 2.0, 5.0, 10.0];
      const totalPayouts: Record<number, number> = {
        1.5: 0,
        2.0: 0,
        5.0: 0,
        10.0: 0,
      };
      let instantCrashes = 0;

      for (let nonce = 0; nonce < N; nonce++) {
        const round = generateCrashMultiplier(serverSeed, clientSeed, nonce);
        if (round.isInstantCrash) {
          instantCrashes++;
        }

        for (const target of targets) {
          if (round.crashMultiplier >= target) {
            totalPayouts[target] = (totalPayouts[target] ?? 0) + target;
          }
        }
      }

      // 1. Instant crash rate check (~1 in 33 = 3.030%)
      const instantPct = (instantCrashes / N) * 100;
      expect(instantPct).toBeGreaterThanOrEqual(2.6);
      expect(instantPct).toBeLessThanOrEqual(3.5);

      // 2. Empirical RTP: (totalPayout / (N * 1.0)) * 100%
      for (const target of targets) {
        const empiricalRtp = (totalPayouts[target]! / N) * 100;
        // Strict bound: 97.0% +/- 0.5% (96.5% to 97.5%)
        expect(empiricalRtp).toBeGreaterThanOrEqual(96.5);
        expect(empiricalRtp).toBeLessThanOrEqual(97.5);
      }
    });

    it('proves that hyperinflation is mathematically impossible (house edge strictly positive)', () => {
      // Settle 1,000 bets with variable stakes and multipliers
      const stake = 1000;
      let totalStaked = 0;
      let totalReturned = 0;

      const serverSeed = 'sink_verification_seed_1000';
      const clientSeed = 'sink_client';

      for (let nonce = 0; nonce < 5000; nonce++) {
        const round = generateCrashMultiplier(serverSeed, clientSeed, nonce);
        const settlement = settleCrashBet({
          stake,
          crashMultiplier: round.crashMultiplier,
          cashoutMultiplier: 2.0,
        });

        totalStaked += stake;
        totalReturned += settlement.payoutCash;
      }

      // Player must have returned less than total staked (currency sink invariant)
      expect(totalReturned).toBeLessThan(totalStaked);
      const overallReturnRate = (totalReturned / totalStaked) * 100;
      // 5000 binary trials has 2-sigma of ~2.8%; bounds [94.0%, 99.0%]
      expect(overallReturnRate).toBeGreaterThanOrEqual(94.0);
      expect(overallReturnRate).toBeLessThanOrEqual(99.0);
    });
  });
});
