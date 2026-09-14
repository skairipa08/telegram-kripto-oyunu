import { describe, expect, it } from 'vitest';
import {
  calculateConveniencePassEntitlements,
  calculatePassExpiry,
  DEFAULT_SKUS,
  isPassActive,
  P2WViolationError,
  validateP2WSafety,
} from './monetization';

describe('Monetization & Convenience Pass Engine', () => {
  const baseDate = new Date('2026-09-14T12:00:00.000Z');

  it('provides convenience pass entitlements with strict anti-P2W guardrails', () => {
    const free = calculateConveniencePassEntitlements(false);
    expect(free.isActive).toBe(false);
    expect(free.offlineCapSeconds).toBe(14400); // 4 hours
    expect(free.upgradeQueueSlots).toBe(1);
    expect(free.missionRerolls).toBe(1);
    expect(free.autoClaimEnabled).toBe(false);
    expect(free.seasonPointsMultiplier).toBe(1.0);

    const pass = calculateConveniencePassEntitlements(true);
    expect(pass.isActive).toBe(true);
    expect(pass.offlineCapSeconds).toBe(43200); // 12 hours
    expect(pass.upgradeQueueSlots).toBe(3);
    expect(pass.missionRerolls).toBe(3);
    expect(pass.autoClaimEnabled).toBe(true);
    // Anti-P2W: strictly equal to 1.0 even with paid pass!
    expect(pass.seasonPointsMultiplier).toBe(1.0);
  });

  it('accurately evaluates pass active state', () => {
    expect(isPassActive(null, baseDate)).toBe(false);
    expect(isPassActive(undefined, baseDate)).toBe(false);

    // Past expiry
    const past = new Date(baseDate.getTime() - 1000);
    expect(isPassActive(past, baseDate)).toBe(false);

    // Future expiry
    const future = new Date(baseDate.getTime() + 1000);
    expect(isPassActive(future, baseDate)).toBe(true);
  });

  it('stacks pass expiration additively for active pass holders', () => {
    // Current pass has 10 days remaining
    const currentExpiry = new Date(baseDate.getTime() + 10 * 86_400_000);

    // Purchasing 30-day pass extends it by 30 days on top of currentExpiry (40 days total)
    const newExpiry = calculatePassExpiry(currentExpiry, 30, baseDate);
    const expected = new Date(baseDate.getTime() + 40 * 86_400_000);

    expect(newExpiry.getTime()).toBe(expected.getTime());
  });

  it('resets pass expiration to now + duration when pass is expired or new', () => {
    // Expired 5 days ago
    const expiredPass = new Date(baseDate.getTime() - 5 * 86_400_000);
    const newExpiry = calculatePassExpiry(expiredPass, 30, baseDate);
    const expected = new Date(baseDate.getTime() + 30 * 86_400_000);

    expect(newExpiry.getTime()).toBe(expected.getTime());

    // Never had a pass (null)
    const brandNewExpiry = calculatePassExpiry(null, 30, baseDate);
    expect(brandNewExpiry.getTime()).toBe(expected.getTime());
  });

  it('rejects invalid non-positive durationDays', () => {
    expect(() => calculatePassExpiry(null, 0, baseDate)).toThrow(RangeError);
    expect(() => calculatePassExpiry(null, -5, baseDate)).toThrow(RangeError);
  });

  it('validates anti-P2W safety for catalog SKUs', () => {
    for (const skuObj of DEFAULT_SKUS) {
      expect(validateP2WSafety(skuObj.sku)).toEqual({ safe: true });
    }

    // P2W attempts must be rejected with P2WViolationError
    expect(() => validateP2WSafety('buy_10000_season_points')).toThrow(
      P2WViolationError,
    );
    expect(() => validateP2WSafety('boost_rank_top_10')).toThrow(
      P2WViolationError,
    );
    expect(() => validateP2WSafety('infinite_cash_pack')).toThrow(
      P2WViolationError,
    );
  });
});
