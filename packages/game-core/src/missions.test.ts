import { describe, expect, it } from 'vitest';
import {
  calculateMissionReward,
  calculateStreakReward,
  DEFAULT_MISSIONS,
  evaluateStreak,
  isMissionCompleted,
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
});
