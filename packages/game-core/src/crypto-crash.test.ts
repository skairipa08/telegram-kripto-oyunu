import { describe, expect, it } from 'vitest';
import {
  generateCrashMultiplier,
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
});
