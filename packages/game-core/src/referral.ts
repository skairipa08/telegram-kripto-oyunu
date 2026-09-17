/**
 * Pure deterministic referral engine logic for Project Empire.
 * Side-effect free, independent of network, database, or UI.
 */

import { calculateReferralWhaleFactor } from './formulas';

export type ReferralMilestone =
  'activation' | 'retained_d2' | 'retained_d7' | 'progression';

export interface ReferralMilestoneDefinition {
  readonly milestone: ReferralMilestone;
  readonly title: string;
  readonly description: string;
  readonly sruMultiplier: number;
}

export const REFERRAL_MILESTONES: Record<
  ReferralMilestone,
  ReferralMilestoneDefinition
> = {
  activation: {
    milestone: 'activation',
    title: 'Aktivasyon',
    description: 'İlk işletme yükseltmesi tamamlandı',
    sruMultiplier: 0.5,
  },
  retained_d2: {
    milestone: 'retained_d2',
    title: 'D2 Sadakat',
    description: 'En az 2 ayrı günde aktif oturum',
    sruMultiplier: 1.0,
  },
  retained_d7: {
    milestone: 'retained_d7',
    title: 'D7 Sadakat',
    description: '7 günlük pencerede en az 4 aktif gün',
    sruMultiplier: 2.0,
  },
  progression: {
    milestone: 'progression',
    title: 'İmparatorluk Ölçeği',
    description: 'Toplam işletme seviyesi 10 veya üzerine ulaştı',
    sruMultiplier: 1.5,
  },
};

export const REFERRAL_STARTER_CASH_BOOST = 500;
export const REFERRAL_MUTUAL_STARTER_CASH = 5000;
export const REFERRAL_BIND_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

export interface ReferralCommissionTier {
  readonly minInvites: number;
  readonly maxInvites: number;
  readonly ratePercent: number;
  readonly rateDecimal: number;
}

export const REFERRAL_COMMISSION_TIERS: readonly ReferralCommissionTier[] = [
  { minInvites: 0, maxInvites: 10, ratePercent: 3, rateDecimal: 0.03 },
  { minInvites: 11, maxInvites: 30, ratePercent: 5, rateDecimal: 0.05 },
  { minInvites: 31, maxInvites: Infinity, ratePercent: 7, rateDecimal: 0.07 },
];

/**
 * Returns the passive earning commission rate for a referrer based on active invite count:
 * 0 - 10 invites: 3% (0.03)
 * 11 - 30 invites: 5% (0.05)
 * 31+ invites: 7% (0.07)
 */
export function getReferralCommissionRate(inviteCount: number): number {
  if (inviteCount <= 10) return 0.03;
  if (inviteCount <= 30) return 0.05;
  return 0.07;
}

/**
 * Calculates passive commission earned by referrer from an invitee's generated cash.
 */
export function calculatePassiveCommission(
  inviteeEarnedCash: number,
  inviteCount: number,
): number {
  if (inviteeEarnedCash <= 0) return 0;
  const rate = getReferralCommissionRate(inviteCount);
  return Math.floor(inviteeEarnedCash * rate);
}

/**
 * Direct cash kickback rate from invitee's total earnings:
 * 1 in 1000 = 0.1% (0.001)
 */
export const REFERRAL_CASH_KICKBACK_RATE = 0.001;

/**
 * Calculates the direct 0.1% (1/1000) kickback reward for referrer when invitee earns cash.
 * E.g., when invitee earns 1,000,000 cash, referrer receives exactly 1,000 cash.
 */
export function calculateReferralKickback(earnedCash: number): number {
  if (earnedCash <= 0) return 0;
  return Math.floor(earnedCash * REFERRAL_CASH_KICKBACK_RATE);
}

export interface InviteeCashMilestone {
  readonly targetCash: number;
  readonly rewardCash: number;
  readonly label: string;
}

export const INVITEE_CASH_MILESTONES: readonly InviteeCashMilestone[] = [
  { targetCash: 100_000, rewardCash: 100, label: '100K Ciro' },
  { targetCash: 1_000_000, rewardCash: 1_000, label: '1M Ciro' },
  { targetCash: 10_000_000, rewardCash: 10_000, label: '10M Ciro' },
  { targetCash: 100_000_000, rewardCash: 100_000, label: '100M Ciro' },
  { targetCash: 1_000_000_000, rewardCash: 1_000_000, label: '1B Ciro' },
] as const;

/**
 * Evaluates newly reached cumulative cash milestones that have not yet been claimed.
 */
export function evaluateInviteeCashMilestones(
  cumulativeCash: number,
  claimedTargets: readonly number[] = [],
): InviteeCashMilestone[] {
  return INVITEE_CASH_MILESTONES.filter(
    (m) =>
      cumulativeCash >= m.targetCash && !claimedTargets.includes(m.targetCash),
  );
}

export interface InviteeStats {
  readonly hasCompletedTutorial: boolean;
  readonly highestBusinessLevel: number;
  readonly totalEmpireLevels: number;
  readonly distinctActiveDays: number;
  readonly registrationTimestampMs: number;
  readonly currentTimestampMs: number;
}

export interface ReferralTierBadge {
  readonly requiredCount: number;
  readonly badgeKey: string;
  readonly title: string;
}

export const REFERRAL_TIER_BADGES: readonly ReferralTierBadge[] = [
  {
    requiredCount: 1,
    badgeKey: 'badge_early_connector',
    title: 'Early Connector',
  },
  {
    requiredCount: 3,
    badgeKey: 'preset_extra_automation',
    title: 'Extra Automation Preset',
  },
  { requiredCount: 5, badgeKey: 'pass_7d', title: '7 Günlük Convenience Pass' },
  {
    requiredCount: 10,
    badgeKey: 'frame_exclusive_referral',
    title: 'Exclusive Referral Frame',
  },
  {
    requiredCount: 25,
    badgeKey: 'emblem_custom_slot',
    title: 'Custom Emblem Slot',
  },
  {
    requiredCount: 50,
    badgeKey: 'cosmetic_founder_set',
    title: 'Founder Tier Cosmetic Set',
  },
  {
    requiredCount: 100,
    badgeKey: 'ambassador_eligibility',
    title: 'Ambassador Eligibility',
  },
] as const;

/**
 * Extracts referral code from Telegram Mini App startapp / tg_share parameter.
 * Pattern: "ref_<code>" -> returns "<code>"
 */
export function parseReferralCodeFromStartParam(
  startParam: string | null | undefined,
): string | null {
  if (!startParam) return null;
  const trimmed = startParam.trim();
  const match = trimmed.match(/^ref_([a-zA-Z0-9_-]{4,32})$/);
  return match ? match[1]! : null;
}

/**
 * Generates the canonical Telegram deep link for referral sharing.
 */
export function generateReferralDeepLink(
  botUsername: string,
  referralCode: string,
): string {
  return `https://t.me/${botUsername}?startapp=ref_${referralCode}`;
}

/**
 * Validates if the referral binding is occurring within the allowed 30-minute window.
 */
export function isWithinReferralBindWindow(
  userCreatedAtMs: number,
  currentTimestampMs: number,
  windowMs = REFERRAL_BIND_WINDOW_MS,
): boolean {
  if (currentTimestampMs < userCreatedAtMs) return false;
  return currentTimestampMs - userCreatedAtMs <= windowMs;
}

/**
 * Checks for direct self-referral attempt.
 */
export function isSelfReferral(
  referrerTelegramId: string,
  inviteeTelegramId: string,
): boolean {
  return referrerTelegramId.trim() === inviteeTelegramId.trim();
}

/**
 * Calculates the exact Season Points reward for a referral milestone,
 * taking into account the referral whale diminishing factor after 20 qualified referrals.
 * Formula: round(multiplier * SRU * factor(Q))
 */
export function calculateReferralReward(
  milestone: ReferralMilestone,
  currentSRU: number,
  qualifiedCount: number,
): number {
  const definition = REFERRAL_MILESTONES[milestone];
  const whaleFactor = calculateReferralWhaleFactor(qualifiedCount);
  const rawPoints = definition.sruMultiplier * currentSRU * whaleFactor;
  return Math.round(rawPoints);
}

/**
 * Pure evaluation of which referral milestones an invitee currently satisfies.
 */
export function evaluateInviteeMilestones(
  stats: InviteeStats,
): ReferralMilestone[] {
  const satisfied: ReferralMilestone[] = [];

  // Activation: tutorial done + at least one business at level >= 1
  if (stats.hasCompletedTutorial && stats.highestBusinessLevel >= 1) {
    satisfied.push('activation');
  }

  // D2 Retention: at least 2 distinct active days
  if (stats.distinctActiveDays >= 2) {
    satisfied.push('retained_d2');
  }

  // D7 Retention: in 7-day window (<= 7 days from reg), at least 4 active days
  const elapsedDays =
    (stats.currentTimestampMs - stats.registrationTimestampMs) /
    (1000 * 60 * 60 * 24);
  if (elapsedDays <= 7.5 && stats.distinctActiveDays >= 4) {
    satisfied.push('retained_d7');
  }

  // Progression: total empire levels >= 10
  if (stats.totalEmpireLevels >= 10) {
    satisfied.push('progression');
  }

  return satisfied;
}

/**
 * Returns the unlocked cosmetic and non-P2W tier badges based on qualified referral count.
 */
export function getUnlockedReferralBadges(
  qualifiedCount: number,
): ReferralTierBadge[] {
  return REFERRAL_TIER_BADGES.filter(
    (tier) => qualifiedCount >= tier.requiredCount,
  );
}
