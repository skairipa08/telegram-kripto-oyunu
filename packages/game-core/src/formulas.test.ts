import { describe, expect, it } from 'vitest';
import {
  calculateMilestoneMultiplier,
  calculateOfflineEarnings,
  calculateProductionPerSecond,
  calculateReferralWhaleFactor,
  calculateSRU,
  calculateTotalProduction,
  calculateUpgradeCost,
  calculatePaybackPeriodSeconds,
  calculateMarginalRoi,
  calculateOptimalNextUpgrade,
  formatCompactNumber,
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
    it('includes all 16 canonical businesses in order', () => {
      expect(DEFAULT_BUSINESSES).toHaveLength(16);
      expect(DEFAULT_BUSINESSES.slice(0, 6).map((b) => b.id)).toEqual([
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
      expect(DEFAULT_BUSINESSES[15]?.id).toBe('galactic_federation');
    });
  });

  describe('calculatePaybackPeriodSeconds', () => {
    it('returns 0 for zero or negative upgrade costs', () => {
      expect(calculatePaybackPeriodSeconds(0, 10, 20)).toBe(0);
      expect(calculatePaybackPeriodSeconds(-100, 10, 20)).toBe(0);
    });

    it('returns Infinity when production delta is non-positive', () => {
      expect(calculatePaybackPeriodSeconds(100, 20, 20)).toBe(
        Number.POSITIVE_INFINITY,
      );
      expect(calculatePaybackPeriodSeconds(100, 20, 15)).toBe(
        Number.POSITIVE_INFINITY,
      );
    });

    it('returns Infinity for NaN inputs or infinite costs', () => {
      expect(calculatePaybackPeriodSeconds(NaN, 10, 20)).toBe(
        Number.POSITIVE_INFINITY,
      );
      expect(calculatePaybackPeriodSeconds(100, NaN, 20)).toBe(
        Number.POSITIVE_INFINITY,
      );
      expect(calculatePaybackPeriodSeconds(100, 10, NaN)).toBe(
        Number.POSITIVE_INFINITY,
      );
      expect(
        calculatePaybackPeriodSeconds(Number.POSITIVE_INFINITY, 10, 20),
      ).toBe(Number.POSITIVE_INFINITY);
    });

    it('returns 0 when next production is infinite', () => {
      expect(
        calculatePaybackPeriodSeconds(100, 10, Number.POSITIVE_INFINITY),
      ).toBe(0);
    });

    it('computes exact payback for unlocking all 6 canonical businesses at Level 0 -> 1', () => {
      // 1. Street Stand: Cost 100, Prod 0 -> 1 => 100.00s
      expect(calculatePaybackPeriodSeconds(100, 0, 1)).toBe(100);

      // 2. Cafe: Cost 2500, Prod 0 -> 12 => 208.33s
      expect(
        Number(calculatePaybackPeriodSeconds(2500, 0, 12).toFixed(2)),
      ).toBe(208.33);

      // 3. Delivery Hub: Cost 25000, Prod 0 -> 90 => 277.78s
      expect(
        Number(calculatePaybackPeriodSeconds(25000, 0, 90).toFixed(2)),
      ).toBe(277.78);

      // 4. Factory: Cost 250000, Prod 0 -> 600 => 416.67s
      expect(
        Number(calculatePaybackPeriodSeconds(250000, 0, 600).toFixed(2)),
      ).toBe(416.67);

      // 5. Tech Company: Cost 3000000, Prod 0 -> 5000 => 600.00s
      expect(calculatePaybackPeriodSeconds(3000000, 0, 5000)).toBe(600);

      // 6. Global Holding: Cost 50000000, Prod 0 -> 60000 => 833.33s
      expect(
        Number(calculatePaybackPeriodSeconds(50000000, 0, 60000).toFixed(2)),
      ).toBe(833.33);
    });

    it('verifies that milestone level 10 leap drastically reduces payback period', () => {
      // Street Stand: Level 9 -> 10
      // Cost to level 10: 100 * 1.18^9 = 443.54 -> 444
      const costL10 = calculateUpgradeCost(100, 10);
      const prodL9 = calculateProductionPerSecond(1, 9);
      const prodL10 = calculateProductionPerSecond(1, 10);
      const deltaProd = prodL10 - prodL9;

      expect(costL10).toBe(444);
      expect(Number(deltaProd.toFixed(2))).toBe(21.31);
      const payback = calculatePaybackPeriodSeconds(costL10, prodL9, prodL10);
      expect(Number(payback.toFixed(2))).toBe(20.84);
    });
  });

  describe('calculateMarginalRoi', () => {
    it('returns 1 / paybackPeriodSeconds', () => {
      expect(calculateMarginalRoi(100, 0, 1)).toBe(0.01);
      expect(calculateMarginalRoi(200, 10, 20)).toBe(10 / 200);
    });

    it('returns 0 when payback is infinite', () => {
      expect(calculateMarginalRoi(100, 20, 20)).toBe(0);
    });

    it('returns Infinity when cost is 0', () => {
      expect(calculateMarginalRoi(0, 10, 20)).toBe(Number.POSITIVE_INFINITY);
    });
  });

  describe('calculateOptimalNextUpgrade', () => {
    it('returns null recommendations when businesses list is empty', () => {
      const result = calculateOptimalNextUpgrade([]);
      expect(result.bestOverall).toBeNull();
      expect(result.bestAffordable).toBeNull();
      expect(result.candidates).toEqual([]);
    });

    it('identifies Street Stand as bestOverall and bestAffordable at starter cash (100)', () => {
      const businesses = DEFAULT_BUSINESSES.map((b) => ({
        slug: b.id,
        name: b.name,
        level: 0,
        baseCost: b.baseCost,
        baseIncome: b.baseIncome,
      }));

      const result = calculateOptimalNextUpgrade(businesses, 100);
      expect(result.bestOverall?.slug).toBe('street_stand');
      expect(result.bestOverall?.upgradeCost).toBe(100);
      expect(result.bestOverall?.paybackPeriodSeconds).toBe(100);
      expect(result.bestOverall?.isAffordable).toBe(true);

      expect(result.bestAffordable?.slug).toBe('street_stand');
      expect(result.bestAffordable?.isAffordable).toBe(true);
    });

    it('marks bestAffordable as null if player has 0 cash and no upgrade is free', () => {
      const businesses = DEFAULT_BUSINESSES.map((b) => ({
        slug: b.id,
        name: b.name,
        level: 0,
        baseCost: b.baseCost,
        baseIncome: b.baseIncome,
      }));

      const result = calculateOptimalNextUpgrade(businesses, 0);
      expect(result.bestOverall?.slug).toBe('street_stand');
      expect(result.bestOverall?.isAffordable).toBe(false);
      expect(result.bestAffordable).toBeNull();
    });

    it('prioritizes milestone breakthrough upgrades due to lower payback period', () => {
      // Street Stand at level 9 (payback ~20.8s) vs Cafe at level 0 (payback 208.3s)
      const businesses = [
        {
          slug: 'street_stand',
          name: 'Street Stand',
          level: 9,
          baseCost: 100,
          baseIncome: 1,
        },
        {
          slug: 'cafe',
          name: 'Cafe',
          level: 0,
          baseCost: 2500,
          baseIncome: 12,
        },
      ];

      const result = calculateOptimalNextUpgrade(businesses, 5000);
      expect(result.bestOverall?.slug).toBe('street_stand');
      expect(result.bestOverall?.paybackPeriodSeconds).toBeLessThan(30);
    });
  });

  describe('formatCompactNumber', () => {
    it('formats raw integers under 1,000 without suffixes', () => {
      expect(formatCompactNumber(0)).toBe('0');
      expect(formatCompactNumber(42)).toBe('42');
      expect(formatCompactNumber(999)).toBe('999');
    });

    it('formats K, M, B, T tiers with clean precision', () => {
      expect(formatCompactNumber(1000)).toBe('1K');
      expect(formatCompactNumber(1200)).toBe('1.2K');
      expect(formatCompactNumber(9500)).toBe('9.5K');
      expect(formatCompactNumber(1000000)).toBe('1M');
      expect(formatCompactNumber(3500000)).toBe('3.5M');
      expect(formatCompactNumber(12800000000)).toBe('12.8B');
      expect(formatCompactNumber(4500000000000)).toBe('4.5T');
    });

    it('formats Quadrillion (10^15) cleanly for numbers and BigInts', () => {
      expect(formatCompactNumber(1000000000000000)).toBe('1Q');
      expect(formatCompactNumber(2500000000000000)).toBe('2.5Q');
      expect(formatCompactNumber(1000000000000000n)).toBe('1Q');
      expect(formatCompactNumber(2500000000000000n)).toBe('2.5Q');
    });

    it('safely handles tier-bumping edge cases (e.g. 999950 -> 1M, never 1000K)', () => {
      expect(formatCompactNumber(999950)).toBe('1M');
      expect(formatCompactNumber(999950000)).toBe('1B');
    });

    it('preserves negative signs', () => {
      expect(formatCompactNumber(-1200)).toBe('-1.2K');
      expect(formatCompactNumber(-3500000)).toBe('-3.5M');
    });

    it('safely handles special strings and non-finite values', () => {
      expect(formatCompactNumber('NaN')).toBe('NaN');
      expect(formatCompactNumber('Infinity')).toBe('Infinity');
      expect(formatCompactNumber('-Infinity')).toBe('-Infinity');
      expect(formatCompactNumber(NaN)).toBe('NaN');
      expect(formatCompactNumber(Infinity)).toBe('Infinity');
      expect(formatCompactNumber(-Infinity)).toBe('-Infinity');
    });
  });
});
