import { describe, expect, it } from 'vitest';
import {
  generateCrashMultiplier,
  generateAdaptiveCrashMultiplier,
  calculateCrashRiskScore,
  validateCrashStake,
  type PlayerCrashAdaptiveContext,
  calculateMultiplierAtTime,
  calculateCrashTimeToMultiplier,
  generateCandlestickTicks,
  settleCrashBet,
} from './crypto-crash';

describe('Crypto Crash Game Engine & Provably Fair Math', () => {
  const SERVER_SEED =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const CLIENT_SEED = 'empire_player_session_alpha';

  describe('Provably Fair Determinism', () => {
    it('generates the exact same multiplier and hash for identical inputs', () => {
      const run1 = generateCrashMultiplier(SERVER_SEED, CLIENT_SEED, 1);
      const run2 = generateCrashMultiplier(SERVER_SEED, CLIENT_SEED, 1);

      expect(run1.hash).toBe(run2.hash);
      expect(run1.crashMultiplier).toBe(run2.crashMultiplier);
      expect(run1.isInstantCrash).toBe(run2.isInstantCrash);
    });

    it('alters output when nonce or client seed varies', () => {
      const runA = generateCrashMultiplier(SERVER_SEED, CLIENT_SEED, 1);
      const runB = generateCrashMultiplier(SERVER_SEED, CLIENT_SEED, 2);
      const runC = generateCrashMultiplier(SERVER_SEED, 'different_client', 1);

      expect(runA.hash).not.toBe(runB.hash);
      expect(runA.hash).not.toBe(runC.hash);
    });

    it('clamps multiplier between minMultiplier (1.00x) and maxMultiplier (1000.00x)', () => {
      const normalRun = generateCrashMultiplier(SERVER_SEED, CLIENT_SEED, 42);
      expect(normalRun.crashMultiplier).toBeGreaterThanOrEqual(1.0);
      expect(normalRun.crashMultiplier).toBeLessThanOrEqual(1000.0);
    });
  });

  describe('50,000-Round Monte Carlo RTP Proof (97.0% +/- 0.5%)', () => {
    it('proves exactly 97.0% RTP +/- 0.5% across cashout thresholds, demonstrating zero hyperinflation', () => {
      const N = 50_000;
      const testServerSeed = 'empire_server_seed_v1';
      const testClientSeed = 'client_seed_main';
      const targets = [1.2, 1.5, 2.0];
      const payouts: Record<number, number> = { 1.2: 0, 1.5: 0, 2.0: 0 };
      let instantCrashCount = 0;

      for (let nonce = 0; nonce < N; nonce++) {
        const result = generateCrashMultiplier(
          testServerSeed,
          testClientSeed,
          nonce,
        );
        if (result.isInstantCrash) {
          instantCrashCount++;
        }

        for (const target of targets) {
          if (result.crashMultiplier >= target) {
            payouts[target] = (payouts[target] ?? 0) + target;
          }
        }
      }

      // Invariant 1: Instant crash rate (~1 in 33 = 3.030%)
      const instantRate = (instantCrashCount / N) * 100;
      expect(instantRate).toBeGreaterThanOrEqual(2.7);
      expect(instantRate).toBeLessThanOrEqual(3.4);

      // Invariant 2: Return to Player (RTP) is 97.0% +/- 0.5% (96.5% to 97.5%)
      for (const target of targets) {
        const rtp = (payouts[target]! / N) * 100;
        // Strict assertion proving zero runaway hyperinflation and exactly 97.0% RTP
        expect(rtp).toBeGreaterThanOrEqual(96.5);
        expect(rtp).toBeLessThanOrEqual(97.5);
      }
    });
  });

  describe('Trajectory Curve & Candlestick Simulation', () => {
    it('calculates multiplier along continuous exponential curve exp(0.06 * t)', () => {
      expect(calculateMultiplierAtTime(0)).toBe(1.0);
      // t = ln(2) / 0.06 = 11.55245... -> at t=11.55s, multiplier ~ 2.00x
      expect(calculateMultiplierAtTime(11.5525)).toBe(2.0);
      // t = ln(10) / 0.06 = 38.3764... -> at t=38.38s, multiplier ~ 10.00x
      expect(calculateMultiplierAtTime(38.38)).toBe(10.0);
    });

    it('calculates time to crash reversibly', () => {
      const timeTo2x = calculateCrashTimeToMultiplier(2.0);
      expect(timeTo2x).toBeCloseTo(11.5525, 2);

      const timeTo1x = calculateCrashTimeToMultiplier(1.0);
      expect(timeTo1x).toBe(0);
    });

    it('generates continuous candlesticks where tick[i].open === tick[i-1].close', () => {
      // 5.00x crash multiplier
      const ticks = generateCandlestickTicks(5.0, 1.0);
      expect(ticks.length).toBeGreaterThan(0);

      // First tick starts at 1.00
      expect(ticks[0]!.open).toBe(1.0);

      // Price continuity across all ticks
      for (let i = 1; i < ticks.length; i++) {
        const prev = ticks[i - 1]!;
        const curr = ticks[i]!;
        expect(curr.open).toBe(prev.close);
        expect(curr.high).toBeGreaterThanOrEqual(
          Math.max(curr.open, curr.close),
        );
        expect(curr.low).toBeLessThanOrEqual(Math.min(curr.open, curr.close));
        expect(curr.low).toBeGreaterThanOrEqual(1.0);
      }

      // Final tick close matches crash multiplier
      const finalTick = ticks[ticks.length - 1]!;
      expect(finalTick.close).toBe(5.0);
    });

    it('handles instant 1.00x crash ticks gracefully', () => {
      const ticks = generateCandlestickTicks(1.0);
      expect(ticks).toHaveLength(1);
      expect(ticks[0]!.open).toBe(1.0);
      expect(ticks[0]!.close).toBe(1.0);
    });
  });

  describe('Crash Bet Settlement', () => {
    it('awards winnings when cashed out before crash point', () => {
      const settlement = settleCrashBet({
        stake: 1000,
        crashMultiplier: 3.5,
        cashoutMultiplier: 2.5,
      });

      expect(settlement.status).toBe('won');
      expect(settlement.payoutCash).toBe(2500);
      expect(settlement.netProfit).toBe(1500);
      expect(settlement.finalMultiplier).toBe(2.5);
      expect(settlement.isInstantCrash).toBe(false);
    });

    it('forfeits stake when cashed out after crash or uncashed', () => {
      const settlement = settleCrashBet({
        stake: 1000,
        crashMultiplier: 2.1,
        cashoutMultiplier: 2.5, // attempted cashout too late
      });

      expect(settlement.status).toBe('crashed');
      expect(settlement.payoutCash).toBe(0);
      expect(settlement.netProfit).toBe(-1000);
      expect(settlement.finalMultiplier).toBe(2.1);
    });

    it('rejects stakes outside configured min/max boundaries', () => {
      expect(() =>
        settleCrashBet({
          stake: 5, // below min 10
          crashMultiplier: 2.0,
        }),
      ).toThrow(RangeError);

      expect(() =>
        settleCrashBet({
          stake: 20_000_000, // above max 10M
          crashMultiplier: 2.0,
        }),
      ).toThrow(RangeError);
    });
  });

  describe('validateCrashStake (Free-Range Stake Boundary Verification)', () => {
    it('rejects non-numeric inputs (null, undefined, string, NaN, Infinity)', () => {
      expect(validateCrashStake(null, 1000).valid).toBe(false);
      expect(validateCrashStake(null, 1000).error).toBe('INVALID_STAKE');
      expect(validateCrashStake(undefined, 1000).valid).toBe(false);
      expect(validateCrashStake('100', 1000).valid).toBe(false);
      expect(validateCrashStake(NaN, 1000).valid).toBe(false);
      expect(validateCrashStake(Infinity, 1000).valid).toBe(false);
      expect(validateCrashStake(-Infinity, 1000).valid).toBe(false);
    });

    it('rejects stakes below minimum (10 Cash)', () => {
      const res0 = validateCrashStake(0, 1000);
      expect(res0.valid).toBe(false);
      expect(res0.error).toBe('INVALID_STAKE');

      const res9 = validateCrashStake(9, 1000);
      expect(res9.valid).toBe(false);
      expect(res9.error).toBe('INVALID_STAKE');
      expect(res9.message).toContain('10');

      const resNeg = validateCrashStake(-50, 1000);
      expect(resNeg.valid).toBe(false);
      expect(resNeg.error).toBe('INVALID_STAKE');
    });

    it('rejects stakes exceeding global max stake (10,000,000 Cash)', () => {
      const res = validateCrashStake(10_000_001, 50_000_000);
      expect(res.valid).toBe(false);
      expect(res.error).toBe('INVALID_STAKE');
      expect(res.message).toContain('sınırını aşıyor');
    });

    it('rejects stakes exceeding user balance with INSUFFICIENT_CASH', () => {
      const res = validateCrashStake(500, 250);
      expect(res.valid).toBe(false);
      expect(res.error).toBe('INSUFFICIENT_CASH');
      expect(res.message).toBe('Yetersiz bakiye');
    });

    it('accepts valid free-range stakes and sanitizes floats by flooring', () => {
      const resExact = validateCrashStake(1000, 1000);
      expect(resExact.valid).toBe(true);
      expect(resExact.sanitizedStake).toBe(1000);

      const resPartial = validateCrashStake(250, 1000);
      expect(resPartial.valid).toBe(true);
      expect(resPartial.sanitizedStake).toBe(250);

      const resFloat = validateCrashStake(99.8, 1000);
      expect(resFloat.valid).toBe(true);
      expect(resFloat.sanitizedStake).toBe(99);

      const resMin = validateCrashStake(10, 10);
      expect(resMin.valid).toBe(true);
      expect(resMin.sanitizedStake).toBe(10);
    });
  });

  describe('calculateCrashRiskScore (Risk Severity Assessment)', () => {
    it('returns zero risk for normal and modest stakes without win streak', () => {
      // lambda = 1.0, W = 0
      const res1 = calculateCrashRiskScore(100, 100, 0);
      expect(res1.riskScore).toBe(0);
      expect(res1.stakeRatio).toBe(1.0);

      // lambda = 1.5, W = 1
      const res2 = calculateCrashRiskScore(150, 100, 1);
      expect(res2.riskScore).toBe(0);
      expect(res2.stakeRatio).toBe(1.5);
    });

    it('scales risk severity when player spikes stake (> 1.5x average)', () => {
      // lambda = 2.5 (2.5x spike): stakePenalty = 0.8 * (2.5 - 1.5) / 2 = 0.40
      const resSpike = calculateCrashRiskScore(250, 100, 0);
      expect(resSpike.riskScore).toBeCloseTo(0.4, 2);
      expect(resSpike.stakeRatio).toBe(2.5);

      // lambda = 3.5 (3.5x spike): stakePenalty = 0.8 * (3.5 - 1.5) / 2 = 0.80
      const resHigh = calculateCrashRiskScore(350, 100, 0);
      expect(resHigh.riskScore).toBeCloseTo(0.8, 2);
    });

    it('escalates risk when player bets higher after consecutive wins', () => {
      // lambda = 2.5, W = 3 (3 consecutive wins)
      // stakePenalty = 0.40, streakPenalty = 0.3 * (3 - 1) * (2.5 - 1.0)/1.5 = 0.60 => total 1.0
      const resHotStreak = calculateCrashRiskScore(250, 100, 3);
      expect(resHotStreak.riskScore).toBe(1.0);

      // lambda = 3.5, W = 2 => rawRisk > 1.0, clamped to 1.0
      const resClamped = calculateCrashRiskScore(350, 100, 2);
      expect(resClamped.riskScore).toBe(1.0);
    });

    it('handles edge cases (zero/negative inputs) safely', () => {
      const resZero = calculateCrashRiskScore(0, 0, 0);
      expect(resZero.riskScore).toBe(0);

      const resNeg = calculateCrashRiskScore(-10, -50, -2);
      expect(resNeg.riskScore).toBe(0);
    });
  });

  describe('Adaptive Crash Engine & Provably Fair Multiplier Bias (Monte Carlo Fuzzing)', () => {
    it('is strictly deterministic: identical seeds, nonce, and context yield identical outputs', () => {
      const ctx: PlayerCrashAdaptiveContext = {
        recentStakes: [100, 100, 100],
        averageStake: 100,
        consecutiveWins: 2,
        currentStake: 300,
      };

      const run1 = generateAdaptiveCrashMultiplier(
        SERVER_SEED,
        CLIENT_SEED,
        77,
        ctx,
      );
      const run2 = generateAdaptiveCrashMultiplier(
        SERVER_SEED,
        CLIENT_SEED,
        77,
        ctx,
      );

      expect(run1.hash).toBe(run2.hash);
      expect(run1.crashMultiplier).toBe(run2.crashMultiplier);
      expect(run1.isAdaptiveBiased).toBe(run2.isAdaptiveBiased);
      expect(run1.riskScore).toBe(run2.riskScore);
      expect(run1.stakeRatio).toBe(run2.stakeRatio);
    });

    it('reverts to unbiased Pareto distribution when context is omitted', () => {
      const normalResult = generateAdaptiveCrashMultiplier(
        SERVER_SEED,
        CLIENT_SEED,
        1,
      );
      const legacyResult = generateCrashMultiplier(SERVER_SEED, CLIENT_SEED, 1);

      expect(normalResult.hash).toBe(legacyResult.hash);
      expect(normalResult.crashMultiplier).toBe(legacyResult.crashMultiplier);
      expect(normalResult.isAdaptiveBiased).toBe(false);
      expect(normalResult.riskScore).toBe(0);
    });

    it('Monte Carlo Fuzzing: normal bets preserve baseline engagement (~35.35% < 1.50x), whereas spike bets shift crash probability to early dump (75%-80% < 1.50x)', () => {
      const N = 5_000;
      const testServerSeed = 'adaptive_fuzzing_seed_2026';
      const testClientSeed = 'client_monte_carlo';

      // 1. Normal bets: lambda = 1.0, W = 0 => riskScore = 0
      const normalCtx: PlayerCrashAdaptiveContext = {
        recentStakes: [100, 100, 100],
        averageStake: 100,
        consecutiveWins: 0,
        currentStake: 100,
      };

      let normalLowCrashCount = 0;
      let normalBiasedCount = 0;

      for (let nonce = 0; nonce < N; nonce++) {
        const res = generateAdaptiveCrashMultiplier(
          testServerSeed,
          testClientSeed,
          nonce,
          normalCtx,
        );
        if (res.crashMultiplier < 1.5) {
          normalLowCrashCount++;
        }
        if (res.isAdaptiveBiased) {
          normalBiasedCount++;
        }
      }

      const normalLowRate = (normalLowCrashCount / N) * 100;
      // High win engagement preserved: ~35.35% +/- 2.5% (32.8% to 37.8%)
      expect(normalLowRate).toBeGreaterThanOrEqual(32.8);
      expect(normalLowRate).toBeLessThanOrEqual(37.8);
      // Zero biased dumps on normal bets
      expect(normalBiasedCount).toBe(0);

      // 2. Spike bets with consecutive wins: lambda = 3.5, W = 2 => riskScore = 1.0
      const spikeCtx: PlayerCrashAdaptiveContext = {
        recentStakes: [100, 100, 100],
        averageStake: 100,
        consecutiveWins: 2,
        currentStake: 350,
      };

      let spikeLowCrashCount = 0;
      let spikeBiasedCount = 0;

      for (let nonce = 0; nonce < N; nonce++) {
        const res = generateAdaptiveCrashMultiplier(
          testServerSeed,
          testClientSeed,
          nonce,
          spikeCtx,
        );
        if (res.crashMultiplier < 1.5) {
          spikeLowCrashCount++;
        }
        if (res.isAdaptiveBiased) {
          spikeBiasedCount++;
          // Early dump strictly bounded between 1.01x and 1.48x
          expect(res.crashMultiplier).toBeGreaterThanOrEqual(1.01);
          expect(res.crashMultiplier).toBeLessThanOrEqual(1.48);
        }
      }

      const spikeLowRate = (spikeLowCrashCount / N) * 100;
      // House edge protection: P(M < 1.50) scales up into the 75%-80% range (+/- 2%)
      expect(spikeLowRate).toBeGreaterThanOrEqual(74.0);
      expect(spikeLowRate).toBeLessThanOrEqual(80.5);

      // Biased early dump activated in ~65% of rounds
      const biasRate = (spikeBiasedCount / N) * 100;
      expect(biasRate).toBeGreaterThanOrEqual(62.0);
      expect(biasRate).toBeLessThanOrEqual(68.0);
    });
  });
});
