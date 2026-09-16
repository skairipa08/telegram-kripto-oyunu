import { describe, expect, it } from 'vitest';
import {
  cashRewardForScore,
  circularDistance,
  nextTargetCenter,
  rewardForCombo,
  scoreMintHit,
  targetWidthForCombo,
} from './mint-game-model';

describe('mint game model', () => {
  it('measures angles across the zero boundary', () => {
    expect(circularDistance(355, 5)).toBe(10);
  });

  it('scores center hits higher than regular hits', () => {
    expect(scoreMintHit(100, 100, 60, 3)).toEqual({
      grade: 'perfect',
      distance: 0,
      points: 21,
    });
    expect(scoreMintHit(120, 100, 60, 3).grade).toBe('good');
    expect(scoreMintHit(150, 100, 60, 3).grade).toBe('miss');
    expect(scoreMintHit(100, 100, 60, 99).points).toBe(375);
  });

  it('increases each hit reward with the active combo', () => {
    expect(rewardForCombo(1)).toBe(5);
    expect(rewardForCombo(2)).toBe(7);
    expect(rewardForCombo(3)).toBe(10);
    expect(rewardForCombo(4)).toBe(14);
    expect(rewardForCombo(0)).toBe(0);
  });

  it('narrows the target without making it impractical', () => {
    expect(targetWidthForCombo(0)).toBe(62);
    expect(targetWidthForCombo(4)).toBe(50);
    expect(targetWidthForCombo(99)).toBe(26);
  });

  it('keeps accumulating the whole round score', () => {
    expect(cashRewardForScore(100)).toBe(100);
    expect(cashRewardForScore(1000)).toBe(1000);
    expect(cashRewardForScore(Number.NaN)).toBe(0);
  });

  it('moves the target deterministically', () => {
    expect(nextTargetCenter(320, 2)).toBe(115);
  });
});
