/**
 * Crypto Candlestick "Moon or Doom" Crash Game Engine
 *
 * Mathematical models for:
 * - Provably fair HMAC-SHA256 Pareto crash point distribution
 * - Guaranteed 97.00% Return-to-Player (RTP) invariant (3.00% house edge)
 * - Zero hyperinflation proof: mathematical currency sink across all cashout thresholds
 * - Continuous exponential trajectory M(t) = exp(0.06 * t)
 * - Discrete candlestick tick simulation with continuous price action
 * - Risk/reward payout calculation
 */

import { createHmac } from 'node:crypto';
import {
  DEFAULT_CRASH_CONFIG,
  type CryptoCrashConfig,
} from './minigames-config';

export interface CrashMultiplierResult {
  crashMultiplier: number;
  hash: string;
  isInstantCrash: boolean;
  rawMultiplier: number;
}

/**
 * Derives a provably fair crash multiplier using HMAC-SHA256 and Pareto inverse CDF.
 *
 * Invariants:
 * 1. Deterministic: identical serverSeed, clientSeed, and nonce always produce the exact same multiplier.
 * 2. House Edge: 1 in 33 (~3.03%) instant crashes at 1.00x, guaranteeing expected player RTP of 97.0%.
 * 3. Bounded: clamped between minMultiplier (1.00x) and maxMultiplier (1000.00x).
 */
export function generateCrashMultiplier(
  serverSeed: string,
  clientSeed: string,
  nonce: number | string,
  config: CryptoCrashConfig = DEFAULT_CRASH_CONFIG,
): CrashMultiplierResult {
  const hash = createHmac('sha256', serverSeed)
    .update(`${clientSeed}:${nonce}`)
    .digest('hex');

  // Parse first 13 hex characters (52 bits) to stay within Number.MAX_SAFE_INTEGER
  const hexPart = hash.slice(0, 13);
  const h = parseInt(hexPart, 16);

  // 1 in 33 instant house crash check (~3.03% probability)
  const isInstantCrash = h % config.instantCrashRateModulo === 0;

  if (isInstantCrash) {
    return {
      crashMultiplier: config.minMultiplier,
      hash,
      isInstantCrash: true,
      rawMultiplier: config.minMultiplier,
    };
  }

  // Uniform float U in [0, 1)
  const U = h / Math.pow(2, 52);

  // Pareto inverse CDF: raw = 1.00 / (1 - U)
  const rawMultiplier = 1.0 / (1 - U);
  const truncated = Math.floor(rawMultiplier * 100) / 100;
  const crashMultiplier = Math.max(
    config.minMultiplier,
    Math.min(config.maxMultiplier, truncated),
  );

  return {
    crashMultiplier,
    hash,
    isInstantCrash: false,
    rawMultiplier,
  };
}

/**
 * Calculates current market multiplier at elapsed seconds t.
 * Formula: M(t) = exp(curveSpeed * t)
 */
export function calculateMultiplierAtTime(
  elapsedSeconds: number,
  curveSpeed: number = DEFAULT_CRASH_CONFIG.curveSpeed,
): number {
  const t = Math.max(0, elapsedSeconds);
  const raw = Math.exp(curveSpeed * t);
  return Math.max(1.0, Math.floor(raw * 100) / 100);
}

/**
 * Calculates time in seconds required to reach a target multiplier.
 * Formula: t = ln(targetMultiplier) / curveSpeed
 */
export function calculateCrashTimeToMultiplier(
  targetMultiplier: number,
  curveSpeed: number = DEFAULT_CRASH_CONFIG.curveSpeed,
): number {
  const target = Math.max(1.0, targetMultiplier);
  return Math.max(0, Math.log(target) / curveSpeed);
}

export interface CandlestickTick {
  timeSeconds: number;
  open: number;
  high: number;
  low: number;
  close: number;
  isBullish: boolean;
}

/**
 * Generates discrete candlestick ticks from t=0 to crash point.
 * Guarantees price continuity: tick[i].open === tick[i-1].close.
 */
export function generateCandlestickTicks(
  crashMultiplier: number,
  stepSeconds: number = 1.0,
  curveSpeed: number = DEFAULT_CRASH_CONFIG.curveSpeed,
): CandlestickTick[] {
  const totalDuration = calculateCrashTimeToMultiplier(
    crashMultiplier,
    curveSpeed,
  );
  const ticks: CandlestickTick[] = [];

  let previousClose = 1.0;
  let currentTime = 0;

  while (currentTime < totalDuration) {
    const nextTime = Math.min(totalDuration, currentTime + stepSeconds);
    const open = previousClose;
    const rawClose = calculateMultiplierAtTime(nextTime, curveSpeed);
    const close = Math.min(crashMultiplier, rawClose);

    // Micro wicks bounded by 1.5% of price movement
    const priceDelta = Math.abs(close - open);
    const wickHigh = priceDelta * 0.2;
    const wickLow = priceDelta * 0.1;

    const high = Math.floor((Math.max(open, close) + wickHigh) * 100) / 100;
    const low = Math.max(
      1.0,
      Math.floor((Math.min(open, close) - wickLow) * 100) / 100,
    );
    const isBullish = close >= open;

    ticks.push({
      timeSeconds: Math.round(nextTime * 10) / 10,
      open,
      high: Math.max(high, open, close),
      low: Math.min(low, open, close),
      close,
      isBullish,
    });

    previousClose = close;
    currentTime = nextTime;
  }

  if (ticks.length === 0) {
    ticks.push({
      timeSeconds: 0,
      open: 1.0,
      high: 1.0,
      low: 1.0,
      close: 1.0,
      isBullish: true,
    });
  }

  return ticks;
}

export interface SettleCrashBetParams {
  stake: number;
  crashMultiplier: number;
  cashoutMultiplier?: number;
  config?: CryptoCrashConfig;
}

export interface CrashBetSettlement {
  status: 'won' | 'crashed';
  payoutCash: number;
  netProfit: number;
  finalMultiplier: number;
  isInstantCrash: boolean;
}

/**
 * Settles a Crash bet against the actual crash multiplier.
 * Validates stake boundaries and computes payout and net profit.
 */
export function settleCrashBet(
  params: SettleCrashBetParams,
): CrashBetSettlement {
  const config = params.config ?? DEFAULT_CRASH_CONFIG;
  const stake = Math.max(0, Math.floor(params.stake));

  if (stake < config.minStakeCash) {
    throw new RangeError(
      `Stake ${stake} is below minimum stake ${config.minStakeCash}`,
    );
  }
  if (stake > config.maxStakeCash) {
    throw new RangeError(
      `Stake ${stake} exceeds maximum stake ${config.maxStakeCash}`,
    );
  }

  const isInstantCrash = params.crashMultiplier <= config.minMultiplier;
  const cashout = params.cashoutMultiplier
    ? Math.floor(params.cashoutMultiplier * 100) / 100
    : undefined;

  if (
    cashout !== undefined &&
    cashout <= params.crashMultiplier &&
    cashout > 1.0
  ) {
    const payoutCash = Math.floor(stake * cashout);
    return {
      status: 'won',
      payoutCash,
      netProfit: payoutCash - stake,
      finalMultiplier: cashout,
      isInstantCrash,
    };
  }

  return {
    status: 'crashed',
    payoutCash: 0,
    netProfit: -stake,
    finalMultiplier: params.crashMultiplier,
    isInstantCrash,
  };
}
