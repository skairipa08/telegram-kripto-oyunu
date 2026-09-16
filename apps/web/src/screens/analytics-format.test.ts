import { describe, expect, it } from 'vitest';
import { formatRatioPercent } from './analytics-format';

describe('formatRatioPercent', () => {
  it('converts backend ratios into readable percentages', () => {
    expect(formatRatioPercent(0.684)).toBe('68,4%');
    expect(formatRatioPercent(1)).toBe('100%');
    expect(formatRatioPercent(0)).toBe('0%');
  });

  it('does not present invalid analytics as a percentage', () => {
    expect(formatRatioPercent(Number.NaN)).toBe('—');
  });
});
