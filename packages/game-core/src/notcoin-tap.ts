/**
 * Notcoin-Style Tap-to-Earn Core Engine
 *
 * Mathematical models for:
 * - Dynamic energy regeneration curves
 * - Tap power scaling (base * 1.5^(lvl - 1))
 * - Critical hit distribution (5% chance, 5.0x multiplier)
 * - Upgrade cost curves (In-Game Cash)
 * - Offline TapBot accumulator with strict energy conservation bound
 */

import {
  DEFAULT_NOTCOIN_CONFIG,
  type NotcoinTapConfig,
} from './minigames-config';

export interface EnergyStateResult {
  energy: number;
  maxEnergy: number;
  rechargeRate: number;
  elapsedSeconds: number;
}

/**
 * Calculates the player's current energy state based on elapsed time and upgrade levels.
 * Clamps energy between 0 and maxEnergy.
 */
export function calculateEnergyState(params: {
  currentEnergy: number;
  energyCapacityLevel?: number;
  rechargeSpeedLevel?: number;
  lastUpdateTimestampMs: number;
  currentTimestampMs: number;
  config?: NotcoinTapConfig;
}): EnergyStateResult {
  const config = params.config ?? DEFAULT_NOTCOIN_CONFIG;
  const capLevel = Math.max(1, params.energyCapacityLevel ?? 1);
  const rechLevel = Math.max(1, params.rechargeSpeedLevel ?? 1);

  const maxEnergy = config.baseEnergy + config.energyStep * (capLevel - 1);
  const rechargeRate =
    config.baseRechargeRate + config.rechargeStep * (rechLevel - 1);

  const elapsedMs = Math.max(
    0,
    params.currentTimestampMs - params.lastUpdateTimestampMs,
  );
  const elapsedSeconds = Math.floor(elapsedMs / 1000);

  const regenerated = elapsedSeconds * rechargeRate;
  const currentEnergySafe = Math.max(0, params.currentEnergy);
  const totalEnergy = Math.min(maxEnergy, currentEnergySafe + regenerated);

  return {
    energy: totalEnergy,
    maxEnergy,
    rechargeRate,
    elapsedSeconds,
  };
}

/**
 * Calculates tap power (coins per non-critical tap) given the multitap level.
 * Formula: max(level, round(base * 1.5^(level - 1)))
 */
export function calculateTapPower(
  multitapLevel: number,
  config: NotcoinTapConfig = DEFAULT_NOTCOIN_CONFIG,
): number {
  const level = Math.max(1, Math.floor(multitapLevel));
  const rawPower =
    config.baseTapPower * Math.pow(config.tapMultiplier, level - 1);
  return Math.max(level, Math.round(rawPower));
}

export interface TapClickResult {
  tapsExecuted: number;
  baseCoinsEarned: number;
  critCoinsEarned: number;
  totalCoinsEarned: number;
  remainingEnergy: number;
  criticalHitsCount: number;
}

/**
 * Executes a batch of taps up to available energy.
 * Enforces energy conservation: 1 tap costs 1 energy.
 * Critical hits have 5% chance and award 5.0x the single-tap power.
 */
export function calculateTapClick(params: {
  requestedTaps: number;
  currentEnergy: number;
  multitapLevel: number;
  config?: NotcoinTapConfig;
  rollCrit?: () => boolean | number;
}): TapClickResult {
  const config = params.config ?? DEFAULT_NOTCOIN_CONFIG;
  const availableEnergy = Math.max(0, Math.floor(params.currentEnergy));
  const requestedTaps = Math.max(0, Math.floor(params.requestedTaps));

  const tapsExecuted = Math.min(requestedTaps, availableEnergy);
  if (tapsExecuted <= 0) {
    return {
      tapsExecuted: 0,
      baseCoinsEarned: 0,
      critCoinsEarned: 0,
      totalCoinsEarned: 0,
      remainingEnergy: availableEnergy,
      criticalHitsCount: 0,
    };
  }

  const tapPower = calculateTapPower(params.multitapLevel, config);
  let criticalHitsCount = 0;

  for (let i = 0; i < tapsExecuted; i++) {
    const roll = params.rollCrit ? params.rollCrit() : undefined;
    const isCrit =
      roll !== undefined
        ? typeof roll === 'boolean'
          ? roll
          : roll < config.critChance
        : Math.random() < config.critChance;

    if (isCrit) {
      criticalHitsCount++;
    }
  }

  const normalTaps = tapsExecuted - criticalHitsCount;
  const baseCoinsEarned = normalTaps * tapPower;
  const critCoinsEarned = Math.round(
    criticalHitsCount * tapPower * config.critMultiplier,
  );
  const totalCoinsEarned = baseCoinsEarned + critCoinsEarned;
  const remainingEnergy = availableEnergy - tapsExecuted;

  return {
    tapsExecuted,
    baseCoinsEarned,
    critCoinsEarned,
    totalCoinsEarned,
    remainingEnergy,
    criticalHitsCount,
  };
}

export type TapUpgradeType =
  'multitap' | 'capacity' | 'recharge_speed' | 'bot_unlock';

/**
 * Calculates upgrade cost in Cash for Notcoin Tap upgrades.
 */
export function calculateTapUpgradeCost(
  upgradeType: TapUpgradeType,
  currentLevel: number,
  config: NotcoinTapConfig = DEFAULT_NOTCOIN_CONFIG,
): number {
  const level = Math.max(1, Math.floor(currentLevel));
  switch (upgradeType) {
    case 'multitap':
      return Math.round(
        config.costs.multitapBase *
          Math.pow(config.costs.multitapGrowth, level - 1),
      );
    case 'capacity':
      return Math.round(
        config.costs.capacityBase *
          Math.pow(config.costs.capacityGrowth, level - 1),
      );
    case 'recharge_speed':
      return Math.round(
        config.costs.rechargeBase *
          Math.pow(config.costs.rechargeGrowth, level - 1),
      );
    case 'bot_unlock':
      return config.costs.botUnlockCash;
    default:
      throw new Error(`Unknown tap upgrade type: ${upgradeType}`);
  }
}

export interface TapBotEarningsResult {
  offlineSecondsElapsed: number;
  effectiveSeconds: number;
  isCapped: boolean;
  nominalTaps: number;
  actualTaps: number;
  coinsEarned: number;
  remainingEnergy: number;
  maxEnergy: number;
}

/**
 * Calculates TapBot earnings during player absence.
 * Guarantees strict energy conservation: bot cannot spend more energy than
 * initial energy plus energy regenerated during the offline window.
 * Applies 70% bot efficiency factor.
 */
export function calculateTapBotEarnings(params: {
  lastClaimTimestampMs: number;
  currentTimestampMs: number;
  currentEnergy: number;
  multitapLevel: number;
  energyCapacityLevel: number;
  rechargeSpeedLevel: number;
  offlineExtenderTier?: number;
  config?: NotcoinTapConfig;
}): TapBotEarningsResult {
  const config = params.config ?? DEFAULT_NOTCOIN_CONFIG;
  const tier = params.offlineExtenderTier ?? 0;
  const offlineCapSeconds =
    config.offlineExtenderTiers[tier] ?? config.baseOfflineCapSeconds;

  const elapsedMs = Math.max(
    0,
    params.currentTimestampMs - params.lastClaimTimestampMs,
  );
  const offlineSecondsElapsed = Math.floor(elapsedMs / 1000);
  const effectiveSeconds = Math.min(offlineSecondsElapsed, offlineCapSeconds);
  const isCapped = offlineSecondsElapsed > offlineCapSeconds;

  const capLevel = Math.max(1, params.energyCapacityLevel);
  const rechLevel = Math.max(1, params.rechargeSpeedLevel);
  const maxEnergy = config.baseEnergy + config.energyStep * (capLevel - 1);
  const rechargeRate =
    config.baseRechargeRate + config.rechargeStep * (rechLevel - 1);

  // Energy conservation:
  const initialEnergy = Math.max(0, Math.min(maxEnergy, params.currentEnergy));
  const energyRegenerated = effectiveSeconds * rechargeRate;
  const totalAvailableEnergy = initialEnergy + energyRegenerated;

  // Bot taps nominally at cadence (1 tap every ~3 seconds)
  const nominalTaps = Math.floor(
    effectiveSeconds * config.botCadenceTapsPerSec,
  );
  // Strictly bounded by total available energy
  const actualTaps = Math.min(nominalTaps, Math.floor(totalAvailableEnergy));

  const tapPower = calculateTapPower(params.multitapLevel, config);
  const coinsEarned = Math.floor(actualTaps * tapPower * config.botEfficiency);

  // Remaining energy after bot tap consumption, clamped to maxEnergy
  const remainingEnergy = Math.min(
    maxEnergy,
    Math.max(0, Math.floor(totalAvailableEnergy - actualTaps)),
  );

  return {
    offlineSecondsElapsed,
    effectiveSeconds,
    isCapped,
    nominalTaps,
    actualTaps,
    coinsEarned,
    remainingEnergy,
    maxEnergy,
  };
}
