import { describe, expect, it } from 'vitest';
import {
  calculateEnergyState,
  calculateTapPower,
  calculateTapClick,
  calculateTapUpgradeCost,
  calculateTapBotEarnings,
} from './notcoin-tap';
import { DEFAULT_NOTCOIN_CONFIG } from './minigames-config';

describe('Notcoin Tap Engine & Mathematical Models', () => {
  describe('Energy Conservation Invariant & State', () => {
    it('never exceeds maxEnergy regardless of elapsed time', () => {
      const now = 1_000_000_000;
      // 100 million seconds elapsed (~3.17 years)
      const future = now + 100_000_000 * 1000;

      const state = calculateEnergyState({
        currentEnergy: 100,
        energyCapacityLevel: 1, // maxEnergy = 1000
        rechargeSpeedLevel: 1, // rechargeRate = 1/s
        lastUpdateTimestampMs: now,
        currentTimestampMs: future,
      });

      expect(state.energy).toBe(1000);
      expect(state.maxEnergy).toBe(1000);
      expect(state.rechargeRate).toBe(1);
      expect(state.elapsedSeconds).toBe(100_000_000);
    });

    it('recharges energy proportionally to elapsed seconds and recharge level', () => {
      const now = 100_000;
      // 50 seconds elapsed, level 3 recharge (1 + 1*2 = 3 energy/sec)
      const after50s = now + 50 * 1000;

      const state = calculateEnergyState({
        currentEnergy: 200,
        energyCapacityLevel: 2, // maxEnergy = 1000 + 500 = 1500
        rechargeSpeedLevel: 3, // rechargeRate = 1 + 2 = 3/s
        lastUpdateTimestampMs: now,
        currentTimestampMs: after50s,
      });

      // 200 + 50 * 3 = 350
      expect(state.energy).toBe(350);
      expect(state.maxEnergy).toBe(1500);
      expect(state.rechargeRate).toBe(3);
      expect(state.elapsedSeconds).toBe(50);
    });

    it('handles negative or zero elapsed time gracefully without corrupting state', () => {
      const now = 500_000;
      const stateNegative = calculateEnergyState({
        currentEnergy: 400,
        lastUpdateTimestampMs: now,
        currentTimestampMs: now - 10_000,
      });

      expect(stateNegative.energy).toBe(400);
      expect(stateNegative.elapsedSeconds).toBe(0);
    });
  });

  describe('Tap Power Scaling', () => {
    it('matches exact formula max(L, round(1.5^(L-1))) across levels 1 to 15', () => {
      const expectedPowers: Record<number, number> = {
        1: 1,
        2: 2,
        3: 3,
        4: 4,
        5: 5,
        6: 8,
        7: 11,
        8: 17,
        9: 26,
        10: 38,
        15: 292,
      };

      for (const [levelStr, expected] of Object.entries(expectedPowers)) {
        const level = Number(levelStr);
        expect(calculateTapPower(level)).toBe(expected);
      }
    });

    it('enforces minimum tap power of 1 for level <= 0', () => {
      expect(calculateTapPower(0)).toBe(1);
      expect(calculateTapPower(-5)).toBe(1);
    });
  });

  describe('Tap Click Execution & Energy Depletion', () => {
    it('executes only up to available energy and depletes energy 1:1', () => {
      const result = calculateTapClick({
        requestedTaps: 50,
        currentEnergy: 30,
        multitapLevel: 1, // 1 coin/tap
        rollCrit: () => false, // no crits
      });

      expect(result.tapsExecuted).toBe(30);
      expect(result.remainingEnergy).toBe(0);
      expect(result.baseCoinsEarned).toBe(30);
      expect(result.critCoinsEarned).toBe(0);
      expect(result.totalCoinsEarned).toBe(30);
      expect(result.criticalHitsCount).toBe(0);
    });

    it('leaves remaining energy when requested taps are less than available', () => {
      const result = calculateTapClick({
        requestedTaps: 15,
        currentEnergy: 100,
        multitapLevel: 2, // 2 coins/tap
        rollCrit: () => false,
      });

      expect(result.tapsExecuted).toBe(15);
      expect(result.remainingEnergy).toBe(85);
      expect(result.totalCoinsEarned).toBe(30); // 15 * 2
    });

    it('returns 0 execution when energy is 0 or requested taps is 0', () => {
      const zeroEnergy = calculateTapClick({
        requestedTaps: 10,
        currentEnergy: 0,
        multitapLevel: 1,
      });
      expect(zeroEnergy.tapsExecuted).toBe(0);
      expect(zeroEnergy.totalCoinsEarned).toBe(0);
      expect(zeroEnergy.remainingEnergy).toBe(0);

      const zeroTaps = calculateTapClick({
        requestedTaps: 0,
        currentEnergy: 500,
        multitapLevel: 1,
      });
      expect(zeroTaps.tapsExecuted).toBe(0);
      expect(zeroTaps.totalCoinsEarned).toBe(0);
      expect(zeroTaps.remainingEnergy).toBe(500);
    });

    it('calculates deterministic critical hits with 5.0x multiplier', () => {
      // 4 normal taps (power=2 -> 8 coins), 1 crit tap (power=2 * 5.0 = 10 coins)
      const rolls = [false, false, true, false, false];
      let rollIndex = 0;

      const result = calculateTapClick({
        requestedTaps: 5,
        currentEnergy: 100,
        multitapLevel: 2,
        rollCrit: () => rolls[rollIndex++] ?? false,
      });

      expect(result.tapsExecuted).toBe(5);
      expect(result.criticalHitsCount).toBe(1);
      expect(result.baseCoinsEarned).toBe(8); // 4 * 2
      expect(result.critCoinsEarned).toBe(10); // 1 * 2 * 5
      expect(result.totalCoinsEarned).toBe(18);
    });

    it('satisfies 5.0% crit rate within +/- 0.5% over 10,000 simulated taps', () => {
      // Pseudo-random deterministic LCG generator for reproducible 10k test
      let seed = 123456789;
      const pseudoRandom = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };

      const result = calculateTapClick({
        requestedTaps: 10_000,
        currentEnergy: 10_000,
        multitapLevel: 1,
        rollCrit: () => pseudoRandom() < DEFAULT_NOTCOIN_CONFIG.critChance,
      });

      const empiricalCritRate = result.criticalHitsCount / 10_000;
      // 5.0% +/- 0.5% means between 0.045 and 0.055
      expect(empiricalCritRate).toBeGreaterThanOrEqual(0.045);
      expect(empiricalCritRate).toBeLessThanOrEqual(0.055);
    });
  });

  describe('Tap Upgrade Costs', () => {
    it('calculates multitap costs at 1.80 growth rate', () => {
      // L1: 100, L2: 180, L3: 324, L4: 583
      expect(calculateTapUpgradeCost('multitap', 1)).toBe(100);
      expect(calculateTapUpgradeCost('multitap', 2)).toBe(180);
      expect(calculateTapUpgradeCost('multitap', 3)).toBe(324);
      expect(calculateTapUpgradeCost('multitap', 4)).toBe(583);
    });

    it('calculates capacity costs at 1.70 growth rate', () => {
      // L1: 150, L2: 255, L3: 433 (150 * 1.70^2 = 433.49999...)
      expect(calculateTapUpgradeCost('capacity', 1)).toBe(150);
      expect(calculateTapUpgradeCost('capacity', 2)).toBe(255);
      expect(calculateTapUpgradeCost('capacity', 3)).toBe(433);
    });

    it('calculates recharge speed costs at 1.90 growth rate', () => {
      // L1: 200, L2: 380, L3: 722
      expect(calculateTapUpgradeCost('recharge_speed', 1)).toBe(200);
      expect(calculateTapUpgradeCost('recharge_speed', 2)).toBe(380);
      expect(calculateTapUpgradeCost('recharge_speed', 3)).toBe(722);
    });

    it('calculates static bot unlock cost', () => {
      expect(calculateTapUpgradeCost('bot_unlock', 1)).toBe(5000);
    });
  });

  describe('Offline TapBot Accumulator with Energy Conservation', () => {
    it('strictly limits bot taps by total available energy', () => {
      const now = 1_000_000;
      // 1000 seconds offline. Initial energy = 50. Recharge = 1/s.
      // Total energy available = 50 + 1000 * 1 = 1050.
      // Nominal taps at 0.333 tap/s = floor(1000 * 0.333) = 333 taps.
      // 333 <= 1050, so actual taps = 333.
      const result = calculateTapBotEarnings({
        lastClaimTimestampMs: now,
        currentTimestampMs: now + 1000 * 1000,
        currentEnergy: 50,
        multitapLevel: 1, // tap power = 1
        energyCapacityLevel: 1,
        rechargeSpeedLevel: 1,
      });

      expect(result.nominalTaps).toBe(333);
      expect(result.actualTaps).toBe(333);
      // Coins: floor(333 * 1 * 0.70) = 233
      expect(result.coinsEarned).toBe(233);
      // Remaining energy: min(1000, 1050 - 333) = 717
      expect(result.remainingEnergy).toBe(717);
      expect(result.isCapped).toBe(false);
    });

    it('bounds bot taps if available energy is exhausted', () => {
      const now = 1_000_000;
      // Custom config where recharge is 0 to test exhaustion
      const zeroRechargeConfig = {
        ...DEFAULT_NOTCOIN_CONFIG,
        baseRechargeRate: 0,
        rechargeStep: 0,
      };

      const result = calculateTapBotEarnings({
        lastClaimTimestampMs: now,
        currentTimestampMs: now + 3000 * 1000,
        currentEnergy: 100, // only 100 energy available
        multitapLevel: 1,
        energyCapacityLevel: 1,
        rechargeSpeedLevel: 1,
        config: zeroRechargeConfig,
      });

      // Nominal taps would be 3000 * 0.333 = 999
      expect(result.nominalTaps).toBe(999);
      // But actual taps strictly capped by initial energy: 100
      expect(result.actualTaps).toBe(100);
      expect(result.coinsEarned).toBe(70); // 100 * 1 * 0.70
      expect(result.remainingEnergy).toBe(0);
    });

    it('enforces offline time caps across extender tiers (3h, 6h, 12h, 24h)', () => {
      const now = 1_000_000;
      // 100 hours elapsed (360,000 seconds)
      const elapsed100h = now + 360_000 * 1000;

      // Tier 0 (base 3h = 10,800s)
      const baseResult = calculateTapBotEarnings({
        lastClaimTimestampMs: now,
        currentTimestampMs: elapsed100h,
        currentEnergy: 1000,
        multitapLevel: 1,
        energyCapacityLevel: 1,
        rechargeSpeedLevel: 1,
      });
      expect(baseResult.effectiveSeconds).toBe(10800);
      expect(baseResult.isCapped).toBe(true);

      // Tier 1 (6h = 21,600s)
      const tier1Result = calculateTapBotEarnings({
        lastClaimTimestampMs: now,
        currentTimestampMs: elapsed100h,
        currentEnergy: 1000,
        multitapLevel: 1,
        energyCapacityLevel: 1,
        rechargeSpeedLevel: 1,
        offlineExtenderTier: 1,
      });
      expect(tier1Result.effectiveSeconds).toBe(21600);
      expect(tier1Result.isCapped).toBe(true);

      // Tier 2 (12h = 43,200s)
      const tier2Result = calculateTapBotEarnings({
        lastClaimTimestampMs: now,
        currentTimestampMs: elapsed100h,
        currentEnergy: 1000,
        multitapLevel: 1,
        energyCapacityLevel: 1,
        rechargeSpeedLevel: 1,
        offlineExtenderTier: 2,
      });
      expect(tier2Result.effectiveSeconds).toBe(43200);
      expect(tier2Result.isCapped).toBe(true);

      // Tier 3 (24h = 86,400s)
      const tier3Result = calculateTapBotEarnings({
        lastClaimTimestampMs: now,
        currentTimestampMs: elapsed100h,
        currentEnergy: 1000,
        multitapLevel: 1,
        energyCapacityLevel: 1,
        rechargeSpeedLevel: 1,
        offlineExtenderTier: 3,
      });
      expect(tier3Result.effectiveSeconds).toBe(86400);
      expect(tier3Result.isCapped).toBe(true);
    });
  });
});
