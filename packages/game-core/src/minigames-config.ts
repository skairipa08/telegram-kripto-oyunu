/**
 * Project Empire - Arcade Suite Configuration & Mathematical Constants
 *
 * Defines all configuration parameters for:
 * 1. Notcoin-style Tap-to-Earn clicker engine
 * 2. Catizen-style 12-tier Merge progression economy
 * 3. Crypto Candlestick "Moon or Doom" Crash game
 * 4. Dynasty Cipher cyber-hack terminal
 * 5. Arcade Telegram Stars SKUs with zero Season Points multiplier (Anti-P2W guardrail)
 */

export interface NotcoinTapConfig {
  baseEnergy: number;
  energyStep: number;
  baseRechargeRate: number;
  rechargeStep: number;
  baseTapPower: number;
  tapMultiplier: number;
  critChance: number;
  critMultiplier: number;
  botCadenceTapsPerSec: number;
  botEfficiency: number;
  baseOfflineCapSeconds: number;
  offlineExtenderTiers: Record<number, number>;
  costs: {
    multitapBase: number;
    multitapGrowth: number;
    capacityBase: number;
    capacityGrowth: number;
    rechargeBase: number;
    rechargeGrowth: number;
    botUnlockCash: number;
  };
}

export const DEFAULT_NOTCOIN_CONFIG: NotcoinTapConfig = {
  baseEnergy: 1000,
  energyStep: 500,
  baseRechargeRate: 1,
  rechargeStep: 1,
  baseTapPower: 1,
  tapMultiplier: 1.5,
  critChance: 0.05,
  critMultiplier: 5.0,
  botCadenceTapsPerSec: 0.333,
  botEfficiency: 0.7,
  baseOfflineCapSeconds: 10800, // 3 hours
  offlineExtenderTiers: {
    1: 21600, // 6 hours
    2: 43200, // 12 hours
    3: 86400, // 24 hours
  },
  costs: {
    multitapBase: 100,
    multitapGrowth: 1.8,
    capacityBase: 150,
    capacityGrowth: 1.7,
    rechargeBase: 200,
    rechargeGrowth: 1.9,
    botUnlockCash: 5000,
  },
};

export interface CatizenMergeTier {
  tier: number;
  name: string;
  nameTr: string;
  passiveRatePerSec: number;
  mergeRewardCash: number;
}

export const CATIZEN_MERGE_TIERS: readonly CatizenMergeTier[] = [
  {
    tier: 1,
    name: 'Bronze Chip',
    nameTr: 'Bronz Çip',
    passiveRatePerSec: 1,
    mergeRewardCash: 10,
  },
  {
    tier: 2,
    name: 'Silver Ingot',
    nameTr: 'Gümüş Külçe',
    passiveRatePerSec: 3,
    mergeRewardCash: 22,
  },
  {
    tier: 3,
    name: 'Gold Vault',
    nameTr: 'Altın Kasa',
    passiveRatePerSec: 8,
    mergeRewardCash: 48,
  },
  {
    tier: 4,
    name: 'Platinum Server',
    nameTr: 'Platin Sunucu',
    passiveRatePerSec: 20,
    mergeRewardCash: 106,
  },
  {
    tier: 5,
    name: 'Crypto Core',
    nameTr: 'Kripto Çekirdek',
    passiveRatePerSec: 50,
    mergeRewardCash: 234,
  },
  {
    tier: 6,
    name: 'Quantum Node',
    nameTr: 'Kuantum Düğüm',
    passiveRatePerSec: 125,
    mergeRewardCash: 515,
  },
  {
    tier: 7,
    name: 'Cyber Matrix',
    nameTr: 'Sibernetik Matris',
    passiveRatePerSec: 313,
    mergeRewardCash: 1132,
  },
  {
    tier: 8,
    name: 'AI Cluster',
    nameTr: 'Yapay Zeka Kümesi',
    passiveRatePerSec: 781,
    mergeRewardCash: 2491,
  },
  {
    tier: 9,
    name: 'Galactic Net',
    nameTr: 'Galaktik Ağ',
    passiveRatePerSec: 1953,
    mergeRewardCash: 5480,
  },
  {
    tier: 10,
    name: 'Cosmic Blockchain',
    nameTr: 'Kozmik Blokzincir',
    passiveRatePerSec: 4883,
    mergeRewardCash: 12056,
  },
  {
    tier: 11,
    name: 'Hyper Singularity',
    nameTr: 'Hiper-Singülarite',
    passiveRatePerSec: 12207,
    mergeRewardCash: 26523,
  },
  {
    tier: 12,
    name: 'Interdimensional Consensus',
    nameTr: 'Boyutlararası Konsensüs',
    passiveRatePerSec: 30518,
    mergeRewardCash: 58350,
  },
] as const;

export interface CatizenMergeConfig {
  boardSlots: number;
  parcelDropIntervalSeconds: number;
  parcelChances: {
    tier1: number;
    tier2: number;
    tier3: number;
  };
  tiers: readonly CatizenMergeTier[];
}

export const DEFAULT_CATIZEN_CONFIG: CatizenMergeConfig = {
  boardSlots: 12,
  parcelDropIntervalSeconds: 15,
  parcelChances: {
    tier1: 0.75,
    tier2: 0.2,
    tier3: 0.05,
  },
  tiers: CATIZEN_MERGE_TIERS,
};

export interface CryptoCrashConfig {
  rtp: number;
  houseEdge: number;
  instantCrashRateModulo: number;
  minMultiplier: number;
  maxMultiplier: number;
  curveSpeed: number;
  minStakeCash: number;
  maxStakeCash: number;
}

export const DEFAULT_CRASH_CONFIG: CryptoCrashConfig = {
  rtp: 0.97,
  houseEdge: 0.03,
  instantCrashRateModulo: 33, // 1 in 33 (~3.03%) instant house crash
  minMultiplier: 1.0,
  maxMultiplier: 1000.0,
  curveSpeed: 0.06, // M(t) = exp(0.06 * t)
  minStakeCash: 10,
  maxStakeCash: 10_000_000,
};

export interface DynastyCipherConfig {
  minSequenceLength: number;
  maxSequenceLength: number;
  maxComboMultiplier: number;
  baseRewardCash: number;
  rewardPerRoundStep: number;
  dailyEarningCapCash: number;
}

export const DEFAULT_CIPHER_CONFIG: DynastyCipherConfig = {
  minSequenceLength: 3,
  maxSequenceLength: 12,
  maxComboMultiplier: 3.0,
  baseRewardCash: 25,
  rewardPerRoundStep: 15,
  dailyEarningCapCash: 50000,
};

export interface ArcadeStarsSku {
  sku: string;
  name: string;
  description: string;
  starsPrice: number;
  seasonPointsMultiplier: number; // Strictly 1.0
  bonusSeasonPoints: number; // Strictly 0
}

export const ARCADE_STARS_SKUS: readonly ArcadeStarsSku[] = [
  {
    sku: 'tap_bot_unlock',
    name: 'TapBot Auto-Tapper',
    description: 'Unlocks automated background tapping.',
    starsPrice: 100,
    seasonPointsMultiplier: 1.0,
    bonusSeasonPoints: 0,
  },
  {
    sku: 'tap_offline_extender_6h',
    name: 'TapBot 6h Extender',
    description: 'Extends TapBot collection duration to 6 hours.',
    starsPrice: 50,
    seasonPointsMultiplier: 1.0,
    bonusSeasonPoints: 0,
  },
  {
    sku: 'tap_offline_extender_12h',
    name: 'TapBot 12h Extender',
    description: 'Extends TapBot collection duration to 12 hours.',
    starsPrice: 100,
    seasonPointsMultiplier: 1.0,
    bonusSeasonPoints: 0,
  },
  {
    sku: 'tap_offline_extender_24h',
    name: 'TapBot 24h Extender',
    description: 'Extends TapBot collection duration to 24 hours.',
    starsPrice: 200,
    seasonPointsMultiplier: 1.0,
    bonusSeasonPoints: 0,
  },
  {
    sku: 'energy_boost',
    name: 'Full Energy Boost',
    description: 'Instantly recharges energy to 100%.',
    starsPrice: 25,
    seasonPointsMultiplier: 1.0,
    bonusSeasonPoints: 0,
  },
] as const;
