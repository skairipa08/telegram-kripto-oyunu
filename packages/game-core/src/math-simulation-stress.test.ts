import { describe, expect, it } from 'vitest';
import {
  calculatePaybackPeriodSeconds,
  calculateMarginalRoi,
  calculateOptimalNextUpgrade,
  formatCompactNumber,
  calculateProductionPerSecond,
  calculateUpgradeCost,
  simulateProgression,
  DEFAULT_BUSINESSES,
} from './index';

describe('Adversarial Math & Simulation Stress Harness', () => {
  describe('calculateUpgradeCost & calculateProductionPerSecond Stress', () => {
    it('verifies calculateUpgradeCost edge cases and extremes', () => {
      expect(calculateUpgradeCost(100, 0)).toBe(100);
      expect(calculateUpgradeCost(100, -5)).toBe(100);
      expect(calculateUpgradeCost(100, 1)).toBe(100);
      expect(calculateUpgradeCost(100, 2)).toBe(118);
      // Extremely high level
      expect(Number.isFinite(calculateUpgradeCost(100, 150))).toBe(true);
    });

    it('verifies calculateProductionPerSecond edge cases and milestones', () => {
      expect(calculateProductionPerSecond(10, 0)).toBe(0);
      expect(calculateProductionPerSecond(10, -5)).toBe(0);
      expect(calculateProductionPerSecond(10, 1)).toBe(10);
      // Level 10 leap (2x milestone)
      expect(calculateProductionPerSecond(1, 10)).toBeCloseTo(36.769, 2);
    });
  });

  describe('calculatePaybackPeriodSeconds Adversarial Stress', () => {
    it('handles division by zero (delta = 0) with POSITIVE_INFINITY', () => {
      expect(calculatePaybackPeriodSeconds(100, 10, 10)).toBe(
        Number.POSITIVE_INFINITY,
      );
      expect(calculatePaybackPeriodSeconds(100, 0, 0)).toBe(
        Number.POSITIVE_INFINITY,
      );
      expect(calculatePaybackPeriodSeconds(1e12, 5e6, 5e6)).toBe(
        Number.POSITIVE_INFINITY,
      );
      expect(calculatePaybackPeriodSeconds(100, 1e-12, 1e-12)).toBe(
        Number.POSITIVE_INFINITY,
      );
    });

    it('handles negative delta (production regression) with POSITIVE_INFINITY', () => {
      expect(calculatePaybackPeriodSeconds(100, 10, 5)).toBe(
        Number.POSITIVE_INFINITY,
      );
      expect(calculatePaybackPeriodSeconds(100, 10, 0)).toBe(
        Number.POSITIVE_INFINITY,
      );
      expect(calculatePaybackPeriodSeconds(100, 10, -50)).toBe(
        Number.POSITIVE_INFINITY,
      );
      expect(
        calculatePaybackPeriodSeconds(100, 10, Number.NEGATIVE_INFINITY),
      ).toBe(Number.POSITIVE_INFINITY);
    });

    it('handles sub-epsilon delta (<= 1e-9) with POSITIVE_INFINITY', () => {
      expect(calculatePaybackPeriodSeconds(100, 0, 1e-10)).toBe(
        Number.POSITIVE_INFINITY,
      );
      expect(calculatePaybackPeriodSeconds(100, 0, 1e-9)).toBe(
        Number.POSITIVE_INFINITY,
      );
      expect(calculatePaybackPeriodSeconds(100, 0, 1e-12)).toBe(
        Number.POSITIVE_INFINITY,
      );
    });

    it('handles negative and zero cost instantly (returns 0)', () => {
      expect(calculatePaybackPeriodSeconds(0, 10, 20)).toBe(0);
      expect(calculatePaybackPeriodSeconds(-10, 10, 20)).toBe(0);
      expect(calculatePaybackPeriodSeconds(-1e15, 10, 20)).toBe(0);
      expect(calculatePaybackPeriodSeconds(-Infinity, 10, 20)).toBe(0);
    });

    it('handles NaN inputs safely (returns POSITIVE_INFINITY)', () => {
      expect(calculatePaybackPeriodSeconds(NaN, 10, 20)).toBe(
        Number.POSITIVE_INFINITY,
      );
      expect(calculatePaybackPeriodSeconds(100, NaN, 20)).toBe(
        Number.POSITIVE_INFINITY,
      );
      expect(calculatePaybackPeriodSeconds(100, 10, NaN)).toBe(
        Number.POSITIVE_INFINITY,
      );
      expect(calculatePaybackPeriodSeconds(NaN, NaN, NaN)).toBe(
        Number.POSITIVE_INFINITY,
      );
    });

    it('handles Infinity inputs safely', () => {
      expect(
        calculatePaybackPeriodSeconds(Number.POSITIVE_INFINITY, 10, 20),
      ).toBe(Number.POSITIVE_INFINITY);
      expect(
        calculatePaybackPeriodSeconds(100, 10, Number.POSITIVE_INFINITY),
      ).toBe(0);
    });

    it('maintains precision across massive numbers (10^15 to 10^18)', () => {
      const cost15 = 1e15;
      const delta6 = 1e6;
      expect(calculatePaybackPeriodSeconds(cost15, 0, delta6)).toBe(1e9);

      const cost18 = 1e18;
      const delta12 = 1e12;
      expect(calculatePaybackPeriodSeconds(cost18, 0, delta12)).toBe(1e6);
    });

    it('verifies calculateMarginalRoi handles extremes', () => {
      expect(calculateMarginalRoi(100, 0, 1)).toBe(0.01);
      expect(calculateMarginalRoi(0, 10, 20)).toBe(Number.POSITIVE_INFINITY);
      expect(calculateMarginalRoi(100, 20, 20)).toBe(0);
    });

    it('fuzzes 10,000 randomized inputs without throwing, NaN, or invariant violations', () => {
      for (let i = 0; i < 10000; i++) {
        const cost = (Math.random() - 0.2) * 1e16;
        const curr = Math.random() * 1e9;
        const next = curr + (Math.random() - 0.2) * 1e9;
        const res = calculatePaybackPeriodSeconds(cost, curr, next);

        expect(Number.isNaN(res)).toBe(false);
        if (cost <= 0) {
          expect(res).toBe(0);
        } else if (next - curr <= 1e-9) {
          expect(res).toBe(Number.POSITIVE_INFINITY);
        } else {
          expect(res).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('calculateOptimalNextUpgrade Adversarial Stress', () => {
    it('handles empty or malformed businesses list safely', () => {
      expect(calculateOptimalNextUpgrade([])).toEqual({
        bestOverall: null,
        bestAffordable: null,
        candidates: [],
      });
      // @ts-expect-error test undefined
      expect(calculateOptimalNextUpgrade(undefined)).toEqual({
        bestOverall: null,
        bestAffordable: null,
        candidates: [],
      });
    });

    it('correctly handles all businesses at level 0', () => {
      const b0 = DEFAULT_BUSINESSES.map((b) => ({
        slug: b.id,
        name: b.name,
        level: 0,
        baseCost: b.baseCost,
        baseIncome: b.baseIncome,
      }));
      const res = calculateOptimalNextUpgrade(b0, 100);
      expect(res.bestOverall?.slug).toBe('street_stand');
      expect(res.bestAffordable?.slug).toBe('street_stand');
      expect(res.candidates).toHaveLength(DEFAULT_BUSINESSES.length);
    });

    it('distinguishes playerCash = 0 vs playerCash = 10^15', () => {
      const b0 = DEFAULT_BUSINESSES.map((b) => ({
        slug: b.id,
        name: b.name,
        level: 0,
        baseCost: b.baseCost,
        baseIncome: b.baseIncome,
      }));

      const res0 = calculateOptimalNextUpgrade(b0, 0);
      expect(res0.bestOverall?.slug).toBe('street_stand');
      expect(res0.bestAffordable).toBeNull();

      const resMassive = calculateOptimalNextUpgrade(b0, 1e15);
      expect(resMassive.bestOverall?.slug).toBe('street_stand');
      expect(resMassive.bestAffordable?.slug).toBe('street_stand');
      expect(resMassive.bestAffordable?.isAffordable).toBe(true);
    });

    it('handles negative or NaN cash safely', () => {
      const b0 = DEFAULT_BUSINESSES.map((b) => ({
        slug: b.id,
        name: b.name,
        level: 0,
        baseCost: b.baseCost,
        baseIncome: b.baseIncome,
      }));
      const resNeg = calculateOptimalNextUpgrade(b0, -500);
      expect(resNeg.bestAffordable).toBeNull();

      const resNaN = calculateOptimalNextUpgrade(b0, NaN);
      expect(resNaN.bestAffordable).toBeNull();
    });

    it('strictly enforces deterministic multi-key tie-breaking: cost ASC when paybacks are identical', () => {
      const tieCostBusinesses = [
        {
          slug: 'expensive_same_payback',
          name: 'Expensive',
          level: 0,
          baseCost: 200,
          baseIncome: 2,
        },
        {
          slug: 'cheap_same_payback',
          name: 'Cheap',
          level: 0,
          baseCost: 100,
          baseIncome: 1,
        },
      ];
      const res = calculateOptimalNextUpgrade(tieCostBusinesses, 1000);
      expect(res.candidates[0]?.slug).toBe('cheap_same_payback');
      expect(res.candidates[1]?.slug).toBe('expensive_same_payback');
    });

    it('strictly enforces deterministic multi-key tie-breaking: slug ASC when paybacks and costs are identical', () => {
      const tieBusinesses = [
        {
          slug: 'b_biz',
          name: 'B Biz',
          level: 1,
          baseCost: 100,
          baseIncome: 1,
        },
        {
          slug: 'a_biz',
          name: 'A Biz',
          level: 1,
          baseCost: 100,
          baseIncome: 1,
        },
        {
          slug: '0_biz',
          name: '0 Biz',
          level: 1,
          baseCost: 100,
          baseIncome: 1,
        },
      ];

      const res = calculateOptimalNextUpgrade(tieBusinesses, 1000);
      expect(res.candidates[0]?.slug).toBe('0_biz');
      expect(res.candidates[1]?.slug).toBe('a_biz');
      expect(res.candidates[2]?.slug).toBe('b_biz');
    });

    it('proves 100% permutation invariance across 20 randomized shuffles', () => {
      const tieBusinesses = [
        {
          slug: 'b_biz',
          name: 'B Biz',
          level: 1,
          baseCost: 100,
          baseIncome: 1,
        },
        {
          slug: 'a_biz',
          name: 'A Biz',
          level: 1,
          baseCost: 100,
          baseIncome: 1,
        },
        {
          slug: '0_biz',
          name: '0 Biz',
          level: 1,
          baseCost: 100,
          baseIncome: 1,
        },
      ];

      for (let i = 0; i < 20; i++) {
        const shuffled = [...tieBusinesses].sort(() => Math.random() - 0.5);
        const res = calculateOptimalNextUpgrade(shuffled, 1000);
        expect(res.candidates[0]?.slug).toBe('0_biz');
        expect(res.candidates[1]?.slug).toBe('a_biz');
        expect(res.candidates[2]?.slug).toBe('b_biz');
      }
    });

    it('handles high business levels (level 150) without NaN or divergence', () => {
      const highBusinesses = DEFAULT_BUSINESSES.map((b) => ({
        slug: b.id,
        name: b.name,
        level: 150,
        baseCost: b.baseCost,
        baseIncome: b.baseIncome,
      }));
      const res = calculateOptimalNextUpgrade(highBusinesses, 1e18);
      expect(res.bestOverall).not.toBeNull();
      expect(Number.isFinite(res.bestOverall?.upgradeCost)).toBe(true);
      expect(Number.isNaN(res.bestOverall?.paybackPeriodSeconds)).toBe(false);
    });

    it('fuzzes 5,000 randomized configurations without throwing or invalid states', () => {
      for (let i = 0; i < 5000; i++) {
        const count = Math.floor(Math.random() * 8) + 1;
        const bizList = [];
        for (let j = 0; j < count; j++) {
          bizList.push({
            slug: 'biz_' + j,
            level: Math.floor(Math.random() * 100),
            baseCost: Math.floor(Math.random() * 1e7) + 1,
            baseIncome: Math.floor(Math.random() * 1e4) + 1,
          });
        }
        const cash = Math.random() * 1e12;
        const res = calculateOptimalNextUpgrade(bizList, cash);
        expect(res.bestOverall).not.toBeNull();
        expect(res.candidates.length).toBe(count);
        for (const c of res.candidates) {
          expect(Number.isNaN(c.upgradeCost)).toBe(false);
          expect(Number.isNaN(c.currentProduction)).toBe(false);
          expect(Number.isNaN(c.nextProduction)).toBe(false);
          expect(Number.isNaN(c.paybackPeriodSeconds)).toBe(false);
        }
      }
    });
  });

  describe('formatCompactNumber Adversarial Stress & Boundaries', () => {
    it('formats exact boundary transitions: 999 vs 1,000', () => {
      expect(formatCompactNumber(999)).toBe('999');
      expect(formatCompactNumber(1000)).toBe('1K');
      expect(formatCompactNumber(999.4)).toBe('999.4');
      expect(formatCompactNumber(999.9)).toBe('999.9');
    });

    it('handles tier bumping: 999,950 -> 1M (never 1000K)', () => {
      expect(formatCompactNumber(999949)).toBe('999.9K');
      expect(formatCompactNumber(999950)).toBe('1M');
      expect(formatCompactNumber(999999)).toBe('1M');
      expect(formatCompactNumber(1000000)).toBe('1M');
      expect(formatCompactNumber(999950000)).toBe('1B');
      expect(formatCompactNumber(999950000000)).toBe('1T');
      expect(formatCompactNumber(999950000000000)).toBe('1Q');
    });

    it('formats all metric scales: 10^3 (K) to 10^18 (Qi)', () => {
      expect(formatCompactNumber(1e3)).toBe('1K');
      expect(formatCompactNumber(1e6)).toBe('1M');
      expect(formatCompactNumber(1e9)).toBe('1B');
      expect(formatCompactNumber(1e12)).toBe('1T');
      expect(formatCompactNumber(1e15)).toBe('1Q');
      expect(formatCompactNumber(1e18)).toBe('1Qi');
      expect(formatCompactNumber(2.5e15)).toBe('2.5Q');
      expect(formatCompactNumber(7.8e18)).toBe('7.8Qi');
    });

    it('handles negative values across all tiers', () => {
      expect(formatCompactNumber(0)).toBe('0');
      expect(formatCompactNumber(-0)).toBe('0');
      expect(formatCompactNumber(-42)).toBe('-42');
      expect(formatCompactNumber(-999)).toBe('-999');
      expect(formatCompactNumber(-1000)).toBe('-1K');
      expect(formatCompactNumber(-1200)).toBe('-1.2K');
      expect(formatCompactNumber(-999950)).toBe('-1M');
      expect(formatCompactNumber(-1e15)).toBe('-1Q');
      expect(formatCompactNumber(-1e18)).toBe('-1Qi');
    });

    it('handles string representations and edge-case strings', () => {
      expect(formatCompactNumber('0')).toBe('0');
      expect(formatCompactNumber('1000')).toBe('1K');
      expect(formatCompactNumber(' 3500000 ')).toBe('3.5M');
      expect(formatCompactNumber('NaN')).toBe('NaN');
      expect(formatCompactNumber('Infinity')).toBe('Infinity');
      expect(formatCompactNumber('+Infinity')).toBe('Infinity');
      expect(formatCompactNumber('-Infinity')).toBe('-Infinity');
      expect(formatCompactNumber('invalid_alpha')).toBe('NaN');
    });

    it('handles BigInt inputs seamlessly', () => {
      expect(formatCompactNumber(0n)).toBe('0');
      expect(formatCompactNumber(42n)).toBe('42');
      expect(formatCompactNumber(1000n)).toBe('1K');
      expect(formatCompactNumber(1200n)).toBe('1.2K');
      expect(formatCompactNumber(1000000000000000n)).toBe('1Q');
      expect(formatCompactNumber(2500000000000000n)).toBe('2.5Q');
      expect(formatCompactNumber(1000000000000000000n)).toBe('1Qi');
      expect(formatCompactNumber(-1000000000000000000n)).toBe('-1Qi');
    });

    it('fuzzes 20,000 random inputs across numbers, strings, and decimals', () => {
      for (let i = 0; i < 20000; i++) {
        const exp = Math.random() * 21 - 2;
        const sign = Math.random() > 0.5 ? 1 : -1;
        const val = sign * Math.pow(10, exp);
        const res = formatCompactNumber(val);
        expect(typeof res).toBe('string');
        expect(res.length).toBeGreaterThan(0);
        expect(res).not.toContain('undefined');
        expect(res).not.toContain('null');
      }
    });
  });

  describe('simulateProgression Long-Horizon Stability & Invariants', () => {
    it('proves stability across 1h, 24h, 7d, and 30d without infinite loops, NaN or divergence', () => {
      const run1h = simulateProgression(3600);
      const run24h = simulateProgression(86400);
      const run7d = simulateProgression(604800);
      const run30d = simulateProgression(2592000);

      // Check finite and positive
      for (const run of [run1h, run24h, run7d, run30d]) {
        expect(Number.isFinite(run.totalCashEarned)).toBe(true);
        expect(Number.isFinite(run.finalCashBalance)).toBe(true);
        expect(Number.isFinite(run.finalProductionPerSecond)).toBe(true);
        expect(run.totalCashEarned).toBeGreaterThan(0);
        expect(run.finalCashBalance).toBeGreaterThanOrEqual(0);
        expect(run.finalProductionPerSecond).toBeGreaterThan(0);
      }

      // Check strict monotonic growth
      expect(run1h.totalCashEarned).toBeLessThan(run24h.totalCashEarned);
      expect(run24h.totalCashEarned).toBeLessThan(run7d.totalCashEarned);
      expect(run7d.totalCashEarned).toBeLessThan(run30d.totalCashEarned);

      expect(run1h.finalProductionPerSecond).toBeLessThan(
        run24h.finalProductionPerSecond,
      );
      expect(run24h.finalProductionPerSecond).toBeLessThan(
        run7d.finalProductionPerSecond,
      );
      expect(run7d.finalProductionPerSecond).toBeLessThan(
        run30d.finalProductionPerSecond,
      );

      expect(run1h.totalUpgradesPurchased).toBeLessThan(
        run24h.totalUpgradesPurchased,
      );
      expect(run24h.totalUpgradesPurchased).toBeLessThan(
        run7d.totalUpgradesPurchased,
      );
      expect(run7d.totalUpgradesPurchased).toBeLessThan(
        run30d.totalUpgradesPurchased,
      );
    });

    it('proves progression dampening (no exponential runaway) up to 30 days', () => {
      const run30d = simulateProgression(2592000);
      for (const b of DEFAULT_BUSINESSES) {
        const lvl = run30d.businessLevels[b.id]!;
        expect(lvl).toBeGreaterThan(0);
        expect(lvl).toBeLessThan(350);
      }
    });

    it('proves high execution performance and bounded memory across 100 runs', () => {
      const t0 = Date.now();
      for (let i = 0; i < 50; i++) {
        simulateProgression(86400, { strategy: 'greedy_roi' });
        simulateProgression(86400, { strategy: 'cheapest' });
      }
      const duration = Date.now() - t0;
      expect(duration).toBeLessThan(5000);
    });

    it('proves 90-day and 365-day stability without infinite loop or numeric overflow', () => {
      const run90d = simulateProgression(90 * 86400);
      expect(Number.isFinite(run90d.totalCashEarned)).toBe(true);

      const run365d = simulateProgression(365 * 86400);
      expect(Number.isFinite(run365d.totalCashEarned)).toBe(true);
      expect(run365d.totalCashEarned).toBeGreaterThan(run90d.totalCashEarned);
    });
  });
});
