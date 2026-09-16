// apps/web/src/game/crypto-crash-model.ts
// Pure client model for the Crypto Candlestick "Moon or Doom" Crash game

export interface Candlestick {
  index: number;
  open: number;
  high: number;
  low: number;
  close: number;
  isBullish: boolean;
}

export type CrashTier = 'bear' | 'bull' | 'moon';

export const MIN_STAKE = 10;
export const MAX_STAKE = 100000;
export const DEFAULT_STAKES = [50, 100, 250, 500, 1000];

/**
 * Calculates multiplier based on elapsed time in milliseconds.
 * Starts at 1.00x and accelerates smoothly.
 */
export function calculateMultiplierAtTime(elapsedMs: number): number {
  if (elapsedMs <= 0) return 1.0;
  // Non-linear curve: 1.00 + (t / 5000)^1.5
  const raw = 1.0 + Math.pow(elapsedMs / 5200, 1.55);
  return Number(raw.toFixed(2));
}

/**
 * Calculates inverse: time in ms required to reach a specific multiplier.
 */
export function calculateTimeToReachMultiplier(multiplier: number): number {
  if (multiplier <= 1.0) return 0;
  const rawTime = Math.pow(multiplier - 1.0, 1 / 1.55) * 5200;
  return Math.round(rawTime);
}

/**
 * Generates a crash point using standard inverse cumulative distribution.
 * House edge of 4%, bounded between 1.00x and 100.00x.
 */
export function generateCrashPoint(randomFloat?: number): number {
  const rand = randomFloat !== undefined ? randomFloat : Math.random();
  // 3% chance of instant crash at 1.00x - 1.05x
  if (rand < 0.03) {
    return 1.0 + Number((rand * 1.66).toFixed(2));
  }
  // Formula: E = (100 - houseEdge) / (100 * (1 - rand))
  const houseEdge = 0.04;
  const rawCrash = (1 - houseEdge) / (1 - rand);
  const clamped = Math.min(100.0, Math.max(1.01, rawCrash));
  return Number(clamped.toFixed(2));
}

/**
 * Generates the next candlestick in sequence tracking the rising multiplier with realistic wicks.
 */
export function generateNextCandle(
  previousClose: number,
  targetMultiplier: number,
  candleIndex: number,
  randomWick = 0.05,
): Candlestick {
  const open = previousClose;
  const close = targetMultiplier;
  const isBullish = close >= open;

  // Add realistic micro high/low volatility wicks
  const spread = Math.abs(close - open);
  const wickRange = Math.max(0.02, spread * randomWick);

  const high = Number((Math.max(open, close) + wickRange * 0.8).toFixed(2));
  const low = Number(
    Math.max(0.9, Math.min(open, close) - wickRange * 0.6).toFixed(2),
  );

  return {
    index: candleIndex,
    open: Number(open.toFixed(2)),
    high,
    low,
    close: Number(close.toFixed(2)),
    isBullish,
  };
}

export function calculateCrashPayout(
  stake: number,
  cashOutMultiplier: number,
): number {
  if (stake <= 0 || cashOutMultiplier < 1.0) return 0;
  return Math.floor(stake * cashOutMultiplier);
}

export function calculateCrashProfit(
  stake: number,
  cashOutMultiplier: number,
): number {
  const payout = calculateCrashPayout(stake, cashOutMultiplier);
  return Math.max(0, payout - stake);
}

export function getMultiplierTier(multiplier: number): CrashTier {
  if (multiplier < 2.0) return 'bear';
  if (multiplier < 10.0) return 'bull';
  return 'moon';
}

export function formatMultiplier(multiplier: number): string {
  return `${multiplier.toFixed(2)}x`;
}
