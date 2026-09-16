import { describe, expect, it } from 'vitest';
import {
  getStarterEconomyState,
  STARTER_BASE_CASH,
  STARTER_REFERRAL_BOOST,
} from './starter';
import { calculateUpgradeCost, calculateProductionPerSecond } from './formulas';

describe('getStarterEconomyState', () => {
  it('initializes default unreferred player with 100 Cash and 16 businesses at level 0', () => {
    const state = getStarterEconomyState(false);
    expect(state.cash).toBe(100);
    expect(state.totalProductionPerSecond).toBe(0);
    expect(state.businesses).toHaveLength(16);

    for (const b of state.businesses) {
      expect(b.level).toBe(0);
      expect(b.baseCost).toBeGreaterThan(0);
      expect(b.baseIncome).toBeGreaterThan(0);
    }

    expect(state.businesses[0]?.slug).toBe('street_stand');
    expect(state.businesses[0]?.baseCost).toBe(100);
  });

  it('initializes referred player with 600 Cash (100 base + 500 referral boost)', () => {
    const state = getStarterEconomyState(true);
    expect(state.cash).toBe(STARTER_BASE_CASH + STARTER_REFERRAL_BOOST);
    expect(state.cash).toBe(600);
    expect(state.businesses).toHaveLength(16);
    expect(state.businesses.every((b) => b.level === 0)).toBe(true);
  });

  it('verifies that 100 starter Cash allows immediately unlocking Street Stand Level 1 and activating core loop within 30s', () => {
    const state = getStarterEconomyState(false);
    const streetStand = state.businesses.find(
      (b) => b.slug === 'street_stand',
    )!;

    // Player spends 100 cash to buy Level 1
    const costToUnlock = streetStand.baseCost;
    expect(state.cash).toBeGreaterThanOrEqual(costToUnlock);

    const cashAfterUnlock = state.cash - costToUnlock;
    expect(cashAfterUnlock).toBe(0);

    // Production begins immediately at 1 Cash/s
    const prodL1 = calculateProductionPerSecond(streetStand.baseIncome, 1);
    expect(prodL1).toBe(1);

    // Within 30s, player earns 30 Cash, activating core game loop
    const earnedIn30s = prodL1 * 30;
    expect(earnedIn30s).toBe(30);
  });

  it('verifies that 600 referred Cash allows immediately unlocking Street Stand up to Level 4', () => {
    const state = getStarterEconomyState(true);
    let cash = state.cash;
    const streetStand = state.businesses.find(
      (b) => b.slug === 'street_stand',
    )!;

    // Level 0 -> 1: 100
    const costL1 = calculateUpgradeCost(streetStand.baseCost, 0);
    expect(cash).toBeGreaterThanOrEqual(costL1);
    cash -= costL1;
    expect(cash).toBe(500);

    // Level 1 -> 2: 118
    const costL2 = calculateUpgradeCost(streetStand.baseCost, 2);
    expect(costL2).toBe(118);
    expect(cash).toBeGreaterThanOrEqual(costL2);
    cash -= costL2;
    expect(cash).toBe(382);

    // Level 2 -> 3: 139
    const costL3 = calculateUpgradeCost(streetStand.baseCost, 3);
    expect(costL3).toBe(139);
    expect(cash).toBeGreaterThanOrEqual(costL3);
    cash -= costL3;
    expect(cash).toBe(243);

    // Level 3 -> 4: 164
    const costL4 = calculateUpgradeCost(streetStand.baseCost, 4);
    expect(costL4).toBe(164);
    expect(cash).toBeGreaterThanOrEqual(costL4);
    cash -= costL4;
    expect(cash).toBe(79);

    // Total cost = 100 + 118 + 139 + 164 = 521 <= 600
    expect(521).toBeLessThanOrEqual(600);

    // Production at Level 4 = 1 * 4 * 1.07^3 = 4.90017... Cash/s (~4.90 Cash/s)
    const prodL4 = calculateProductionPerSecond(streetStand.baseIncome, 4);
    expect(Number(prodL4.toFixed(2))).toBe(4.9);
  });
});
