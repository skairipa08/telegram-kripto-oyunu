import { describe, expect, it } from 'vitest';
import {
  calculateActivationRate,
  calculateARPPU,
  calculatePayerConversion,
  calculateRetentionCohorts,
  CANONICAL_ANALYTICS_EVENTS,
  daysBetweenUtc,
  evaluateReferralRetention,
  isCanonicalAnalyticsEvent,
  toUtcDateString,
  type UserCohortData,
} from './analytics';

describe('Analytics Pipeline & Cohort Models', () => {
  it('validates all 21 canonical Blueprint Section 18 events', () => {
    expect(CANONICAL_ANALYTICS_EVENTS).toHaveLength(21);

    expect(isCanonicalAnalyticsEvent('app_open')).toBe(true);
    expect(isCanonicalAnalyticsEvent('cash_claim')).toBe(true);
    expect(isCanonicalAnalyticsEvent('pass_activated')).toBe(true);
    expect(isCanonicalAnalyticsEvent('referral_milestone_qualified')).toBe(
      true,
    );

    // Non-canonical events should fail
    expect(isCanonicalAnalyticsEvent('user_clicked_button')).toBe(false);
    expect(isCanonicalAnalyticsEvent('')).toBe(false);
    expect(isCanonicalAnalyticsEvent('random_event')).toBe(false);
  });

  it('normalizes timestamps to UTC calendar days and measures differences', () => {
    // 2026-09-14 23:59:00 UTC vs 2026-09-15 00:01:00 UTC
    const d1 = '2026-09-14T23:59:00.000Z';
    const d2 = '2026-09-15T00:01:00.000Z';

    expect(toUtcDateString(d1)).toBe('2026-09-14');
    expect(toUtcDateString(d2)).toBe('2026-09-15');
    expect(daysBetweenUtc(d1, d2)).toBe(1);
  });

  it('computes D1, D2, and D7 retention cohorts accurately', () => {
    const users: UserCohortData[] = [
      {
        userId: 'u1',
        signupDate: '2026-09-10T10:00:00Z',
        activeDates: [
          '2026-09-10T12:00:00Z', // D0
          '2026-09-11T09:00:00Z', // D1
          '2026-09-12T14:00:00Z', // D2
          '2026-09-17T18:00:00Z', // D7
        ],
      },
      {
        userId: 'u2',
        signupDate: '2026-09-10T11:00:00Z',
        activeDates: [
          '2026-09-10T11:00:00Z', // D0
          '2026-09-11T12:00:00Z', // D1
          '2026-09-11T16:00:00Z', // duplicate D1 session
          // No D2, No D7
        ],
      },
      {
        userId: 'u3',
        signupDate: '2026-09-10T15:00:00Z',
        activeDates: [
          '2026-09-10T15:00:00Z', // D0
          // Inactive afterwards
        ],
      },
      {
        userId: 'u4',
        signupDate: '2026-09-11T08:00:00Z',
        activeDates: [
          '2026-09-11T08:00:00Z',
          '2026-09-12T08:00:00Z', // D1 for 2026-09-11 cohort
        ],
      },
    ];

    const cohorts = calculateRetentionCohorts(users);
    expect(cohorts).toHaveLength(2);

    // Cohort 2026-09-10: 3 signups
    const c1 = cohorts[0]!;
    expect(c1.cohortDate).toBe('2026-09-10');
    expect(c1.totalSignups).toBe(3);
    // D1: u1 and u2 (2/3 = 0.6667)
    expect(c1.d1Count).toBe(2);
    expect(c1.d1Rate).toBe(0.6667);
    // D2: u1 only (1/3 = 0.3333)
    expect(c1.d2Count).toBe(1);
    expect(c1.d2Rate).toBe(0.3333);
    // D7: u1 only (1/3 = 0.3333)
    expect(c1.d7Count).toBe(1);
    expect(c1.d7Rate).toBe(0.3333);

    // Cohort 2026-09-11: 1 signup
    const c2 = cohorts[1]!;
    expect(c2.cohortDate).toBe('2026-09-11');
    expect(c2.totalSignups).toBe(1);
    expect(c2.d1Count).toBe(1);
    expect(c2.d1Rate).toBe(1.0);
    expect(c2.d2Count).toBe(0);
    expect(c2.d7Count).toBe(0);
  });

  it('handles empty cohorts without error', () => {
    expect(calculateRetentionCohorts([])).toEqual([]);
  });

  it('evaluates referral retention milestones (retained_d2 and retained_d7)', () => {
    const boundDate = '2026-09-01T12:00:00Z';

    // Qualifies for D2 (>= 2 distinct days) and D7 (>= 4 distinct days within 7d window)
    const qualifyingUser = evaluateReferralRetention(boundDate, [
      '2026-09-01T12:00:00Z', // day 0
      '2026-09-02T10:00:00Z', // day 1
      '2026-09-04T11:00:00Z', // day 3
      '2026-09-07T15:00:00Z', // day 6
      '2026-09-07T20:00:00Z', // duplicate day 6
    ]);
    expect(qualifyingUser.isD2Qualified).toBe(true);
    expect(qualifyingUser.isD7Qualified).toBe(true);
    expect(qualifyingUser.distinctActiveDaysTotal).toBe(4);
    expect(qualifyingUser.distinctActiveDaysInWindow).toBe(4);

    // Fails D7 if sessions occurred outside the 7-day window
    const outsideWindowUser = evaluateReferralRetention(boundDate, [
      '2026-09-01T12:00:00Z', // day 0
      '2026-09-02T10:00:00Z', // day 1
      '2026-09-03T10:00:00Z', // day 2
      '2026-09-15T10:00:00Z', // day 14 (outside window)
      '2026-09-16T10:00:00Z', // day 15 (outside window)
    ]);
    expect(outsideWindowUser.isD2Qualified).toBe(true);
    expect(outsideWindowUser.isD7Qualified).toBe(false); // only 3 days within [0..7]
    expect(outsideWindowUser.distinctActiveDaysTotal).toBe(5);
    expect(outsideWindowUser.distinctActiveDaysInWindow).toBe(3);
  });

  it('calculates monetization and KPI metrics safely', () => {
    // Division by zero safety
    expect(calculateActivationRate(0, 0)).toBe(0);
    expect(calculatePayerConversion(0, 0)).toBe(0);
    expect(calculateARPPU(0, 0)).toBe(0);

    // Normal values
    expect(calculateActivationRate(100, 42)).toBe(0.42);
    expect(calculatePayerConversion(1000, 50)).toBe(0.05);
    expect(calculateARPPU(12500, 50)).toBe(250); // 250 Stars per payer
  });
});
