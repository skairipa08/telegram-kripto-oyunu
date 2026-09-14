import { DEFAULT_BUSINESSES, type BusinessConfig } from './config';

export const STARTER_BASE_CASH = 100;
export const STARTER_REFERRAL_BOOST = 500;

export interface StarterBusinessState {
  slug: string;
  name: string;
  level: number;
  baseCost: number;
  baseIncome: number;
  order: number;
}

export interface StarterEconomyState {
  cash: number;
  totalProductionPerSecond: number;
  businesses: StarterBusinessState[];
}

/**
 * Generates the default deterministic starter economy state for a new player.
 * - Base starter grant: 100 Cash (allows immediate purchase of Street Stand Level 1).
 * - Referral additive boost: +500 Cash (600 Cash total if user bound a referral).
 * - All 6 canonical businesses initialized at level 0.
 */
export function getStarterEconomyState(
  isReferred = false,
  businessDefs: readonly BusinessConfig[] = DEFAULT_BUSINESSES,
): StarterEconomyState {
  const cash = isReferred
    ? STARTER_BASE_CASH + STARTER_REFERRAL_BOOST
    : STARTER_BASE_CASH;

  return {
    cash,
    totalProductionPerSecond: 0,
    businesses: businessDefs.map((b) => ({
      slug: b.id,
      name: b.name,
      level: 0,
      baseCost: b.baseCost,
      baseIncome: b.baseIncome,
      order: b.order,
    })),
  };
}
