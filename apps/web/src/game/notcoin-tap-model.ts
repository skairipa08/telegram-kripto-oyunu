// apps/web/src/game/notcoin-tap-model.ts
// Pure client mathematical model for Notcoin tap-to-earn mechanics

export interface TapUpgrades {
  multitap: number; // level 1..10
  energyCapacity: number; // level 1..10
  rechargeSpeed: number; // level 1..5
  tapBotUnlocked: boolean;
  offlineLimitHours: number; // 3, 6, 12, 24
}

export interface TapState {
  currentEnergy: number;
  lastUpdatedTimestamp: number;
  totalTaps: number;
  totalCoinsEarned: number;
  upgrades: TapUpgrades;
}

export interface UpgradeCost {
  cash: number;
  stars: number;
}

export const BASE_ENERGY_CAP = 1000;
export const ENERGY_PER_CAP_LEVEL = 500;
export const BASE_RECHARGE_RATE = 3; // +3 energy per second
export const RECHARGE_PER_LEVEL = 1; // +1 energy/s per level
export const CRIT_CHANCE = 0.1; // 10%
export const CRIT_MULTIPLIER = 5; // 5x on crit

export function getMaxEnergy(capacityLevel: number): number {
  const safeLevel = Math.max(1, capacityLevel);
  return BASE_ENERGY_CAP + (safeLevel - 1) * ENERGY_PER_CAP_LEVEL;
}

export function getRechargeRate(rechargeLevel: number): number {
  const safeLevel = Math.max(1, rechargeLevel);
  return BASE_RECHARGE_RATE + (safeLevel - 1) * RECHARGE_PER_LEVEL;
}

export function getTapPower(multitapLevel: number): number {
  const safeLevel = Math.max(1, multitapLevel);
  return safeLevel; // Lv 1 = 1 coin, Lv 2 = 2 coins, etc.
}

export function getMultitapUpgradeCost(
  currentLevel: number,
): UpgradeCost | null {
  if (currentLevel >= 10) return null;
  return {
    cash: Math.floor(100 * Math.pow(2, currentLevel - 1)),
    stars: 25 * currentLevel,
  };
}

export function getCapacityUpgradeCost(
  currentLevel: number,
): UpgradeCost | null {
  if (currentLevel >= 10) return null;
  return {
    cash: Math.floor(150 * Math.pow(2, currentLevel - 1)),
    stars: 20 * currentLevel,
  };
}

export function getRechargeUpgradeCost(
  currentLevel: number,
): UpgradeCost | null {
  if (currentLevel >= 5) return null;
  return {
    cash: Math.floor(250 * Math.pow(2.2, currentLevel - 1)),
    stars: 35 * currentLevel,
  };
}

export const TAPBOT_UNLOCK_COST: UpgradeCost = {
  cash: 50000,
  stars: 149,
};

export function getOfflineExtenderCost(
  currentHours: number,
): UpgradeCost | null {
  if (currentHours >= 24) return null;
  return {
    cash: 100000,
    stars: 99,
  };
}

export function createInitialTapState(now = Date.now()): TapState {
  return {
    currentEnergy: BASE_ENERGY_CAP,
    lastUpdatedTimestamp: now,
    totalTaps: 0,
    totalCoinsEarned: 0,
    upgrades: {
      multitap: 1,
      energyCapacity: 1,
      rechargeSpeed: 1,
      tapBotUnlocked: false,
      offlineLimitHours: 3,
    },
  };
}

export function calculateRegeneratedEnergy(
  currentEnergy: number,
  maxEnergy: number,
  rechargeRate: number,
  elapsedSeconds: number,
): number {
  if (elapsedSeconds <= 0) return currentEnergy;
  const gained = Math.floor(rechargeRate * elapsedSeconds);
  return Math.min(maxEnergy, Math.max(0, currentEnergy + gained));
}

export function syncEnergyWithTime(
  state: TapState,
  now = Date.now(),
): TapState {
  const maxEnergy = getMaxEnergy(state.upgrades.energyCapacity);
  const rechargeRate = getRechargeRate(state.upgrades.rechargeSpeed);
  const elapsedSeconds = Math.max(
    0,
    Math.floor((now - state.lastUpdatedTimestamp) / 1000),
  );

  if (elapsedSeconds <= 0) return state;

  const newEnergy = calculateRegeneratedEnergy(
    state.currentEnergy,
    maxEnergy,
    rechargeRate,
    elapsedSeconds,
  );

  return {
    ...state,
    currentEnergy: newEnergy,
    lastUpdatedTimestamp: now,
  };
}

export function performTap(
  state: TapState,
  forcedCrit?: boolean,
  now = Date.now(),
): {
  nextState: TapState;
  coinsEarned: number;
  isCrit: boolean;
  energySpent: number;
} | null {
  // First sync energy with elapsed time
  const synced = syncEnergyWithTime(state, now);
  const power = getTapPower(synced.upgrades.multitap);
  const energyCost = power; // 1 energy per power

  if (synced.currentEnergy < energyCost) {
    return null; // Not enough energy
  }

  const isCrit =
    forcedCrit !== undefined ? forcedCrit : Math.random() < CRIT_CHANCE;
  const multiplier = isCrit ? CRIT_MULTIPLIER : 1;
  const coinsEarned = power * multiplier;

  const nextState: TapState = {
    ...synced,
    currentEnergy: synced.currentEnergy - energyCost,
    lastUpdatedTimestamp: now,
    totalTaps: synced.totalTaps + 1,
    totalCoinsEarned: synced.totalCoinsEarned + coinsEarned,
  };

  return {
    nextState,
    coinsEarned,
    isCrit,
    energySpent: energyCost,
  };
}

export function calculateTapBotOfflineEarnings(
  tapBotUnlocked: boolean,
  multitapLevel: number,
  offlineLimitHours: number,
  elapsedSeconds: number,
): {
  elapsedSeconds: number;
  cappedSeconds: number;
  coinsEarned: number;
  tapsSimulated: number;
} {
  if (!tapBotUnlocked || elapsedSeconds <= 0) {
    return {
      elapsedSeconds,
      cappedSeconds: 0,
      coinsEarned: 0,
      tapsSimulated: 0,
    };
  }

  const maxSeconds = Math.max(1, offlineLimitHours * 3600);
  const cappedSeconds = Math.min(elapsedSeconds, maxSeconds);

  // TapBot taps once every 2 seconds (0.5 taps/second)
  const tapsSimulated = Math.floor(cappedSeconds * 0.5);
  const power = getTapPower(multitapLevel);
  const coinsEarned = tapsSimulated * power;

  return {
    elapsedSeconds,
    cappedSeconds,
    coinsEarned,
    tapsSimulated,
  };
}

export function applyTapUpgrade(
  state: TapState,
  upgradeType:
    'multitap' | 'energyCapacity' | 'rechargeSpeed' | 'tapBot' | 'offlineLimit',
): TapState {
  const current = state.upgrades;

  switch (upgradeType) {
    case 'multitap':
      if (current.multitap >= 10) return state;
      return {
        ...state,
        upgrades: { ...current, multitap: current.multitap + 1 },
      };
    case 'energyCapacity': {
      if (current.energyCapacity >= 10) return state;
      const nextLevel = current.energyCapacity + 1;
      const newMax = getMaxEnergy(nextLevel);
      return {
        ...state,
        currentEnergy: Math.min(
          state.currentEnergy + ENERGY_PER_CAP_LEVEL,
          newMax,
        ),
        upgrades: { ...current, energyCapacity: nextLevel },
      };
    }
    case 'rechargeSpeed':
      if (current.rechargeSpeed >= 5) return state;
      return {
        ...state,
        upgrades: { ...current, rechargeSpeed: current.rechargeSpeed + 1 },
      };
    case 'tapBot':
      return {
        ...state,
        upgrades: { ...current, tapBotUnlocked: true },
      };
    case 'offlineLimit': {
      const tiers = [3, 6, 12, 24];
      const currentIndex = tiers.indexOf(current.offlineLimitHours);
      const nextHours =
        currentIndex !== -1 && currentIndex < tiers.length - 1
          ? tiers[currentIndex + 1]!
          : current.offlineLimitHours;
      return {
        ...state,
        upgrades: { ...current, offlineLimitHours: nextHours },
      };
    }
    default:
      return state;
  }
}
