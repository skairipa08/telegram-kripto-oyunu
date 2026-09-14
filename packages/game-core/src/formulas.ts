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
