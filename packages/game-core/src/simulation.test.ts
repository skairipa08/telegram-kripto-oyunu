import { describe, expect, it } from 'vitest';
import { simulateProgression } from './simulation';
import { DEFAULT_BUSINESSES } from './config';

describe('Deterministic Economy Simulation Harness', () => {
  it('produces 100% deterministic outputs when run multiple times with the same parameters', () => {
    const run1 = simulateProgression(86400, {
      strategy: 'greedy_roi',
      isReferred: false,
    });
    const run2 = simulateProgression(86400, {
      strategy: 'greedy_roi',
      isReferred: false,
    });

    expect(run1.totalCashEarned).toBe(run2.totalCashEarned);
    expect(run1.finalCashBalance).toBe(run2.finalCashBalance);
    expect(run1.finalProductionPerSecond).toBe(run2.finalProductionPerSecond);
    expect(run1.unlockedBusinessCount).toBe(run2.unlockedBusinessCount);
    expect(run1.totalUpgradesPurchased).toBe(run2.totalUpgradesPurchased);
    expect(run1.businessLevels).toEqual(run2.businessLevels);
    expect(run1.timeToUnlockSeconds).toEqual(run2.timeToUnlockSeconds);
  });

  it('verifies strict monotonic progression across 1h, 24h, 7d, and 30d horizons', () => {
    const run1h = simulateProgression(3600);
    const run24h = simulateProgression(86400);
    const run7d = simulateProgression(604800);
    const run30d = simulateProgression(2592000);

    // Total cash strictly increases
    expect(run1h.totalCashEarned).toBeLessThan(run24h.totalCashEarned);
    expect(run24h.totalCashEarned).toBeLessThan(run7d.totalCashEarned);
    expect(run7d.totalCashEarned).toBeLessThan(run30d.totalCashEarned);

    // Production rate strictly increases
    expect(run1h.finalProductionPerSecond).toBeLessThan(
      run24h.finalProductionPerSecond,
    );
    expect(run24h.finalProductionPerSecond).toBeLessThan(
      run7d.finalProductionPerSecond,
    );
    expect(run7d.finalProductionPerSecond).toBeLessThan(
      run30d.finalProductionPerSecond,
    );

    // Total upgrades purchased strictly increases
    expect(run1h.totalUpgradesPurchased).toBeLessThan(
      run24h.totalUpgradesPurchased,
    );
    expect(run24h.totalUpgradesPurchased).toBeLessThan(
      run7d.totalUpgradesPurchased,
    );
    expect(run7d.totalUpgradesPurchased).toBeLessThan(
      run30d.totalUpgradesPurchased,
    );

    // All 6 businesses unlocked in sequence
    expect(run24h.unlockedBusinessCount).toBe(6);
    expect(run7d.unlockedBusinessCount).toBe(6);
    expect(run30d.unlockedBusinessCount).toBe(6);

    const unlocks = run24h.timeToUnlockSeconds;
    expect(unlocks['street_stand']).toBe(0);
    expect(unlocks['cafe']).toBeLessThan(unlocks['delivery_hub']!);
    expect(unlocks['delivery_hub']).toBeLessThan(unlocks['factory']!);
    expect(unlocks['factory']).toBeLessThan(unlocks['tech_company']!);
    expect(unlocks['tech_company']).toBeLessThan(unlocks['global_holding']!);
  });

  it('demonstrates the impact of Convenience Pass in casual 8-hour check-in sessions', () => {
    const run = simulateProgression(86400);
    const impact = run.conveniencePassImpact;

    // Free player wastes 12h out of 24h because 8h - 4h cap = 4h wasted per 8h session (3 sessions = 12h)
    expect(impact.wastedOfflineSecondsFree).toBe(12 * 3600);

    // Pass player wastes 0h because 8h <= 12h cap
    expect(impact.wastedOfflineSecondsPass).toBe(0);

    // Pass player preserves significantly more cash
    expect(impact.cashEarnedPass).toBeGreaterThan(impact.cashEarnedFree);
    expect(impact.efficiencyGainMultiplier).toBeGreaterThan(1.0);
  });

  it('proves anti-P2W safety: Convenience Pass yields 0% advantage when check-ins are at or within the free cap', () => {
    // Both players check in every 4 hours (14,400s)
    const runFree = simulateProgression(86400, {
      claimIntervalSeconds: 14400,
      hasConveniencePass: false,
    });
    const runPass = simulateProgression(86400, {
      claimIntervalSeconds: 14400,
      hasConveniencePass: true,
    });

    expect(runFree.totalCashEarned).toBe(runPass.totalCashEarned);
    expect(runFree.finalProductionPerSecond).toBe(
      runPass.finalProductionPerSecond,
    );
    expect(runFree.businessLevels).toEqual(runPass.businessLevels);
  });

  it('verifies anti-inflation stability: 30-day progression does not experience runaway breakdown', () => {
    const run30d = simulateProgression(2592000);

    expect(Number.isFinite(run30d.totalCashEarned)).toBe(true);
    expect(Number.isFinite(run30d.finalCashBalance)).toBe(true);
    expect(Number.isFinite(run30d.finalProductionPerSecond)).toBe(true);
    expect(Number.isNaN(run30d.totalCashEarned)).toBe(false);

    for (const b of DEFAULT_BUSINESSES) {
      const lvl = run30d.businessLevels[b.id]!;
      expect(lvl).toBeGreaterThan(0);
      expect(lvl).toBeLessThan(250); // Pacing dampening prevents level explosion
    }
  });

  it('supports alternative playstyle strategies (cheapest and balanced)', () => {
    const runRoi = simulateProgression(3600, { strategy: 'greedy_roi' });
    const runCheapest = simulateProgression(3600, { strategy: 'cheapest' });
    const runBalanced = simulateProgression(3600, { strategy: 'balanced' });

    expect(runRoi.unlockedBusinessCount).toBeGreaterThan(0);
    expect(runCheapest.unlockedBusinessCount).toBeGreaterThan(0);
    expect(runBalanced.unlockedBusinessCount).toBeGreaterThan(0);

    // Greedy ROI achieves higher or equal production compared to naive cheapest strategy
    expect(runRoi.finalProductionPerSecond).toBeGreaterThanOrEqual(
      runCheapest.finalProductionPerSecond,
    );
  });
});
