import { describe, expect, it } from 'vitest';
import {
  calculateMissionReward,
  calculateStreakReward,
  DEFAULT_MISSIONS,
  evaluateStreak,
  getIsoWeekDateString,
  hashString,
  isMissionCompleted,
  selectMissionPool,
} from './missions';

describe('missions and streak formulas', () => {
  describe('calculateMissionReward', () => {
    it('calculates rewards matching Blueprint SRU multipliers', () => {
      const sru = 400;

      // Easy: 0.75 * 400 = 300
      expect(calculateMissionReward('easy', sru)).toBe(300);

      // Normal: 1.00 * 400 = 400
      expect(calculateMissionReward('normal', sru)).toBe(400);

      // Hard: 1.25 * 400 = 500
      expect(calculateMissionReward('hard', sru)).toBe(500);

      // Weekly: 5.00 * 400 = 2000
      expect(calculateMissionReward('weekly', sru)).toBe(2000);
    });

    it('rounds points to nearest integer', () => {
      const sru = 315;
      // Easy: 0.75 * 315 = 236.25 -> 236
      expect(calculateMissionReward('easy', sru)).toBe(236);
      // Hard: 1.25 * 315 = 393.75 -> 394
      expect(calculateMissionReward('hard', sru)).toBe(394);
    });
  });

  describe('calculateStreakReward', () => {
    it('awards 0.25 * SRU for regular streak days', () => {
      const sru = 400;
      const day1 = calculateStreakReward(1, sru);
      expect(day1.points).toBe(100);
      expect(day1.isCycleBonus).toBe(false);

      const day6 = calculateStreakReward(6, sru);
      expect(day6.points).toBe(100);
      expect(day6.isCycleBonus).toBe(false);
    });

    it('awards 1.00 * SRU cycle bonus on day 7', () => {
      const sru = 400;
      const day7 = calculateStreakReward(7, sru);
      expect(day7.points).toBe(400);
      expect(day7.isCycleBonus).toBe(true);

      const day14 = calculateStreakReward(14, sru);
      expect(day14.points).toBe(400);
      expect(day14.isCycleBonus).toBe(true);
    });
  });

  describe('evaluateStreak', () => {
    it('allows claim and starts streak at 1 if never claimed before', () => {
      const result = evaluateStreak(null, '2026-09-14', 0);
      expect(result.canClaim).toBe(true);
      expect(result.nextStreak).toBe(1);
      expect(result.wasReset).toBe(false);
    });

    it('rejects claim if already claimed today', () => {
      const result = evaluateStreak('2026-09-14', '2026-09-14', 3);
      expect(result.canClaim).toBe(false);
      expect(result.nextStreak).toBe(3);
      expect(result.wasReset).toBe(false);
    });

    it('advances streak by 1 on consecutive day', () => {
      const result = evaluateStreak('2026-09-13', '2026-09-14', 3);
      expect(result.canClaim).toBe(true);
      expect(result.nextStreak).toBe(4);
      expect(result.wasReset).toBe(false);
    });

    it('cycles back to day 1 after day 7 on consecutive day', () => {
      const result = evaluateStreak('2026-09-13', '2026-09-14', 7);
      expect(result.canClaim).toBe(true);
      expect(result.nextStreak).toBe(1);
      expect(result.wasReset).toBe(false);
    });

    it('resets streak to 1 if a day is missed', () => {
      const result = evaluateStreak('2026-09-11', '2026-09-14', 5);
      expect(result.canClaim).toBe(true);
      expect(result.nextStreak).toBe(1);
      expect(result.wasReset).toBe(true);
    });
  });

  describe('isMissionCompleted', () => {
    it('verifies progress against target', () => {
      expect(isMissionCompleted(2, 3)).toBe(false);
      expect(isMissionCompleted(3, 3)).toBe(true);
      expect(isMissionCompleted(5, 3)).toBe(true);
    });
  });

  describe('DEFAULT_MISSIONS', () => {
    it('has missions across all 4 difficulties', () => {
      const difficulties = new Set(DEFAULT_MISSIONS.map((m) => m.difficulty));
      expect(difficulties.has('easy')).toBe(true);
      expect(difficulties.has('normal')).toBe(true);
      expect(difficulties.has('hard')).toBe(true);
      expect(difficulties.has('weekly')).toBe(true);
    });
  });

  describe('selectMissionPool', () => {
    const testUserId = '0191eb70-5b58-7c8a-8e2b-2a2106e22c01';
    const testDate = '2026-09-15'; // Tuesday

    it('selects exactly 3 daily missions (1 easy, 1 normal, 1 hard) and 1 weekly mission', () => {
      const selection = selectMissionPool(testUserId, testDate);

      expect(selection.daily).toHaveLength(3);
      expect(selection.weekly).toHaveLength(1);
      expect(selection.all).toHaveLength(4);

      expect(selection.daily[0]!.difficulty).toBe('easy');
      expect(selection.daily[1]!.difficulty).toBe('normal');
      expect(selection.daily[2]!.difficulty).toBe('hard');
      expect(selection.weekly[0]!.difficulty).toBe('weekly');
    });

    it('is strictly deterministic for the same userId and date', () => {
      const selection1 = selectMissionPool(testUserId, testDate);
      const selection2 = selectMissionPool(testUserId, testDate);

      expect(selection1.daily.map((m) => m.key)).toEqual(
        selection2.daily.map((m) => m.key),
      );
      expect(selection1.weekly.map((m) => m.key)).toEqual(
        selection2.weekly.map((m) => m.key),
      );
    });

    it('produces distinct distributions across different users', () => {
      const user1 = '0191eb70-5b58-7c8a-8e2b-2a2106e22c01';
      const user2 = '0191eb70-5b58-7c8a-8e2b-2a2106e22c02';
      const user3 = '0191eb70-5b58-7c8a-8e2b-2a2106e22c03';

      const keys1 = selectMissionPool(user1, testDate)
        .daily.map((m) => m.key)
        .join(',');
      const keys2 = selectMissionPool(user2, testDate)
        .daily.map((m) => m.key)
        .join(',');
      const keys3 = selectMissionPool(user3, testDate)
        .daily.map((m) => m.key)
        .join(',');

      // Across 3 different users, at least two should differ given 3*3*2 = 18 combinations
      const allSame = keys1 === keys2 && keys2 === keys3;
      expect(allSame).toBe(false);
    });

    it('preserves the weekly mission across all days in the same calendar week', () => {
      // 2026-09-14 is Monday, 2026-09-20 is Sunday
      const monday = selectMissionPool(testUserId, '2026-09-14');
      const wednesday = selectMissionPool(testUserId, '2026-09-16');
      const sunday = selectMissionPool(testUserId, '2026-09-20');

      expect(monday.weekly[0]!.key).toBe(wednesday.weekly[0]!.key);
      expect(wednesday.weekly[0]!.key).toBe(sunday.weekly[0]!.key);
    });

    it('handles empty or partial custom pools gracefully without errors', () => {
      const emptySelection = selectMissionPool(testUserId, testDate, []);
      expect(emptySelection.daily).toEqual([]);
      expect(emptySelection.weekly).toEqual([]);
      expect(emptySelection.all).toEqual([]);
    });
  });

  describe('hashString', () => {
    it('produces deterministic 32-bit positive integer hashes', () => {
      const hash1 = hashString('user1:2026-09-15:easy');
      const hash2 = hashString('user1:2026-09-15:easy');
      expect(hash1).toBe(hash2);
      expect(hash1).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(hash1)).toBe(true);
    });

    it('produces different hashes for different inputs', () => {
      const hashA = hashString('inputA');
      const hashB = hashString('inputB');
      expect(hashA).not.toBe(hashB);
    });
  });

  describe('getIsoWeekDateString', () => {
    it('calculates the Monday of the calendar week in UTC', () => {
      // 2026-09-14 is Monday
      expect(getIsoWeekDateString('2026-09-14')).toBe('2026-09-14');
      // 2026-09-15 is Tuesday -> Monday is 2026-09-14
      expect(getIsoWeekDateString('2026-09-15')).toBe('2026-09-14');
      // 2026-09-20 is Sunday -> Monday is 2026-09-14
      expect(getIsoWeekDateString('2026-09-20')).toBe('2026-09-14');
      // Date object input
      expect(getIsoWeekDateString(new Date('2026-09-16T12:00:00Z'))).toBe(
        '2026-09-14',
      );
    });
  });
});
