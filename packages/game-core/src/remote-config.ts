import { DEFAULT_ECONOMY_CONFIG, type EconomyConfig } from './config';

/**
 * Mapping between PostgreSQL snake_case config keys (Blueprint Section 18)
 * and TypeScript camelCase property names in EconomyConfig.
 */
export const CONFIG_KEY_MAP: Record<string, keyof EconomyConfig> = {
  'economy.offline_cap_free_sec': 'offlineCapFreeSec',
  'economy.offline_cap_pass_sec': 'offlineCapPassSec',
  'economy.upgrade_cost_growth': 'upgradeCostGrowth',
  'economy.production_level_growth': 'productionLevelGrowth',
  'season.sru_base': 'seasonSruBase',
  'season.sru_reference_qap': 'seasonSruRefQap',
  'season.sru_exponent': 'seasonSruExponent',
  'season.sru_min': 'seasonSruMin',
  'season.sru_max': 'seasonSruMax',
  'referral.bind_window_min': 'referralBindWindowMin',
  'referral.diminish_threshold': 'referralDiminishThreshold',
  'referral.diminish_after_qualified': 'referralDiminishThreshold',
  'referral.diminish_floor': 'referralDiminishFloor',
  'pass.price_stars': 'passPriceStars',
  'pass.duration_days': 'passDurationDays',
  'mission.daily_slots': 'missionDailySlots',
  'mission.free_rerolls': 'missionFreeRerolls',
  'mission.pass_rerolls': 'missionPassRerolls',
  'feature.token': 'featureToken',
  'feature.stars_payments': 'featureStarsPayments',
  'feature.leaderboard': 'featureLeaderboard',
  'feature.referrals': 'featureReferrals',
};

/**
 * Safely resolves numeric configuration value, falling back to default if invalid,
 * NaN, Infinity, or negative (for non-negative parameters).
 */
function safeNumber(
  val: unknown,
  fallback: number,
  allowNegative = false,
): number {
  if (typeof val === 'number' && Number.isFinite(val)) {
    if (!allowNegative && val < 0) {
      return fallback;
    }
    return val;
  }
  if (typeof val === 'string') {
    const parsed = Number(val);
    if (Number.isFinite(parsed)) {
      if (!allowNegative && parsed < 0) {
        return fallback;
      }
      return parsed;
    }
  }
  return fallback;
}

/**
 * Safely resolves boolean configuration value.
 */
function safeBoolean(val: unknown, fallback: boolean): boolean {
  if (typeof val === 'boolean') {
    return val;
  }
  if (val === 'true') return true;
  if (val === 'false') return false;
  return fallback;
}

/**
 * 2-tier fallback resolver for EconomyConfig.
 * Tier 1: Valid database overrides (either snake_case or camelCase keys).
 * Tier 2: Hardcoded in-memory DEFAULT_ECONOMY_CONFIG.
 *
 * Never crashes or throws on missing, null, or corrupted inputs.
 */
export function resolveEconomyConfig(
  dbOverrides?: Record<string, unknown> | null,
): EconomyConfig {
  if (!dbOverrides || typeof dbOverrides !== 'object') {
    return { ...DEFAULT_ECONOMY_CONFIG };
  }

  // Normalize incoming overrides to camelCase
  const normalized: Partial<Record<keyof EconomyConfig, unknown>> = {};
  for (const [key, value] of Object.entries(dbOverrides)) {
    const mappedKey =
      CONFIG_KEY_MAP[key] ??
      (key in DEFAULT_ECONOMY_CONFIG
        ? (key as keyof EconomyConfig)
        : undefined);
    if (mappedKey) {
      normalized[mappedKey] = value;
    }
  }

  return {
    offlineCapFreeSec: safeNumber(
      normalized.offlineCapFreeSec,
      DEFAULT_ECONOMY_CONFIG.offlineCapFreeSec,
    ),
    offlineCapPassSec: safeNumber(
      normalized.offlineCapPassSec,
      DEFAULT_ECONOMY_CONFIG.offlineCapPassSec,
    ),
    upgradeCostGrowth: safeNumber(
      normalized.upgradeCostGrowth,
      DEFAULT_ECONOMY_CONFIG.upgradeCostGrowth,
    ),
    productionLevelGrowth: safeNumber(
      normalized.productionLevelGrowth,
      DEFAULT_ECONOMY_CONFIG.productionLevelGrowth,
    ),
    seasonSruBase: safeNumber(
      normalized.seasonSruBase,
      DEFAULT_ECONOMY_CONFIG.seasonSruBase,
    ),
    seasonSruRefQap: safeNumber(
      normalized.seasonSruRefQap,
      DEFAULT_ECONOMY_CONFIG.seasonSruRefQap,
    ),
    seasonSruExponent: safeNumber(
      normalized.seasonSruExponent,
      DEFAULT_ECONOMY_CONFIG.seasonSruExponent,
      true, // allowNegative
    ),
    seasonSruMin: safeNumber(
      normalized.seasonSruMin,
      DEFAULT_ECONOMY_CONFIG.seasonSruMin,
    ),
    seasonSruMax: safeNumber(
      normalized.seasonSruMax,
      DEFAULT_ECONOMY_CONFIG.seasonSruMax,
    ),
    referralBindWindowMin: safeNumber(
      normalized.referralBindWindowMin,
      DEFAULT_ECONOMY_CONFIG.referralBindWindowMin,
    ),
    referralDiminishThreshold: safeNumber(
      normalized.referralDiminishThreshold,
      DEFAULT_ECONOMY_CONFIG.referralDiminishThreshold,
    ),
    referralDiminishFloor: safeNumber(
      normalized.referralDiminishFloor,
      DEFAULT_ECONOMY_CONFIG.referralDiminishFloor,
    ),
    passPriceStars: safeNumber(
      normalized.passPriceStars,
      DEFAULT_ECONOMY_CONFIG.passPriceStars,
    ),
    passDurationDays: safeNumber(
      normalized.passDurationDays,
      DEFAULT_ECONOMY_CONFIG.passDurationDays,
    ),
    missionDailySlots: safeNumber(
      normalized.missionDailySlots,
      DEFAULT_ECONOMY_CONFIG.missionDailySlots,
    ),
    missionFreeRerolls: safeNumber(
      normalized.missionFreeRerolls,
      DEFAULT_ECONOMY_CONFIG.missionFreeRerolls,
    ),
    missionPassRerolls: safeNumber(
      normalized.missionPassRerolls,
      DEFAULT_ECONOMY_CONFIG.missionPassRerolls,
    ),
    featureToken: safeBoolean(
      normalized.featureToken,
      DEFAULT_ECONOMY_CONFIG.featureToken, // strictly false by default
    ),
    featureStarsPayments: safeBoolean(
      normalized.featureStarsPayments,
      DEFAULT_ECONOMY_CONFIG.featureStarsPayments,
    ),
    featureLeaderboard: safeBoolean(
      normalized.featureLeaderboard,
      DEFAULT_ECONOMY_CONFIG.featureLeaderboard,
    ),
    featureReferrals: safeBoolean(
      normalized.featureReferrals,
      DEFAULT_ECONOMY_CONFIG.featureReferrals,
    ),
  };
}

/**
 * Evaluates whether a feature flag is enabled.
 * Feature flags missing from the config default to false (or supplied fallback).
 * 'feature.token' strictly defaults to false unless explicitly set to true.
 */
export function isFeatureEnabled(
  flags: Record<string, unknown> | null | undefined,
  flagKey: string,
  fallback = false,
): boolean {
  if (!flags || typeof flags !== 'object') {
    return flagKey === 'feature.token' || flagKey === 'featureToken'
      ? false
      : fallback;
  }

  const raw =
    flags[flagKey] ??
    flags[CONFIG_KEY_MAP[flagKey] ?? ''] ??
    (Object.entries(CONFIG_KEY_MAP).find(([, camel]) => camel === flagKey)?.[0]
      ? flags[
          Object.entries(CONFIG_KEY_MAP).find(
            ([, camel]) => camel === flagKey,
          )![0]
        ]
      : undefined);

  if (typeof raw === 'boolean') {
    return raw;
  }
  if (raw === 'true') return true;
  if (raw === 'false') return false;

  return flagKey === 'feature.token' || flagKey === 'featureToken'
    ? false
    : fallback;
}

/**
 * Formats a consistent audit trail log entry for config or feature flag mutations.
 */
export function formatAuditEntry(params: {
  adminUserId?: string | null;
  action:
    | 'update_config'
    | 'set_feature_flag'
    | 'freeze_season'
    | 'ban_user'
    | 'refund_purchase';
  targetType:
    'economy_config' | 'feature_flag' | 'season' | 'user' | 'purchase';
  targetKey: string;
  oldValue: unknown;
  newValue: unknown;
  reason?: string | null;
}) {
  return {
    adminUserId: params.adminUserId ?? null,
    action: params.action,
    targetType: params.targetType,
    targetKey: params.targetKey,
    oldValue: params.oldValue,
    newValue: params.newValue,
    reason: params.reason ? params.reason.slice(0, 256) : null,
  };
}
