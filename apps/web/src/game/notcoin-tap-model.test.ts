import { describe, expect, it } from 'vitest';
import {
  applyTapUpgrade,
  BASE_ENERGY_CAP,
  BASE_RECHARGE_RATE,
  calculateRegeneratedEnergy,
  calculateTapBotOfflineEarnings,
  CRIT_MULTIPLIER,
  createInitialTapState,
  getCapacityUpgradeCost,
  getMaxEnergy,
  getMultitapUpgradeCost,
  getOfflineExtenderCost,
  getRechargeRate,
  getRechargeUpgradeCost,
  getTapPower,
  performTap,
  syncEnergyWithTime,
  TAPBOT_UNLOCK_COST,
} from './notcoin-tap-model';

describe('Notcoin Tap Model', () => {
  it('creates initial tap state with 1000 energy and baseline upgrades', () => {
    const state = createInitialTapState(10000);
    expect(state.currentEnergy).toBe(BASE_ENERGY_CAP);
    expect(state.totalTaps).toBe(0);
    expect(state.totalCoinsEarned).toBe(0);
    expect(state.upgrades.multitap).toBe(1);
    expect(state.upgrades.energyCapacity).toBe(1);
    expect(state.upgrades.rechargeSpeed).toBe(1);
    expect(state.upgrades.tapBotUnlocked).toBe(false);
    expect(state.upgrades.offlineLimitHours).toBe(3);
  });

  it('calculates energy capacity and recharge rates progressively with levels', () => {
    expect(getMaxEnergy(1)).toBe(1000);
    expect(getMaxEnergy(2)).toBe(1500);
    expect(getMaxEnergy(10)).toBe(5500);

    expect(getRechargeRate(1)).toBe(BASE_RECHARGE_RATE);
    expect(getRechargeRate(2)).toBe(4);
    expect(getRechargeRate(5)).toBe(7);

    expect(getTapPower(1)).toBe(1);
    expect(getTapPower(5)).toBe(5);
  });

  it('regenerates energy deterministically based on elapsed time without exceeding cap', () => {
    const regenerated = calculateRegeneratedEnergy(500, 1000, 5, 20);
    expect(regenerated).toBe(600); // 500 + 5*20 = 600

    const capped = calculateRegeneratedEnergy(950, 1000, 5, 20);
    expect(capped).toBe(1000);

    const zeroTime = calculateRegeneratedEnergy(500, 1000, 5, 0);
    expect(zeroTime).toBe(500);
  });

  it('syncs energy when time passes', () => {
    const initial = createInitialTapState(1000);
    const depleted = {
      ...initial,
      currentEnergy: 200,
      lastUpdatedTimestamp: 1000,
    };
    const synced = syncEnergyWithTime(depleted, 1000 + 10_000); // 10 seconds later
    // 200 + 3 * 10 = 230
    expect(synced.currentEnergy).toBe(230);
    expect(synced.lastUpdatedTimestamp).toBe(11000);
  });

  it('performs tap successfully, expending energy and awarding coins', () => {
    const state = createInitialTapState(1000);
    const result = performTap(state, false, 1000);
    expect(result).not.toBeNull();
    expect(result!.coinsEarned).toBe(1);
    expect(result!.isCrit).toBe(false);
    expect(result!.energySpent).toBe(1);
    expect(result!.nextState.currentEnergy).toBe(999);
    expect(result!.nextState.totalTaps).toBe(1);
    expect(result!.nextState.totalCoinsEarned).toBe(1);
  });

  it('handles critical tap multiplier', () => {
    const state = createInitialTapState(1000);
    state.upgrades.multitap = 3;
    const result = performTap(state, true, 1000);
    expect(result).not.toBeNull();
    expect(result!.isCrit).toBe(true);
    expect(result!.coinsEarned).toBe(3 * CRIT_MULTIPLIER); // 15
    expect(result!.energySpent).toBe(3);
    expect(result!.nextState.currentEnergy).toBe(997);
  });

  it('rejects tap when energy is insufficient', () => {
    const state = createInitialTapState(1000);
    state.currentEnergy = 0;
    const result = performTap(state, false, 1000);
    expect(result).toBeNull();
  });

  it('computes upgrade costs across levels and respects level caps', () => {
    expect(getMultitapUpgradeCost(1)).toEqual({ cash: 100, stars: 25 });
    expect(getMultitapUpgradeCost(2)).toEqual({ cash: 200, stars: 50 });
    expect(getMultitapUpgradeCost(20)).toBeNull();

    expect(getCapacityUpgradeCost(1)).toEqual({ cash: 150, stars: 20 });
    expect(getCapacityUpgradeCost(20)).toBeNull();

    expect(getRechargeUpgradeCost(1)).toEqual({ cash: 250, stars: 35 });
    expect(getRechargeUpgradeCost(20)).toBeNull();

    expect(TAPBOT_UNLOCK_COST).toEqual({ cash: 50000, stars: 149 });
    expect(getOfflineExtenderCost(3)).toEqual({ cash: 100000, stars: 99 });
    expect(getOfflineExtenderCost(24)).toBeNull();
  });

  it('applies upgrades to tap state properly', () => {
    let state = createInitialTapState(1000);
    state = applyTapUpgrade(state, 'multitap');
    expect(state.upgrades.multitap).toBe(2);

    state = applyTapUpgrade(state, 'energyCapacity');
    expect(state.upgrades.energyCapacity).toBe(2);
    expect(getMaxEnergy(state.upgrades.energyCapacity)).toBe(1500);

    state = applyTapUpgrade(state, 'rechargeSpeed');
    expect(state.upgrades.rechargeSpeed).toBe(2);

    state = applyTapUpgrade(state, 'tapBot');
    expect(state.upgrades.tapBotUnlocked).toBe(true);

    state = applyTapUpgrade(state, 'offlineLimit');
    expect(state.upgrades.offlineLimitHours).toBe(6);
  });

  it('calculates TapBot offline accumulation with cap enforcement', () => {
    // 0 if not unlocked
    const locked = calculateTapBotOfflineEarnings(false, 1, 3, 3600);
    expect(locked.coinsEarned).toBe(0);

    // Unlocked, 1 hour (3600s), multitap 2
    // 3600s * 0.5 taps/s = 1800 taps * 2 coins = 3600 coins
    const unlocked = calculateTapBotOfflineEarnings(true, 2, 3, 3600);
    expect(unlocked.cappedSeconds).toBe(3600);
    expect(unlocked.tapsSimulated).toBe(1800);
    expect(unlocked.coinsEarned).toBe(3600);

    // Offline for 5 hours, cap is 3 hours (10800s)
    const capped = calculateTapBotOfflineEarnings(true, 1, 3, 5 * 3600);
    expect(capped.cappedSeconds).toBe(3 * 3600);
    expect(capped.tapsSimulated).toBe(5400);
    expect(capped.coinsEarned).toBe(5400);
  });
});
