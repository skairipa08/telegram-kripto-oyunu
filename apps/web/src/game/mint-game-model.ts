export type MintHitGrade = 'perfect' | 'good' | 'miss';

export type MintHitResult = {
  grade: MintHitGrade;
  distance: number;
  points: number;
};

const FULL_CIRCLE = 360;

export function circularDistance(angle: number, target: number): number {
  const normalized = Math.abs(
    ((angle % FULL_CIRCLE) - (target % FULL_CIRCLE) + FULL_CIRCLE) %
      FULL_CIRCLE,
  );
  return Math.min(normalized, FULL_CIRCLE - normalized);
}

export function scoreMintHit(
  angle: number,
  targetCenter: number,
  targetWidth: number,
  combo: number,
): MintHitResult {
  const distance = circularDistance(angle, targetCenter);
  const halfWidth = targetWidth / 2;
  const comboReward = rewardForCombo(combo + 1);

  if (distance <= halfWidth * 0.32) {
    return {
      grade: 'perfect',
      distance,
      points: Math.ceil(comboReward * 1.5),
    };
  }
  if (distance <= halfWidth) {
    return { grade: 'good', distance, points: comboReward };
  }
  return { grade: 'miss', distance, points: 0 };
}

export function rewardForCombo(combo: number): number {
  if (!Number.isFinite(combo) || combo <= 0) return 0;
  return Math.min(250, Math.round(5 * 1.4 ** (Math.floor(combo) - 1)));
}

export function targetWidthForCombo(combo: number): number {
  return Math.max(26, 62 - Math.min(combo, 12) * 3);
}

export function cashRewardForScore(score: number): number {
  if (!Number.isFinite(score) || score <= 0) return 0;
  return Math.floor(score);
}

export function nextTargetCenter(current: number, hitCount: number): number {
  return (current + 97 + hitCount * 29) % FULL_CIRCLE;
}
