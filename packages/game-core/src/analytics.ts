/**
 * Canonical Analytics Taxonomy (Blueprint Section 18)
 * Exactly 21 canonical event names.
 */
export const CANONICAL_ANALYTICS_EVENTS = [
  'app_open',
  'auth_success',
  'tutorial_complete',
  'business_upgrade',
  'cash_claim',
  'mission_assigned',
  'mission_complete',
  'mission_claim',
  'streak_claim',
  'referral_link_copy',
  'referral_bound',
  'referral_milestone_qualified',
  'referral_reward_claim',
  'leaderboard_view',
  'shop_view',
  'invoice_created',
  'payment_success',
  'payment_refund',
  'fraud_flag_created',
  'reward_frozen',
  'pass_activated',
] as const;

export type CanonicalAnalyticsEventName =
  (typeof CANONICAL_ANALYTICS_EVENTS)[number];

/**
 * Checks whether an event name adheres to the Blueprint Section 18 taxonomy.
 */
export function isCanonicalAnalyticsEvent(
  name: string,
): name is CanonicalAnalyticsEventName {
  return (CANONICAL_ANALYTICS_EVENTS as readonly string[]).includes(name);
}

/**
 * Normalizes any date to UTC YYYY-MM-DD calendar day.
 */
export function toUtcDateString(date: Date | string | number): string {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Computes calendar day difference (target - start) in UTC.
 */
export function daysBetweenUtc(
  startDate: string | Date,
  targetDate: string | Date,
): number {
  const startStr = toUtcDateString(startDate);
  const targetStr = toUtcDateString(targetDate);

  const startMs = Date.UTC(
    Number(startStr.slice(0, 4)),
    Number(startStr.slice(5, 7)) - 1,
    Number(startStr.slice(8, 10)),
  );
  const targetMs = Date.UTC(
    Number(targetStr.slice(0, 4)),
    Number(targetStr.slice(5, 7)) - 1,
    Number(targetStr.slice(8, 10)),
  );

  return Math.round((targetMs - startMs) / 86_400_000);
}

/**
 * Adds N calendar days to a UTC YYYY-MM-DD date string.
 */
export function addDaysUtc(dateStr: string, days: number): string {
  const ms = Date.UTC(
    Number(dateStr.slice(0, 4)),
    Number(dateStr.slice(5, 7)) - 1,
    Number(dateStr.slice(8, 10)),
  );
  return toUtcDateString(new Date(ms + days * 86_400_000));
}

export interface UserCohortData {
  userId: string;
  signupDate: string | Date;
  activeDates: readonly (string | Date)[];
}

export interface RetentionCohort {
  cohortDate: string; // YYYY-MM-DD
  totalSignups: number;
  d1Count: number;
  d1Rate: number;
  d2Count: number;
  d2Rate: number;
  d7Count: number;
  d7Rate: number;
}

/**
 * Pure calculation of D1, D2, and D7 retention cohorts from user activity logs.
 * Cohort date is determined by signup calendar day in UTC.
 */
export function calculateRetentionCohorts(
  users: readonly UserCohortData[],
): RetentionCohort[] {
  // Group users by signup cohort date (UTC)
  const cohortMap = new Map<string, UserCohortData[]>();

  for (const user of users) {
    const cohortDate = toUtcDateString(user.signupDate);
    const existing = cohortMap.get(cohortDate);
    if (existing) {
      existing.push(user);
    } else {
      cohortMap.set(cohortDate, [user]);
    }
  }

  const results: RetentionCohort[] = [];

  for (const [cohortDate, cohortUsers] of cohortMap.entries()) {
    const totalSignups = cohortUsers.length;
    let d1Count = 0;
    let d2Count = 0;
    let d7Count = 0;

    const d1Target = addDaysUtc(cohortDate, 1);
    const d2Target = addDaysUtc(cohortDate, 2);
    const d7Target = addDaysUtc(cohortDate, 7);

    for (const u of cohortUsers) {
      // Deduplicate active days
      const distinctActiveDays = new Set(
        u.activeDates.map((d) => toUtcDateString(d)),
      );

      if (distinctActiveDays.has(d1Target)) {
        d1Count += 1;
      }
      if (distinctActiveDays.has(d2Target)) {
        d2Count += 1;
      }
      if (distinctActiveDays.has(d7Target)) {
        d7Count += 1;
      }
    }

    const d1Rate =
      totalSignups > 0
        ? Math.round((d1Count / totalSignups) * 10000) / 10000
        : 0;
    const d2Rate =
      totalSignups > 0
        ? Math.round((d2Count / totalSignups) * 10000) / 10000
        : 0;
    const d7Rate =
      totalSignups > 0
        ? Math.round((d7Count / totalSignups) * 10000) / 10000
        : 0;

    results.push({
      cohortDate,
      totalSignups,
      d1Count,
      d1Rate,
      d2Count,
      d2Rate,
      d7Count,
      d7Rate,
    });
  }

  // Sort ascending by cohort date
  return results.sort((a, b) => a.cohortDate.localeCompare(b.cohortDate));
}

export interface ReferralRetentionResult {
  isD2Qualified: boolean;
  isD7Qualified: boolean;
  distinctActiveDaysTotal: number;
  distinctActiveDaysInWindow: number;
}

/**
 * Evaluates invitee retention requirements for referral milestones:
 * - retained_d2: Active on at least 2 distinct calendar days.
 * - retained_d7: Active on >= 4 distinct calendar days within the 7-day window [boundDate, boundDate + 7 days].
 */
export function evaluateReferralRetention(
  boundDate: string | Date,
  activeDates: readonly (string | Date)[],
): ReferralRetentionResult {
  const boundStr = toUtcDateString(boundDate);
  const distinctDays = Array.from(
    new Set(activeDates.map((d) => toUtcDateString(d))),
  );

  const windowDays = distinctDays.filter((dateStr) => {
    const diff = daysBetweenUtc(boundStr, dateStr);
    return diff >= 0 && diff <= 7;
  });

  return {
    isD2Qualified: distinctDays.length >= 2,
    isD7Qualified: windowDays.length >= 4,
    distinctActiveDaysTotal: distinctDays.length,
    distinctActiveDaysInWindow: windowDays.length,
  };
}

/**
 * Calculates user activation rate (activated users / total signups).
 * Safe against division by zero.
 */
export function calculateActivationRate(
  totalSignups: number,
  activatedUsers: number,
): number {
  if (totalSignups <= 0 || activatedUsers <= 0) {
    return 0;
  }
  const rate = activatedUsers / totalSignups;
  return Math.round(rate * 10000) / 10000;
}

/**
 * Calculates payer conversion rate (paying users / total users).
 * Safe against division by zero.
 */
export function calculatePayerConversion(
  totalUsers: number,
  payingUsers: number,
): number {
  if (totalUsers <= 0 || payingUsers <= 0) {
    return 0;
  }
  const rate = payingUsers / totalUsers;
  return Math.round(rate * 10000) / 10000;
}

/**
 * Calculates Average Revenue Per Paying User (ARPPU) in Telegram Stars.
 * Safe against division by zero.
 */
export function calculateARPPU(
  totalRevenueStars: number,
  payingUsers: number,
): number {
  if (payingUsers <= 0 || totalRevenueStars <= 0) {
    return 0;
  }
  const arppu = totalRevenueStars / payingUsers;
  return Math.round(arppu * 100) / 100;
}
