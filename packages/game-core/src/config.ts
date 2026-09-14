export interface BusinessConfig {
  readonly id: string;
  readonly name: string;
  readonly baseCost: number;
  readonly baseIncome: number;
  readonly order: number;
}

export const DEFAULT_BUSINESSES: readonly BusinessConfig[] = [
  {
    id: 'street_stand',
    name: 'Street Stand',
    baseCost: 100,
    baseIncome: 1,
    order: 1,
  },
  { id: 'cafe', name: 'Cafe', baseCost: 2500, baseIncome: 12, order: 2 },
  {
    id: 'delivery_hub',
    name: 'Delivery Hub',
    baseCost: 25000,
    baseIncome: 90,
    order: 3,
  },
  {
    id: 'factory',
    name: 'Factory',
    baseCost: 250000,
    baseIncome: 600,
    order: 4,
  },
  {
    id: 'tech_company',
    name: 'Tech Company',
    baseCost: 3000000,
    baseIncome: 5000,
    order: 5,
  },
  {
    id: 'global_holding',
    name: 'Global Holding',
    baseCost: 50000000,
    baseIncome: 60000,
    order: 6,
  },
] as const;

export interface EconomyConfig {
  offlineCapFreeSec: number;
  offlineCapPassSec: number;
  upgradeCostGrowth: number;
  productionLevelGrowth: number;
  seasonSruBase: number;
  seasonSruRefQap: number;
  seasonSruExponent: number;
  seasonSruMin: number;
  seasonSruMax: number;
  referralBindWindowMin: number;
  referralDiminishThreshold: number;
  referralDiminishFloor: number;
  passPriceStars: number;
  passDurationDays: number;
  missionDailySlots: number;
  missionFreeRerolls: number;
  missionPassRerolls: number;
  featureToken: boolean;
  featureStarsPayments: boolean;
  featureLeaderboard: boolean;
  featureReferrals: boolean;
}

export const DEFAULT_ECONOMY_CONFIG: EconomyConfig = {
  offlineCapFreeSec: 14400, // 4 hours
  offlineCapPassSec: 43200, // 12 hours
  upgradeCostGrowth: 1.18,
  productionLevelGrowth: 1.07,
  seasonSruBase: 500,
  seasonSruRefQap: 100,
  seasonSruExponent: -0.1,
  seasonSruMin: 100,
  seasonSruMax: 500,
  referralBindWindowMin: 30,
  referralDiminishThreshold: 20,
  referralDiminishFloor: 0.25,
  passPriceStars: 250,
  passDurationDays: 30,
  missionDailySlots: 3,
  missionFreeRerolls: 1,
  missionPassRerolls: 3,
  featureToken: false,
  featureStarsPayments: false,
  featureLeaderboard: true,
  featureReferrals: true,
};
