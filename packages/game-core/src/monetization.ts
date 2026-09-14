export interface ShopSku {
  sku:
    'convenience_pass_30d' | 'cosmetic_frame_gold' | 'cosmetic_emblem_founder';
  name: string;
  description: string;
  starsPrice: number;
  type: 'pass' | 'cosmetic';
  durationDays?: number;
}

export const DEFAULT_SKUS: readonly ShopSku[] = [
  {
    sku: 'convenience_pass_30d',
    name: 'Convenience Pass (30 Days)',
    description:
      'Extends offline earnings cap to 12 hours, unlocks 3 upgrade queue slots, grants 3 daily mission rerolls, and enables auto-claim automation.',
    starsPrice: 250,
    type: 'pass',
    durationDays: 30,
  },
  {
    sku: 'cosmetic_frame_gold',
    name: 'Gold Profile Frame',
    description: 'Prestigious golden frame for profile and avatar.',
    starsPrice: 150,
    type: 'cosmetic',
  },
  {
    sku: 'cosmetic_emblem_founder',
    name: 'Founder Emblem',
    description: 'Exclusive cosmetic badge honoring early players.',
    starsPrice: 500,
    type: 'cosmetic',
  },
] as const;

export interface ConveniencePassEntitlements {
  isActive: boolean;
  offlineCapSeconds: number; // 43,200 (12h) vs 14,400 (4h)
  upgradeQueueSlots: number; // 3 vs 1
  missionRerolls: number; // 3 vs 1
  autoClaimEnabled: boolean; // true vs false
  seasonPointsMultiplier: number; // Strictly 1.0 (anti-P2W)
}

export class P2WViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'P2WViolationError';
  }
}

/**
 * Checks if a pass expiration timestamp is currently active.
 */
export function isPassActive(
  expiresAt: Date | string | null | undefined,
  now: Date | string = new Date(),
): boolean {
  if (!expiresAt) {
    return false;
  }
  const expiryTime = new Date(expiresAt).getTime();
  const currentTime = new Date(now).getTime();
  return expiryTime > currentTime;
}

/**
 * Pure calculation of player entitlements based on active convenience pass status.
 * Enforces strict anti-P2W guardrails: seasonPointsMultiplier is permanently locked to 1.0.
 */
export function calculateConveniencePassEntitlements(
  isActive: boolean,
): ConveniencePassEntitlements {
  return {
    isActive,
    offlineCapSeconds: isActive ? 43200 : 14400,
    upgradeQueueSlots: isActive ? 3 : 1,
    missionRerolls: isActive ? 3 : 1,
    autoClaimEnabled: isActive,
    seasonPointsMultiplier: 1.0, // Anti-P2W invariant: Money never boosts Season Points
  };
}

/**
 * Calculates new expiration date when purchasing or renewing a convenience pass.
 * Supports additive duration stacking: if pass is currently active, extends from current expiry;
 * otherwise starts from now.
 */
export function calculatePassExpiry(
  currentExpiresAt: Date | string | null | undefined,
  durationDays: number,
  now: Date | string = new Date(),
): Date {
  if (durationDays <= 0) {
    throw new RangeError('Pass durationDays must be a positive integer.');
  }

  const currentDate = new Date(now);
  const durationMs = durationDays * 86_400_000;

  if (currentExpiresAt && isPassActive(currentExpiresAt, currentDate)) {
    const currentExpiryTime = new Date(currentExpiresAt).getTime();
    return new Date(currentExpiryTime + durationMs);
  }

  return new Date(currentDate.getTime() + durationMs);
}

/**
 * Strict contract guardrail ensuring Stars cannot purchase competitive advantages,
 * cash multipliers, or Season Points.
 */
export function validateP2WSafety(sku: string): { safe: boolean } {
  const allowedSkus = new Set(DEFAULT_SKUS.map((s) => s.sku));

  if (!allowedSkus.has(sku as ShopSku['sku'])) {
    throw new P2WViolationError(
      `Forbidden SKU [${sku}]: Purchasing Season Points, Cash, or competitive rank boosts is strictly prohibited by anti-P2W policy.`,
    );
  }

  return { safe: true };
}
