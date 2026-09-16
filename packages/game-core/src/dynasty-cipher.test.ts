import { describe, expect, it } from 'vitest';
import {
  calculateCipherSequenceLength,
  generateCipherSequence,
  calculateComboMultiplier,
  calculateCipherReward,
  CIPHER_SYMBOLS,
} from './dynasty-cipher';

describe('Dynasty Cipher Terminal Engine & Cyber-Hack Math', () => {
  describe('Sequence Length Scaling', () => {
    it('scales sequence length with rounds: L(r) = min(12, 3 + floor((r - 1) / 2))', () => {
      // Round 1-2: 3
      expect(calculateCipherSequenceLength(1)).toBe(3);
      expect(calculateCipherSequenceLength(2)).toBe(3);

      // Round 3-4: 4
      expect(calculateCipherSequenceLength(3)).toBe(4);
      expect(calculateCipherSequenceLength(4)).toBe(4);

      // Round 5-6: 5
      expect(calculateCipherSequenceLength(5)).toBe(5);

      // Round 9-10: 7
      expect(calculateCipherSequenceLength(9)).toBe(7);
      expect(calculateCipherSequenceLength(10)).toBe(7);

      // Round 19+: capped at 12
      expect(calculateCipherSequenceLength(19)).toBe(12);
      expect(calculateCipherSequenceLength(50)).toBe(12);
    });

    it('generates sequences with correct length and valid symbols', () => {
      const seq = generateCipherSequence(5);
      expect(seq).toHaveLength(5);
      for (const symbol of seq) {
        expect(CIPHER_SYMBOLS).toContain(symbol);
      }
    });
  });

  describe('Combo Multipliers & Streak Mechanics', () => {
    it('scales combo multiplier by +0.25x per streak, capped at 3.0x', () => {
      expect(calculateComboMultiplier(1)).toBe(1.0);
      expect(calculateComboMultiplier(2)).toBe(1.25);
      expect(calculateComboMultiplier(3)).toBe(1.5);
      expect(calculateComboMultiplier(4)).toBe(1.75);
      expect(calculateComboMultiplier(5)).toBe(2.0);
      expect(calculateComboMultiplier(6)).toBe(2.25);
      expect(calculateComboMultiplier(7)).toBe(2.5);
      expect(calculateComboMultiplier(8)).toBe(2.75);
      expect(calculateComboMultiplier(9)).toBe(3.0);
      // Beyond 9 stays capped at 3.0x
      expect(calculateComboMultiplier(10)).toBe(3.0);
      expect(calculateComboMultiplier(100)).toBe(3.0);
    });
  });

  describe('Cipher Reward Calculations & Daily Caps', () => {
    it('computes reward correctly based on round and combo multiplier', () => {
      // Round 1, Combo 1: (25 + 15 * 0) * 1.0 = 25
      const r1 = calculateCipherReward(1, 1);
      expect(r1.rewardCash).toBe(25);
      expect(r1.comboMultiplier).toBe(1.0);
      expect(r1.sequenceLength).toBe(3);
      expect(r1.isCapped).toBe(false);

      // Round 3, Combo 2: (25 + 15 * 2) * 1.25 = 55 * 1.25 = 68.75 -> 68
      const r3 = calculateCipherReward(3, 2);
      expect(r3.rewardCash).toBe(68);
      expect(r3.comboMultiplier).toBe(1.25);
    });

    it('strictly enforces daily earning cap (50,000 Cash)', () => {
      // If player already earned 49,950 today and earns 100, clamped to 50
      const capped = calculateCipherReward(10, 5, 49_950);
      expect(capped.rewardCash).toBe(50);
      expect(capped.isCapped).toBe(true);

      // If daily cap reached, reward is 0
      const exhausted = calculateCipherReward(1, 1, 50_000);
      expect(exhausted.rewardCash).toBe(0);
      expect(exhausted.isCapped).toBe(true);
    });
  });
});
