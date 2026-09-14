import { describe, expect, it } from 'vitest';
import {
  calculateMilestoneMultiplier,
  calculateOfflineEarnings,
  calculateProductionPerSecond,
  calculateReferralWhaleFactor,
  calculateSRU,
  calculateTotalProduction,
  calculateUpgradeCost,
} from './formulas';
import { DEFAULT_BUSINESSES } from './config';

describe('game-core formulas', () => {
  describe('calculateUpgradeCost', () => {
    it('returns base cost for level 0 or 1', () => {
      expect(calculateUpgradeCost(100, 0)).toBe(100);
      expect(calculateUpgradeCost(100, 1)).toBe(100);
      expect(calculateUpgradeCost(2500, 1)).toBe(2500);
    });

    it('scales deterministically at 1.18 rate', () => {
      // Level 2: 100 * 1.18^1 = 118
      expect(calculateUpgradeCost(100, 2)).toBe(118);
      // Level 3: 100 * 1.18^2 = 139.24 -> 139
      expect(calculateUpgradeCost(100, 3)).toBe(139);
      // Level 10: 100 * 1.18^9 = 443.54... -> 444
      expect(calculateUpgradeCost(100, 10)).toBe(444);
    });
  });

  describe('calculateMilestoneMultiplier', () => {
    it('returns 1 for levels below 10', () => {
      expect(calculateMilestoneMultiplier(0)).toBe(1);
      expect(calculateMilestoneMultiplier(1)).toBe(1);
      expect(calculateMilestoneMultiplier(9)).toBe(1);
    });

    it('doubles at 10, 25, 50, 100', () => {
      expect(calculateMilestoneMultiplier(10)).toBe(2);
      expect(calculateMilestoneMultiplier(24)).toBe(2);
      expect(calculateMilestoneMultiplier(25)).toBe(4);
      expect(calculateMilestoneMultiplier(49)).toBe(4);
      expect(calculateMilestoneMultiplier(50)).toBe(8);
      expect(calculateMilestoneMultiplier(99)).toBe(8);
      expect(calculateMilestoneMultiplier(100)).toBe(16);
      expect(calculateMilestoneMultiplier(149)).toBe(16);
    });

    it('multiplies by 1.5 every +50 levels after 100', () => {
      expect(calculateMilestoneMultiplier(150)).toBe(24); // 16 * 1.5
      expect(calculateMilestoneMultiplier(199)).toBe(24);
      expect(calculateMilestoneMultiplier(200)).toBe(36); // 24 * 1.5
      expect(calculateMilestoneMultiplier(250)).toBe(54); // 36 * 1.5
    });
  });

  describe('calculateProductionPerSecond', () => {
    it('returns 0 for level 0', () => {
      expect(calculateProductionPerSecond(10, 0)).toBe(0);
    });

    it('calculates base production for level 1', () => {
      // 1 * 1 * 1.07^0 * 1 = 1
      expect(calculateProductionPerSecond(1, 1)).toBe(1);
      // Cafe base: 12 * 1 * 1.07^0 * 1 = 12
      expect(calculateProductionPerSecond(12, 1)).toBe(12);
    });

    it('accounts for level growth and milestone multiplier at level 10', () => {
      // 1 * 10 * 1.07^9 * 2 = 10 * 1.838459 * 2 = 36.769...
      const prod = calculateProductionPerSecond(1, 10);
      expect(prod).toBeCloseTo(36.769, 2);
    });
  });

  describe('calculateTotalProduction', () => {
    it('aggregates production across businesses', () => {
      const businesses = [
        { baseIncome: 1, level: 1 }, // 1
        { baseIncome: 12, level: 1 }, // 12
        { baseIncome: 90, level: 0 }, // 0
      ];
      expect(calculateTotalProduction(businesses)).toBe(13);
    });
  });

  describe('calculateOfflineEarnings', () => {
    it('calculates earnings below cap', () => {
      const result = calculateOfflineEarnings(10, 100, 14400);
      expect(result.earned).toBe(1000);
      expect(result.effectiveSeconds).toBe(100);
      expect(result.isCapped).toBe(false);
    });

    it('truncates at offline cap', () => {
      const result = calculateOfflineEarnings(10, 20000, 14400);
      expect(result.earned).toBe(144000);
      expect(result.effectiveSeconds).toBe(14400);
      expect(result.isCapped).toBe(true);
    });

    it('handles negative or zero elapsed time safely', () => {
      const zero = calculateOfflineEarnings(10, 0, 14400);
      expect(zero.earned).toBe(0);
      expect(zero.effectiveSeconds).toBe(0);
      expect(zero.isCapped).toBe(false);

      const negative = calculateOfflineEarnings(10, -50, 14400);
      expect(negative.earned).toBe(0);
      expect(negative.effectiveSeconds).toBe(0);
      expect(negative.isCapped).toBe(false);
    });
  });

  describe('calculateSRU', () => {
    it('matches Blueprint emission curve benchmarks', () => {
      // Blueprint benchmarks:
      // <= 100: 500
      expect(calculateSRU(50)).toBe(500);
      expect(calculateSRU(100)).toBe(500);

      // 1,000: ~397
      expect(calculateSRU(1000)).toBe(397);

      // 10,000: ~315
      expect(calculateSRU(10000)).toBe(315);

      // 100,000: ~251
      expect(calculateSRU(100000)).toBe(251);

      // 1,000,000: ~199
      expect(calculateSRU(1000000)).toBe(199);

      // 10,000,000: ~158
      expect(calculateSRU(10000000)).toBe(158);

      // 100,000,000: ~126
      expect(calculateSRU(100000000)).toBe(126);

      // Very high QAP reaches 100 floor
      expect(calculateSRU(2000000000)).toBe(100);
    });
  });

  describe('calculateReferralWhaleFactor', () => {
    it('returns 1.0 for up to 20 referrals', () => {
      expect(calculateReferralWhaleFactor(0)).toBe(1.0);
      expect(calculateReferralWhaleFactor(10)).toBe(1.0);
      expect(calculateReferralWhaleFactor(20)).toBe(1.0);
    });

    it('scales by sqrt(20 / Q) for Q > 20', () => {
      // Q = 80 -> sqrt(20/80) = sqrt(1/4) = 0.5
      expect(calculateReferralWhaleFactor(80)).toBe(0.5);
    });

    it('respects the 0.25 floor', () => {
      // Q = 320 -> sqrt(20/320) = sqrt(1/16) = 0.25
      expect(calculateReferralWhaleFactor(320)).toBe(0.25);
      // Q = 1000 -> 0.25
      expect(calculateReferralWhaleFactor(1000)).toBe(0.25);
    });
  });

  describe('DEFAULT_BUSINESSES', () => {
    it('includes all 6 canonical businesses in order', () => {
      expect(DEFAULT_BUSINESSES).toHaveLength(6);
      expect(DEFAULT_BUSINESSES.map((b) => b.id)).toEqual([
        'street_stand',
        'cafe',
        'delivery_hub',
        'factory',
        'tech_company',
        'global_holding',
      ]);
      expect(DEFAULT_BUSINESSES[0]?.baseCost).toBe(100);
      expect(DEFAULT_BUSINESSES[0]?.baseIncome).toBe(1);
      expect(DEFAULT_BUSINESSES[5]?.baseCost).toBe(50000000);
      expect(DEFAULT_BUSINESSES[5]?.baseIncome).toBe(60000);
    });
  });
});
