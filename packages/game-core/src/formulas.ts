/**
 * Pure deterministic game economy formulas for Project Empire.
 * Side-effect free, independent of network, database, or UI.
 */

/**
 * Calculates the cost to upgrade a business from currentLevel to currentLevel + 1.
 * Formula: round(baseCost * 1.18^(level - 1))
 * If currentLevel is 0 (unlocking), cost is baseCost.
 */
export function calculateUpgradeCost(
  baseCost: number,
  currentLevel: number,
  growthRate = 1.18,
): number {
  if (currentLevel <= 0) return Math.round(baseCost);
  return Math.round(baseCost * Math.pow(growthRate, currentLevel - 1));
}

/**
 * Calculates cumulative milestone multiplier.
 * Blueprint: "x2 at levels 10, 25, 50, 100; thereafter every +50 levels x1.5"
 *
 * Level < 10: 1x
 * Level 10..24: 2x
 * Level 25..49: 4x
 * Level 50..99: 8x
 * Level 100..149: 16x
 * Level 150..199: 16 * 1.5 = 24x
 * Level 200..249: 24 * 1.5 = 36x
 * etc.
 */
export function calculateMilestoneMultiplier(level: number): number {
  if (level < 10) return 1;

  let multiplier = 1;
  if (level >= 10) multiplier *= 2;
  if (level >= 25) multiplier *= 2;
  if (level >= 50) multiplier *= 2;
  if (level >= 100) multiplier *= 2;

  if (level >= 150) {
    const additionalSteps = Math.floor((level - 100) / 50);
    multiplier *= Math.pow(1.5, additionalSteps);
  }

  return multiplier;
}

/**
 * Calculates the production rate (Cash/second) for a business at a given level.
 * Formula: baseIncome * level * 1.07^(level - 1) * milestoneBonus
 */
export function calculateProductionPerSecond(
  baseIncome: number,
  level: number,
  growthRate = 1.07,
): number {
  if (level <= 0) return 0;
  const milestoneBonus = calculateMilestoneMultiplier(level);
  const baseGrowth = Math.pow(growthRate, level - 1);
  return baseIncome * level * baseGrowth * milestoneBonus;
}

/**
 * Calculates total production per second across all owned player businesses.
 */
export function calculateTotalProduction(
  businesses: ReadonlyArray<{
    readonly baseIncome: number;
    readonly level: number;
    readonly growthRate?: number;
  }>,
): number {
  return businesses.reduce((sum, b) => {
    return (
      sum + calculateProductionPerSecond(b.baseIncome, b.level, b.growthRate)
    );
  }, 0);
}

/**
 * Offline earnings calculation.
 * Formula: productionPerSecond * min(secondsSinceLastClaim, offlineCapSeconds)
 */
export function calculateOfflineEarnings(
  productionPerSecond: number,
  secondsSinceLastClaim: number,
  capSeconds = 14400,
): {
  readonly earned: number;
  readonly effectiveSeconds: number;
  readonly isCapped: boolean;
} {
  const safeElapsed = Math.max(0, Math.floor(secondsSinceLastClaim));
  const effectiveSeconds = Math.min(safeElapsed, capSeconds);
  const isCapped = safeElapsed >= capSeconds;
  const earned = Math.floor(productionPerSecond * effectiveSeconds);

  return {
    earned,
    effectiveSeconds,
    isCapped,
  };
}

/**
 * Standard Reward Unit (SRU) calculation based on Qualified Active Players (QAP).
 * Blueprint Formula: round(500 * (max(QAP, 100) / 100)^(-0.10))
 * Clamped between minSRU (100) and maxSRU (500).
 */
export function calculateSRU(
  qap: number,
  baseSRU = 500,
  refQAP = 100,
  exponent = -0.1,
  minSRU = 100,
  maxSRU = 500,
): number {
  const effectiveQAP = Math.max(qap, refQAP);
  const raw = Math.round(baseSRU * Math.pow(effectiveQAP / refQAP, exponent));
  return Math.max(minSRU, Math.min(maxSRU, raw));
}

/**
 * Referral Whale Control factor.
 * Applied to referral Season Point rewards after the 20th qualified referral.
 * Formula: max(0.25, sqrt(20 / Q)) for Q > 20, otherwise 1.0.
 */
export function calculateReferralWhaleFactor(
  qualifiedCount: number,
  threshold = 20,
  floor = 0.25,
): number {
  if (qualifiedCount <= threshold) return 1.0;
  const factor = Math.sqrt(threshold / qualifiedCount);
  return Number(Math.max(floor, factor).toFixed(4));
}

/**
 * Deterministically calculates the payback period (break-even duration) in seconds
 * for a business upgrade.
 *
 * Formula: upgradeCost / (nextProduction - currentProduction)
 *
 * Edge cases:
 * - Returns 0 if upgradeCost <= 0 (instant payback).
 * - Returns Infinity if delta <= 0 (no production gain or production drop).
 * - Returns Infinity if upgradeCost is Infinity.
 * - Returns 0 if nextProduction is Infinity.
 * - Returns Infinity if inputs are NaN.
 */
export function calculatePaybackPeriodSeconds(
  upgradeCost: number,
  currentProduction: number,
  nextProduction: number,
): number {
  if (
    Number.isNaN(upgradeCost) ||
    Number.isNaN(currentProduction) ||
    Number.isNaN(nextProduction)
  ) {
    return Number.POSITIVE_INFINITY;
  }

  if (upgradeCost <= 0) return 0;
  if (!Number.isFinite(upgradeCost)) return Number.POSITIVE_INFINITY;
  if (nextProduction === Number.POSITIVE_INFINITY) return 0;

  const deltaProduction = nextProduction - currentProduction;
  if (deltaProduction <= 1e-9) {
    return Number.POSITIVE_INFINITY;
  }

  return upgradeCost / deltaProduction;
}

/**
 * Calculates the marginal return on investment (ROI in s^-1) for an upgrade.
 * Formula: deltaProduction / upgradeCost = 1 / paybackPeriodSeconds
 */
export function calculateMarginalRoi(
  upgradeCost: number,
  currentProduction: number,
  nextProduction: number,
): number {
  const payback = calculatePaybackPeriodSeconds(
    upgradeCost,
    currentProduction,
    nextProduction,
  );
  if (payback <= 0) return Number.POSITIVE_INFINITY;
  if (!Number.isFinite(payback)) return 0;
  return 1 / payback;
}

export interface BusinessUpgradeCandidate {
  slug: string;
  name: string;
  currentLevel: number;
  upgradeCost: number;
  currentProduction: number;
  nextProduction: number;
  paybackPeriodSeconds: number;
  marginalRoi: number;
  isAffordable: boolean;
}

/**
 * Pure recommendation engine identifying the business upgrade candidate that yields
 * the shortest payback period (highest marginal capital efficiency).
 *
 * Deterministic multi-key sorting:
 * 1. paybackPeriodSeconds ASC (finite < Infinity)
 * 2. upgradeCost ASC
 * 3. slug ASC (alphabetical stability)
 */
export function calculateOptimalNextUpgrade(
  businesses: ReadonlyArray<{
    slug: string;
    name?: string;
    level: number;
    baseCost: number;
    baseIncome: number;
  }>,
  playerCash?: number,
): {
  bestOverall: BusinessUpgradeCandidate | null;
  bestAffordable: BusinessUpgradeCandidate | null;
  candidates: BusinessUpgradeCandidate[];
} {
  if (!businesses || businesses.length === 0) {
    return {
      bestOverall: null,
      bestAffordable: null,
      candidates: [],
    };
  }

  const effectiveCash = playerCash ?? 0;

  const candidates: BusinessUpgradeCandidate[] = businesses.map((b) => {
    const currentLevel = b.level;
    const nextLevel = currentLevel + 1;
    const upgradeCost =
      currentLevel <= 0
        ? calculateUpgradeCost(b.baseCost, 0)
        : calculateUpgradeCost(b.baseCost, nextLevel);
    const currentProduction = calculateProductionPerSecond(
      b.baseIncome,
      currentLevel,
    );
    const nextProduction = calculateProductionPerSecond(
      b.baseIncome,
      nextLevel,
    );
    const paybackPeriodSeconds = calculatePaybackPeriodSeconds(
      upgradeCost,
      currentProduction,
      nextProduction,
    );
    const marginalRoi = calculateMarginalRoi(
      upgradeCost,
      currentProduction,
      nextProduction,
    );
    const isAffordable = effectiveCash >= upgradeCost;

    return {
      slug: b.slug,
      name: b.name ?? b.slug,
      currentLevel,
      upgradeCost,
      currentProduction,
      nextProduction,
      paybackPeriodSeconds,
      marginalRoi,
      isAffordable,
    };
  });

  candidates.sort((a, b) => {
    // 1. Payback period ascending
    if (a.paybackPeriodSeconds !== b.paybackPeriodSeconds) {
      if (!Number.isFinite(a.paybackPeriodSeconds)) return 1;
      if (!Number.isFinite(b.paybackPeriodSeconds)) return -1;
      return a.paybackPeriodSeconds - b.paybackPeriodSeconds;
    }
    // 2. Cost ascending
    if (a.upgradeCost !== b.upgradeCost) {
      return a.upgradeCost - b.upgradeCost;
    }
    // 3. Slug alphabetical
    return a.slug.localeCompare(b.slug);
  });

  const bestOverall = candidates[0] ?? null;
  const bestAffordable =
    candidates.find((candidate) => candidate.isAffordable) ?? null;

  return {
    bestOverall,
    bestAffordable,
    candidates,
  };
}

/**
 * Safe big-number formatting helper (e.g. 1.2K, 3.5M, 12.8B, 4.5T, 1Q, 2.5Q)
 * ensuring zero precision loss and protection against numeric overflows up to and beyond 10^15.
 * Trims redundant trailing zeros (e.g. 1K instead of 1.0K, but 1.2K for fractional).
 */
export function formatCompactNumber(value: number | bigint | string): string {
  let parsedValue: number | bigint = typeof value === 'bigint' ? value : 0;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === 'NaN') return 'NaN';
    if (trimmed === 'Infinity' || trimmed === '+Infinity') return 'Infinity';
    if (trimmed === '-Infinity') return '-Infinity';

    if (/^-?\d+$/.test(trimmed)) {
      try {
        parsedValue = BigInt(trimmed);
      } catch {
        parsedValue = Number(trimmed);
      }
    } else {
      parsedValue = Number(trimmed);
    }
  } else if (typeof value === 'number') {
    parsedValue = value;
  }

  if (typeof parsedValue === 'number') {
    if (Number.isNaN(parsedValue)) return 'NaN';
    if (!Number.isFinite(parsedValue)) {
      return parsedValue > 0 ? 'Infinity' : '-Infinity';
    }
  }

  const isNegative =
    typeof parsedValue === 'bigint' ? parsedValue < 0n : parsedValue < 0;
  const absVal =
    typeof parsedValue === 'bigint'
      ? isNegative
        ? -parsedValue
        : parsedValue
      : Math.abs(parsedValue);

  if (absVal === 0 || absVal === 0n) return '0';

  const TIERS = [
    { threshold: 1e18, divisor: 1e18, suffix: 'Qi' },
    { threshold: 1e15, divisor: 1e15, suffix: 'Q' },
    { threshold: 1e12, divisor: 1e12, suffix: 'T' },
    { threshold: 1e9, divisor: 1e9, suffix: 'B' },
    { threshold: 1e6, divisor: 1e6, suffix: 'M' },
    { threshold: 1e3, divisor: 1e3, suffix: 'K' },
  ] as const;

  const numVal = typeof absVal === 'bigint' ? Number(absVal) : absVal;

  if (numVal < 1000) {
    const sign = isNegative ? '-' : '';
    if (typeof absVal === 'bigint') {
      return `${sign}${absVal.toString()}`;
    }
    return `${sign}${Number.isInteger(numVal) ? numVal.toString() : parseFloat(numVal.toFixed(2)).toString()}`;
  }

  for (let i = 0; i < TIERS.length; i++) {
    const tier = TIERS[i]!;
    if (numVal >= tier.threshold) {
      const scaled = numVal / tier.divisor;
      const rounded1Dec = Math.round(scaled * 10) / 10;
      if (rounded1Dec >= 1000 && i > 0) {
        const nextTier = TIERS[i - 1]!;
        const nextScaled = numVal / nextTier.divisor;
        const nextRounded = Math.round(nextScaled * 10) / 10;
        const formatted =
          nextRounded % 1 === 0
            ? nextRounded.toFixed(0)
            : nextRounded.toFixed(1);
        return `${isNegative ? '-' : ''}${formatted}${nextTier.suffix}`;
      }
      const formatted =
        rounded1Dec % 1 === 0 ? rounded1Dec.toFixed(0) : rounded1Dec.toFixed(1);
      return `${isNegative ? '-' : ''}${formatted}${tier.suffix}`;
    }
  }

  if (Math.round(numVal * 10) / 10 >= 1000) {
    return `${isNegative ? '-' : ''}1K`;
  }

  return `${isNegative ? '-' : ''}${numVal.toString()}`;
}
