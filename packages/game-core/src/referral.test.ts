import { describe, expect, it } from 'vitest';
import {
  calculatePassiveCommission,
  calculateReferralReward,
  calculateReferralKickback,
  calculateReferralStarterBonus,
  evaluateInviteeCashMilestones,
  evaluateInviteeMilestones,
  generateReferralDeepLink,
  getReferralCommissionRate,
  getUnlockedReferralBadges,
  isSelfReferral,
  isWithinReferralBindWindow,
  parseReferralCodeFromStartParam,
  REFERRAL_BIND_WINDOW_MS,
  REFERRAL_CASH_KICKBACK_RATE,
  REFERRAL_COMMISSION_TIERS,
  REFERRAL_MUTUAL_STARTER_CASH,
  TELEGRAM_PREMIUM_REFERRAL_MULTIPLIER,
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

  describe('calculateReferralKickback and invitee cash milestones', () => {
    it('calculates 1-in-1000 (0.1%) kickback accurately', () => {
      // Exactly 1,000,000 earned -> 1,000 cash kickback to referrer
      expect(calculateReferralKickback(1_000_000)).toBe(1_000);
      expect(calculateReferralKickback(100_000)).toBe(100);
      expect(calculateReferralKickback(10_000_000)).toBe(10_000);
      expect(calculateReferralKickback(500)).toBe(0); // Floor of 0.5
      expect(calculateReferralKickback(0)).toBe(0);
      expect(calculateReferralKickback(-1000)).toBe(0);
    });

    it('evaluates invitee cumulative cash milestones accurately', () => {
      // At 500K cumulative earnings, only 100K milestone is reached
      const m1 = evaluateInviteeCashMilestones(500_000, []);
      expect(m1.map((m) => m.targetCash)).toEqual([100_000]);

      // At 1.5M cumulative earnings, both 100K and 1M milestones are reached
      const m2 = evaluateInviteeCashMilestones(1_500_000, [100_000]);
      expect(m2.map((m) => m.targetCash)).toEqual([1_000_000]);
      expect(m2[0]?.rewardCash).toBe(1_000);

      // At 15M cumulative earnings with 100K and 1M already claimed
      const m3 = evaluateInviteeCashMilestones(
        15_000_000,
        [100_000, 1_000_000],
      );
      expect(m3.map((m) => m.targetCash)).toEqual([10_000_000]);
      expect(m3[0]?.rewardCash).toBe(10_000);
    });
  });

  describe('tiered referral commission & turnover rate', () => {
    describe('getReferralCommissionRate', () => {
      it('returns 3% (0.03) for 0 to 10 invites', () => {
        expect(getReferralCommissionRate(0)).toBe(0.03);
        expect(getReferralCommissionRate(1)).toBe(0.03);
        expect(getReferralCommissionRate(5)).toBe(0.03);
        expect(getReferralCommissionRate(10)).toBe(0.03);
      });

      it('returns 5% (0.05) for 11 to 30 invites', () => {
        expect(getReferralCommissionRate(11)).toBe(0.05);
        expect(getReferralCommissionRate(20)).toBe(0.05);
        expect(getReferralCommissionRate(29)).toBe(0.05);
        expect(getReferralCommissionRate(30)).toBe(0.05);
      });

      it('returns 7% (0.07) for 31+ invites', () => {
        expect(getReferralCommissionRate(31)).toBe(0.07);
        expect(getReferralCommissionRate(50)).toBe(0.07);
        expect(getReferralCommissionRate(100)).toBe(0.07);
        expect(getReferralCommissionRate(500)).toBe(0.07);
      });

      it('strictly tests boundaries at 0, 1, 10, 11, 29, 30, 31, 100', () => {
        const expectedMap: Record<number, number> = {
          0: 0.03,
          1: 0.03,
          10: 0.03,
          11: 0.05,
          29: 0.05,
          30: 0.05,
          31: 0.07,
          100: 0.07,
        };
        for (const [invites, rate] of Object.entries(expectedMap)) {
          expect(getReferralCommissionRate(Number(invites))).toBe(rate);
        }
      });
    });

    describe('calculatePassiveCommission', () => {
      it('calculates tiered commission accurately: 30K for 3%, 50K for 5%, 70K for 7% per 1M cash', () => {
        // Tier 1 (<= 10 invites, 3%): 1,000,000 * 0.03 = 30,000
        expect(calculatePassiveCommission(1_000_000, 5)).toBe(30_000);
        expect(calculatePassiveCommission(1_000_000, 10)).toBe(30_000);

        // Tier 2 (11-30 invites, 5%): 1,000,000 * 0.05 = 50,000
        expect(calculatePassiveCommission(1_000_000, 11)).toBe(50_000);
        expect(calculatePassiveCommission(1_000_000, 30)).toBe(50_000);

        // Tier 3 (31+ invites, 7%): 1,000,000 * 0.07 = 70,000
        expect(calculatePassiveCommission(1_000_000, 31)).toBe(70_000);
        expect(calculatePassiveCommission(1_000_000, 100)).toBe(70_000);
      });

      it('contrasts passive commission with direct 0.1% kickback (1 in 1000)', () => {
        const earned = 1_000_000;
        // Direct kickback is exactly 1,000 cash (0.1%)
        expect(calculateReferralKickback(earned)).toBe(1_000);
        expect(REFERRAL_CASH_KICKBACK_RATE).toBe(0.001);

        // Passive commission is 30x to 70x higher than direct kickback
        const passiveTier1 = calculatePassiveCommission(earned, 5);
        expect(passiveTier1).toBe(30_000);
        expect(passiveTier1 / calculateReferralKickback(earned)).toBe(30);

        const passiveTier3 = calculatePassiveCommission(earned, 50);
        expect(passiveTier3).toBe(70_000);
        expect(passiveTier3 / calculateReferralKickback(earned)).toBe(70);
      });

      it('returns 0 for zero or negative invitee earnings', () => {
        expect(calculatePassiveCommission(0, 10)).toBe(0);
        expect(calculatePassiveCommission(-5000, 10)).toBe(0);
        expect(calculatePassiveCommission(0, 50)).toBe(0);
      });

      it('truncates fractional earnings via Math.floor', () => {
        // 33 cash * 0.03 = 0.99 -> Math.floor = 0
        expect(calculatePassiveCommission(33, 5)).toBe(0);
        // 34 cash * 0.03 = 1.02 -> Math.floor = 1
        expect(calculatePassiveCommission(34, 5)).toBe(1);
      });
    });

    describe('REFERRAL_COMMISSION_TIERS constant specification', () => {
      it('defines the 3 canonical tiers with contiguous invite ranges and matching rates', () => {
        expect(REFERRAL_COMMISSION_TIERS).toHaveLength(3);

        expect(REFERRAL_COMMISSION_TIERS[0]).toEqual({
          minInvites: 0,
          maxInvites: 10,
          ratePercent: 3,
          rateDecimal: 0.03,
        });

        expect(REFERRAL_COMMISSION_TIERS[1]).toEqual({
          minInvites: 11,
          maxInvites: 30,
          ratePercent: 5,
          rateDecimal: 0.05,
        });

        expect(REFERRAL_COMMISSION_TIERS[2]).toEqual({
          minInvites: 31,
          maxInvites: Infinity,
          ratePercent: 7,
          rateDecimal: 0.07,
        });
      });
    });

    describe('calculateReferralStarterBonus & Telegram Premium multiplier', () => {
      it('returns base 5,000 Cash for standard users', () => {
        const bonus = calculateReferralStarterBonus(false);
        expect(bonus.cashBonus).toBe(REFERRAL_MUTUAL_STARTER_CASH);
        expect(bonus.multiplier).toBe(1);
        expect(bonus.cashBonus).toBe(5000);
      });

      it('returns 3x (15,000 Cash) for Telegram Premium users', () => {
        const bonus = calculateReferralStarterBonus(true);
        expect(bonus.multiplier).toBe(TELEGRAM_PREMIUM_REFERRAL_MULTIPLIER);
        expect(bonus.multiplier).toBe(3);
        expect(bonus.cashBonus).toBe(15000);
      });
    });
  });
});
