import { describe, expect, it } from 'vitest';
import {
  extendMemorySequence,
  findMergePair,
  memoryRewardForRound,
  mergeCoinBoard,
} from './arcade-game-model';

describe('arcade game model', () => {
  it('raises memory rewards every round', () => {
    expect(memoryRewardForRound(1)).toBe(6);
    expect(memoryRewardForRound(2)).toBe(10);
    expect(memoryRewardForRound(3)).toBe(14);
  });

  it('extends memory sequences without changing earlier steps', () => {
    expect(extendMemorySequence([0, 2, 1], 2)).toEqual([0, 2, 1, 1]);
  });

  it('finds the first available merge pair', () => {
    expect(findMergePair([1, 2, 3, 2])).toEqual([1, 3]);
    expect(findMergePair([1, 2, 3, 4])).toBeNull();
  });

  it('merges equal coins and rejects invalid pairs', () => {
    expect(mergeCoinBoard([1, 1, 2], 0, 1, 0)).toEqual({
      board: [1, 2, 2],
      reward: 4,
      mergedLevel: 2,
    });
    expect(mergeCoinBoard([1, 2], 0, 1, 0)).toBeNull();
  });
});
