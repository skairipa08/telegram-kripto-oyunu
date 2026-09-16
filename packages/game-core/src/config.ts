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
  {
    id: 'crypto_mining',
    name: 'Kripto Madencilik',
    baseCost: 800000000,
    baseIncome: 800000,
    order: 7,
  },
  {
    id: 'blockchain_bank',
    name: 'Blokzincir Bankası',
    baseCost: 12000000000,
    baseIncome: 10000000,
    order: 8,
  },
  {
    id: 'ai_datacenter',
    name: 'Yapay Zeka Veri Merkezi',
    baseCost: 180000000000,
    baseIncome: 130000000,
    order: 9,
  },
  {
    id: 'cyber_security',
    name: 'Siber Güvenlik Ajansı',
    baseCost: 2500000000000,
    baseIncome: 1600000000,
    order: 10,
  },
  {
    id: 'fintech_giant',
    name: 'Fintek Devi',
    baseCost: 35000000000000,
    baseIncome: 20000000000,
    order: 11,
  },
  {
    id: 'quantum_lab',
    name: 'Kuantum Labı',
    baseCost: 500000000000000,
    baseIncome: 250000000000,
    order: 12,
  },
  {
    id: 'satellite_network',
    name: 'Uydu İletişim Ağı',
    baseCost: 7500000000000000,
    baseIncome: 3200000000000,
    order: 13,
  },
  {
    id: 'spaceport_logistics',
    name: 'Uzay Limanı & Lojistik',
    baseCost: 100000000000000000,
    baseIncome: 40000000000000,
    order: 14,
  },
  {
    id: 'orbital_colony',
    name: 'Yörünge Kolonisi',
    baseCost: 1500000000000000000,
    baseIncome: 500000000000000,
    order: 15,
  },
  {
    id: 'galactic_federation',
    name: 'Galaktik Kripto Federasyonu',
    baseCost: 20000000000000000000,
    baseIncome: 6500000000000000,
    order: 16,
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
