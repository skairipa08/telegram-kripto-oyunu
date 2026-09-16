import { describe, expect, it } from 'vitest';
import {
  calculateCrashPayout,
  calculateCrashProfit,
  calculateMultiplierAtTime,
  calculateTimeToReachMultiplier,
  formatMultiplier,
  generateCrashPoint,
  generateNextCandle,
  getMultiplierTier,
} from './crypto-crash-model';

describe('Crypto Crash Model', () => {
  it('calculates monotonically increasing multiplier over time', () => {
    expect(calculateMultiplierAtTime(0)).toBe(1.0);
    expect(calculateMultiplierAtTime(3000)).toBeGreaterThan(1.0);
    expect(calculateMultiplierAtTime(6000)).toBeGreaterThan(
      calculateMultiplierAtTime(3000),
    );
    expect(calculateMultiplierAtTime(12000)).toBeGreaterThan(
      calculateMultiplierAtTime(6000),
    );
  });

  it('inverts multiplier to time accurately', () => {
    const mult = 2.5;
    const timeMs = calculateTimeToReachMultiplier(mult);
    expect(timeMs).toBeGreaterThan(0);
    const roundTrip = calculateMultiplierAtTime(timeMs);
    expect(Math.abs(roundTrip - mult)).toBeLessThanOrEqual(0.05);
  });

  it('generates valid crash points within bounded range', () => {
    // Edge cases with forced random values
    const minCrash = generateCrashPoint(0.01);
    expect(minCrash).toBeGreaterThanOrEqual(1.0);

    const midCrash = generateCrashPoint(0.5);
    expect(midCrash).toBeCloseTo(1.92, 1);

    const highCrash = generateCrashPoint(0.999);
    expect(highCrash).toBeLessThanOrEqual(100.0);

    // Multiple random samples
    for (let i = 0; i < 50; i++) {
      const pt = generateCrashPoint();
      expect(pt).toBeGreaterThanOrEqual(1.0);
      expect(pt).toBeLessThanOrEqual(100.0);
    }
  });

  it('generates candlesticks with proper open, close, high, low, and bullish state', () => {
    // Bullish candle
    const bullish = generateNextCandle(1.5, 2.0, 1, 0.1);
    expect(bullish.index).toBe(1);
    expect(bullish.open).toBe(1.5);
    expect(bullish.close).toBe(2.0);
    expect(bullish.isBullish).toBe(true);
    expect(bullish.high).toBeGreaterThanOrEqual(2.0);
    expect(bullish.low).toBeLessThanOrEqual(1.5);

    // Bearish candle
    const bearish = generateNextCandle(2.2, 1.8, 2, 0.1);
    expect(bearish.open).toBe(2.2);
    expect(bearish.close).toBe(1.8);
    expect(bearish.isBullish).toBe(false);
    expect(bearish.high).toBeGreaterThanOrEqual(2.2);
    expect(bearish.low).toBeLessThanOrEqual(1.8);
  });

  it('calculates crash payouts and net profits accurately', () => {
    expect(calculateCrashPayout(100, 2.5)).toBe(250);
    expect(calculateCrashProfit(100, 2.5)).toBe(150);

    expect(calculateCrashPayout(250, 1.25)).toBe(312); // Math.floor(312.5) = 312
    expect(calculateCrashProfit(250, 1.25)).toBe(62);

    expect(calculateCrashPayout(0, 5.0)).toBe(0);
    expect(calculateCrashPayout(100, 0.5)).toBe(0);
  });

  it('categorizes multipliers into bear, bull, and moon tiers', () => {
    expect(getMultiplierTier(1.05)).toBe('bear');
    expect(getMultiplierTier(1.99)).toBe('bear');
    expect(getMultiplierTier(2.0)).toBe('bull');
    expect(getMultiplierTier(5.75)).toBe('bull');
    expect(getMultiplierTier(9.99)).toBe('bull');
    expect(getMultiplierTier(10.0)).toBe('moon');
    expect(getMultiplierTier(45.0)).toBe('moon');
  });

  it('formats multiplier strings neatly', () => {
    expect(formatMultiplier(1.5)).toBe('1.50x');
    expect(formatMultiplier(10.234)).toBe('10.23x');
  });
});
