import {
  DEFAULT_BUSINESSES,
  type BusinessConfig,
  type EconomyConfig,
  DEFAULT_ECONOMY_CONFIG,
} from './config';
import {
  calculateUpgradeCost,
  calculateProductionPerSecond,
  calculatePaybackPeriodSeconds,
  calculateMarginalRoi,
} from './formulas';

export type SimulationStrategyType = 'greedy_roi' | 'cheapest' | 'balanced';

export interface SimulationConfig {
  initialCash?: number;
  isReferred?: boolean;
  hasConveniencePass?: boolean;
  offlineCapSeconds?: number;
  claimIntervalSeconds?: number;
  strategy?: SimulationStrategyType;
  businesses?: readonly BusinessConfig[];
  economyConfig?: Partial<EconomyConfig>;
}

export interface ConveniencePassImpact {
  cashEarnedFree: number;
  cashEarnedPass: number;
  wastedOfflineSecondsFree: number;
  wastedOfflineSecondsPass: number;
  efficiencyGainMultiplier: number;
}

export interface SimulationResult {
  durationSeconds: number;
  totalCashEarned: number;
  finalCashBalance: number;
  finalProductionPerSecond: number;
  unlockedBusinessCount: number;
  businessLevels: Record<string, number>;
  timeToUnlockSeconds: Record<string, number | null>;
  totalUpgradesPurchased: number;
  conveniencePassImpact: ConveniencePassImpact;
}

interface InternalUpgradeCandidate {
  slug: string;
  name: string;
  cost: number;
  currentLevel: number;
  nextLevel: number;
  currentProd: number;
  nextProd: number;
  payback: number;
  marginalRoi: number;
}

function getUpgradeCandidates(
  businesses: readonly BusinessConfig[],
  levels: Record<string, number>,
): InternalUpgradeCandidate[] {
  return businesses.map((b) => {
    const currentLevel = levels[b.id] ?? 0;
    const nextLevel = currentLevel + 1;
    const cost =
      currentLevel <= 0
        ? calculateUpgradeCost(b.baseCost, 0)
        : calculateUpgradeCost(b.baseCost, nextLevel);
    const currentProd = calculateProductionPerSecond(
      b.baseIncome,
      currentLevel,
    );
    const nextProd = calculateProductionPerSecond(b.baseIncome, nextLevel);
    const payback = calculatePaybackPeriodSeconds(cost, currentProd, nextProd);
    const marginalRoi = calculateMarginalRoi(cost, currentProd, nextProd);

    return {
      slug: b.id,
      name: b.name,
      cost,
      currentLevel,
      nextLevel,
      currentProd,
      nextProd,
      payback,
      marginalRoi,
    };
  });
}

function pickCandidate(
  candidates: InternalUpgradeCandidate[],
  strategy: SimulationStrategyType,
): InternalUpgradeCandidate | null {
  if (candidates.length === 0) return null;

  const sorted = [...candidates];
  if (strategy === 'cheapest') {
    sorted.sort((a, b) => a.cost - b.cost || a.payback - b.payback);
  } else if (strategy === 'balanced') {
    sorted.sort(
      (a, b) =>
        a.currentLevel - b.currentLevel ||
        a.payback - b.payback ||
        a.cost - b.cost,
    );
  } else {
    // default: greedy_roi
    sorted.sort((a, b) => {
      if (a.payback !== b.payback) {
        if (!Number.isFinite(a.payback)) return 1;
        if (!Number.isFinite(b.payback)) return -1;
        return a.payback - b.payback;
      }
      return a.cost - b.cost;
    });
  }

  return sorted[0] ?? null;
}

function calculateCurrentProduction(
  businesses: readonly BusinessConfig[],
  levels: Record<string, number>,
): number {
  return businesses.reduce((sum, b) => {
    const lvl = levels[b.id] ?? 0;
    return sum + calculateProductionPerSecond(b.baseIncome, lvl);
  }, 0);
}

/**
 * Runs a single simulation trajectory.
 */
function runSingleSimulation(
  durationSeconds: number,
  config: SimulationConfig = {},
  forceSessionInterval?: number,
  forceOfflineCap?: number,
): {
  totalCashEarned: number;
  finalCash: number;
  levels: Record<string, number>;
  timeToUnlock: Record<string, number | null>;
  totalUpgradesPurchased: number;
  wastedOfflineSeconds: number;
} {
  const businesses = config.businesses ?? DEFAULT_BUSINESSES;
  const initialCash = config.initialCash ?? (config.isReferred ? 600 : 100);
  const strategy: SimulationStrategyType = config.strategy ?? 'greedy_roi';

  const defaultCap = config.hasConveniencePass
    ? DEFAULT_ECONOMY_CONFIG.offlineCapPassSec
    : DEFAULT_ECONOMY_CONFIG.offlineCapFreeSec;
  const offlineCap = forceOfflineCap ?? config.offlineCapSeconds ?? defaultCap;

  let cash = initialCash;
  let totalCashEarned = initialCash;
  let totalUpgradesPurchased = 0;
  let wastedOfflineSeconds = 0;

  const levels: Record<string, number> = {};
  const timeToUnlock: Record<string, number | null> = {};

  for (const b of businesses) {
    levels[b.id] = 0;
    timeToUnlock[b.id] = null;
  }

  const buyAffordableLoop = (currentTime: number) => {
    let boughtAny = true;
    while (boughtAny) {
      boughtAny = false;
      const candidates = getUpgradeCandidates(businesses, levels);
      const affordable = candidates.filter((c) => cash >= c.cost);
      if (affordable.length > 0) {
        const chosen = pickCandidate(affordable, strategy);
        if (chosen) {
          cash -= chosen.cost;
          levels[chosen.slug] = (levels[chosen.slug] ?? 0) + 1;
          totalUpgradesPurchased++;
          if (timeToUnlock[chosen.slug] === null) {
            timeToUnlock[chosen.slug] = currentTime;
          }
          boughtAny = true;
        }
      }
    }
  };

  const sessionInterval = forceSessionInterval ?? config.claimIntervalSeconds;

  if (sessionInterval && sessionInterval > 0) {
    // Periodic session check-in mode
    let currentTime = 0;
    buyAffordableLoop(currentTime);

    while (currentTime < durationSeconds) {
      const step = Math.min(sessionInterval, durationSeconds - currentTime);
      const effectiveStep = Math.min(step, offlineCap);
      const wastedStep = Math.max(0, step - offlineCap);
      wastedOfflineSeconds += wastedStep;

      const currentProd = calculateCurrentProduction(businesses, levels);
      const earned = Math.floor(currentProd * effectiveStep);
      cash += earned;
      totalCashEarned += earned;

      currentTime += step;
      buyAffordableLoop(currentTime);
    }
  } else {
    // Continuous event-jumping mode
    let currentTime = 0;
    buyAffordableLoop(currentTime);

    while (currentTime < durationSeconds) {
      const currentProd = calculateCurrentProduction(businesses, levels);
      if (currentProd <= 0) {
        // Can't earn anything; advance to end
        break;
      }

      const allCandidates = getUpgradeCandidates(businesses, levels);
      const target = pickCandidate(allCandidates, strategy);
      if (!target) break;

      const needed = Math.max(0, target.cost - cash);
      if (needed === 0) {
        // Affordable now, buy it
        buyAffordableLoop(currentTime);
        continue;
      }

      const waitSeconds = Math.max(1, Math.ceil(needed / currentProd));
      if (currentTime + waitSeconds > durationSeconds) {
        const remaining = durationSeconds - currentTime;
        const earned = remaining * currentProd;
        cash += earned;
        totalCashEarned += earned;
        break;
      }

      const earned = waitSeconds * currentProd;
      cash += earned;
      totalCashEarned += earned;
      currentTime += waitSeconds;

      buyAffordableLoop(currentTime);
    }
  }

  return {
    totalCashEarned,
    finalCash: cash,
    levels,
    timeToUnlock,
    totalUpgradesPurchased,
    wastedOfflineSeconds,
  };
}

/**
 * Deterministically simulates economy progression over a specified duration in seconds.
 * Supports 1 hour (3600s), 24 hours (86400s), 7 days (604800s), and 30 days (2592000s).
 */
export function simulateProgression(
  durationSeconds: number,
  config: SimulationConfig = {},
): SimulationResult {
  const businesses = config.businesses ?? DEFAULT_BUSINESSES;

  // 1. Run main simulation trajectory
  const mainRun = runSingleSimulation(durationSeconds, config);

  // 2. Compute Convenience Pass impact comparison
  // Uses casual 8-hour (28,800s) offline check-in session model
  const casualCheckInSeconds = 28800;
  const freeCap = DEFAULT_ECONOMY_CONFIG.offlineCapFreeSec; // 4 hours
  const passCap = DEFAULT_ECONOMY_CONFIG.offlineCapPassSec; // 12 hours

  const freeRun = runSingleSimulation(
    durationSeconds,
    { ...config, hasConveniencePass: false },
    casualCheckInSeconds,
    freeCap,
  );

  const passRun = runSingleSimulation(
    durationSeconds,
    { ...config, hasConveniencePass: true },
    casualCheckInSeconds,
    passCap,
  );

  const efficiencyGainMultiplier =
    freeRun.totalCashEarned > 0
      ? Number((passRun.totalCashEarned / freeRun.totalCashEarned).toFixed(4))
      : 1.0;

  const conveniencePassImpact: ConveniencePassImpact = {
    cashEarnedFree: freeRun.totalCashEarned,
    cashEarnedPass: passRun.totalCashEarned,
    wastedOfflineSecondsFree: freeRun.wastedOfflineSeconds,
    wastedOfflineSecondsPass: passRun.wastedOfflineSeconds,
    efficiencyGainMultiplier,
  };

  const finalProd = calculateCurrentProduction(businesses, mainRun.levels);
  const unlockedCount = Object.values(mainRun.levels).filter(
    (lvl) => lvl > 0,
  ).length;

  return {
    durationSeconds,
    totalCashEarned: mainRun.totalCashEarned,
    finalCashBalance: mainRun.finalCash,
    finalProductionPerSecond: finalProd,
    unlockedBusinessCount: unlockedCount,
    businessLevels: mainRun.levels,
    timeToUnlockSeconds: mainRun.timeToUnlock,
    totalUpgradesPurchased: mainRun.totalUpgradesPurchased,
    conveniencePassImpact,
  };
}
