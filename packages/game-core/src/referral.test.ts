import { describe, expect, it } from 'vitest';
import {
  calculateReferralReward,
  evaluateInviteeMilestones,
  generateReferralDeepLink,
  getUnlockedReferralBadges,
  isSelfReferral,
  isWithinReferralBindWindow,
  parseReferralCodeFromStartParam,
  REFERRAL_BIND_WINDOW_MS,
} from './referral';

describe('referral engine pure logic', () => {
  describe('parseReferralCodeFromStartParam', () => {
    it('extracts valid referral codes with ref_ prefix', () => {
      expect(parseReferralCodeFromStartParam('ref_user123')).toBe('user123');
      expect(parseReferralCodeFromStartParam('ref_EMPIRE-99')).toBe(
        'EMPIRE-99',
      );
      expect(parseReferralCodeFromStartParam('ref_a1b2c3d4e5')).toBe(
        'a1b2c3d4e5',
      );
    });

    it('rejects invalid, malformed or empty start params', () => {
      expect(parseReferralCodeFromStartParam(null)).toBeNull();
      expect(parseReferralCodeFromStartParam(undefined)).toBeNull();
      expect(parseReferralCodeFromStartParam('')).toBeNull();
      expect(parseReferralCodeFromStartParam('user123')).toBeNull(); // Missing ref_ prefix
      expect(parseReferralCodeFromStartParam('ref_')).toBeNull(); // Empty code
      expect(parseReferralCodeFromStartParam('ref_ab')).toBeNull(); // Too short (< 4 chars)
      expect(parseReferralCodeFromStartParam('ref_invalid!chars@')).toBeNull();
    });
  });

  describe('generateReferralDeepLink', () => {
    it('produces canonical Telegram Mini App deep links', () => {
      const link = generateReferralDeepLink('EmpireGameBot', 'ABC123XY');
      expect(link).toBe('https://t.me/EmpireGameBot?startapp=ref_ABC123XY');
    });
  });

  describe('isWithinReferralBindWindow', () => {
    const now = 1000000;

    it('allows binding within 30 minutes', () => {
      expect(isWithinReferralBindWindow(now - 5 * 60 * 1000, now)).toBe(true);
      expect(
        isWithinReferralBindWindow(now - REFERRAL_BIND_WINDOW_MS, now),
      ).toBe(true);
    });

    it('denies binding after 30 minutes', () => {
      expect(isWithinReferralBindWindow(now - 31 * 60 * 1000, now)).toBe(false);
      expect(
        isWithinReferralBindWindow(now - 2 * REFERRAL_BIND_WINDOW_MS, now),
      ).toBe(false);
    });

    it('rejects future timestamps', () => {
      expect(isWithinReferralBindWindow(now + 1000, now)).toBe(false);
    });
  });

  describe('isSelfReferral', () => {
    it('detects identical telegram user IDs', () => {
      expect(isSelfReferral('12345678', '12345678')).toBe(true);
      expect(isSelfReferral('  12345678  ', '12345678')).toBe(true);
    });

    it('allows distinct telegram IDs', () => {
      expect(isSelfReferral('12345678', '87654321')).toBe(false);
    });
  });

  describe('calculateReferralReward', () => {
    const sru = 400;

    it('calculates full milestone rewards for regular referral volume (<= 20)', () => {
      // Activation: 0.50 * 400 = 200
      expect(calculateReferralReward('activation', sru, 10)).toBe(200);

      // Retained D2: 1.00 * 400 = 400
      expect(calculateReferralReward('retained_d2', sru, 10)).toBe(400);

      // Retained D7: 2.00 * 400 = 800
      expect(calculateReferralReward('retained_d7', sru, 10)).toBe(800);

      // Progression: 1.50 * 400 = 600
      expect(calculateReferralReward('progression', sru, 10)).toBe(600);

      // Total of all 4 milestones = 5.0 * 400 = 2000 points
      const total =
        calculateReferralReward('activation', sru, 20) +
        calculateReferralReward('retained_d2', sru, 20) +
        calculateReferralReward('retained_d7', sru, 20) +
        calculateReferralReward('progression', sru, 20);
      expect(total).toBe(2000);
    });

    it('applies whale diminishing factor when qualified count > 20', () => {
      // Q = 80 -> factor = sqrt(20 / 80) = 0.5
      // Retained D7 base: 2.0 * 400 = 800 * 0.5 = 400
      expect(calculateReferralReward('retained_d7', sru, 80)).toBe(400);

      // Q = 320 -> factor = 0.25 (floor)
      // Retained D7 base: 800 * 0.25 = 200
      expect(calculateReferralReward('retained_d7', sru, 320)).toBe(200);
    });
  });

  describe('evaluateInviteeMilestones', () => {
    const now = Date.now();

    it('awards activation only when tutorial is completed and has business', () => {
      const incomplete = evaluateInviteeMilestones({
        hasCompletedTutorial: false,
        highestBusinessLevel: 1,
        totalEmpireLevels: 1,
        distinctActiveDays: 1,
        registrationTimestampMs: now,
        currentTimestampMs: now,
      });
      expect(incomplete).not.toContain('activation');

      const completed = evaluateInviteeMilestones({
        hasCompletedTutorial: true,
        highestBusinessLevel: 1,
        totalEmpireLevels: 1,
        distinctActiveDays: 1,
        registrationTimestampMs: now,
        currentTimestampMs: now,
      });
      expect(completed).toEqual(['activation']);
    });

    it('awards retained_d2 when distinct active days >= 2', () => {
      const milestones = evaluateInviteeMilestones({
        hasCompletedTutorial: true,
        highestBusinessLevel: 2,
        totalEmpireLevels: 2,
        distinctActiveDays: 2,
        registrationTimestampMs: now - 2 * 24 * 3600 * 1000,
        currentTimestampMs: now,
      });
      expect(milestones).toContain('activation');
      expect(milestones).toContain('retained_d2');
      expect(milestones).not.toContain('retained_d7');
    });

    it('awards retained_d7 and progression when conditions are fully met', () => {
      const milestones = evaluateInviteeMilestones({
        hasCompletedTutorial: true,
        highestBusinessLevel: 5,
        totalEmpireLevels: 12,
        distinctActiveDays: 5,
        registrationTimestampMs: now - 6 * 24 * 3600 * 1000,
        currentTimestampMs: now,
      });
      expect(milestones).toEqual([
        'activation',
        'retained_d2',
        'retained_d7',
        'progression',
      ]);
    });
  });

  describe('getUnlockedReferralBadges', () => {
    it('returns empty list for 0 referrals', () => {
      expect(getUnlockedReferralBadges(0)).toHaveLength(0);
    });

    it('unlocks tiers progressively', () => {
      expect(getUnlockedReferralBadges(1).map((b) => b.badgeKey)).toEqual([
        'badge_early_connector',
      ]);

      const badges5 = getUnlockedReferralBadges(5).map((b) => b.badgeKey);
      expect(badges5).toContain('pass_7d');
      expect(badges5).toHaveLength(3);

      const badges100 = getUnlockedReferralBadges(100);
      expect(badges100).toHaveLength(7);
      expect(badges100[badges100.length - 1]?.badgeKey).toBe(
        'ambassador_eligibility',
      );
    });
  });
});
