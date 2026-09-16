import { describe, expect, it } from 'vitest';
import {
  validateCrashStake,
  calculateCrashRiskScore,
  generateAdaptiveCrashMultiplier,
  settleCrashBet,
  type PlayerCrashAdaptiveContext,
} from './crypto-crash';
import { calculateExtendedStreakReward, evaluateStreak } from './missions';

describe('EMPIRICAL CHALLENGE SUITE (o10): Adversarial Stress Tests, Fuzzers & Oracles', () => {
  // =========================================================================
  // CHALLENGE 1: Free-Range Stake Validation Fuzzer & Boundary Oracle
  // =========================================================================
  describe('Challenge 1: Free-Range Stake Validation (validateCrashStake)', () => {
    it('fuzzes negative numbers and negative zero: rejects with INVALID_STAKE', () => {
      const negativeTestCases = [
        -1,
        -10,
        -50,
        -100,
        -1_000,
        -10_000_000,
        -0.0001,
        -0.99,
        -9.99,
        -15.5,
        -1e10,
        -1e15,
        -Number.MAX_SAFE_INTEGER,
        -0,
      ];

      for (const neg of negativeTestCases) {
        const result = validateCrashStake(neg, 100_000);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('INVALID_STAKE');
        expect(result.message).toBeDefined();
      }
    });

    it('fuzzes non-numeric and special IEEE 754 floats: rejects with INVALID_STAKE', () => {
      const nonNumerics: unknown[] = [
        NaN,
        Infinity,
        -Infinity,
        null,
        undefined,
        '100',
        '10',
        '0',
        '-50',
        'abc',
        '',
        ' ',
        {},
        [],
        [10],
        { stake: 100 },
        true,
        false,
        Symbol('stake'),
        () => 10,
      ];

      for (const nonNum of nonNumerics) {
        const result = validateCrashStake(nonNum, 100_000);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('INVALID_STAKE');
        expect(result.message).toBe('Geçersiz yatırım tutarı');
      }
    });

    it('fuzzes floats and fractional stakes: validates floor sanitization and boundary clamping', () => {
      // Floats >= 10 that floor to valid stakes
      const validFloats = [
        { input: 10.0, expected: 10 },
        { input: 10.0001, expected: 10 },
        { input: 10.9999, expected: 10 },
        { input: 25.5, expected: 25 },
        { input: 99.999, expected: 99 },
        { input: 1500.75, expected: 1500 },
        { input: 9_999_999.99, expected: 9_999_999 },
      ];

      for (const { input, expected } of validFloats) {
        const result = validateCrashStake(input, 10_000_000);
        expect(result.valid).toBe(true);
        expect(result.sanitizedStake).toBe(expected);
      }

      // Floats that floor to < 10 must be rejected
      const invalidFloats = [9.9999, 9.5, 9.0, 5.7, 1.2, 0.5, 0.0001];
      for (const input of invalidFloats) {
        const result = validateCrashStake(input, 10_000);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('INVALID_STAKE');
        expect(result.message).toContain('Minimum yatırım 10 Nakit');
      }
    });

    it('fuzzes zero and near-zero balances: enforces INSUFFICIENT_CASH vs INVALID_STAKE precedence', () => {
      // When stake < 10, INVALID_STAKE takes precedence
      const subMinZeroBalance = validateCrashStake(5, 0);
      expect(subMinZeroBalance.valid).toBe(false);
      expect(subMinZeroBalance.error).toBe('INVALID_STAKE');

      // When stake >= 10 but balance = 0, INSUFFICIENT_CASH is triggered
      const zeroBalance = validateCrashStake(10, 0);
      expect(zeroBalance.valid).toBe(false);
      expect(zeroBalance.error).toBe('INSUFFICIENT_CASH');
      expect(zeroBalance.message).toBe('Yetersiz bakiye');

      const zeroBalanceLargeStake = validateCrashStake(500, 0);
      expect(zeroBalanceLargeStake.valid).toBe(false);
      expect(zeroBalanceLargeStake.error).toBe('INSUFFICIENT_CASH');

      // Balance = 9 (below minimum possible stake)
      const balance9 = validateCrashStake(10, 9);
      expect(balance9.valid).toBe(false);
      expect(balance9.error).toBe('INSUFFICIENT_CASH');
    });

    it('validates exact balance matching across diverse scales', () => {
      const exactBalances = [10, 50, 100, 250, 1_000, 50_000, 10_000_000];

      for (const bal of exactBalances) {
        const result = validateCrashStake(bal, bal);
        expect(result.valid).toBe(true);
        expect(result.sanitizedStake).toBe(bal);
      }
    });

    it('validates numbers exceeding balance by small and large deltas', () => {
      const testCases = [
        { stake: 11, balance: 10 },
        { stake: 10.0001, balance: 9 }, // floored to 10 > 9
        { stake: 101, balance: 100 },
        { stake: 500, balance: 499 },
        { stake: 1_000, balance: 999 },
        { stake: 10_000_000, balance: 9_999_999 },
        { stake: 200_000, balance: 100_000 },
      ];

      for (const { stake, balance } of testCases) {
        const result = validateCrashStake(stake, balance);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('INSUFFICIENT_CASH');
        expect(result.message).toBe('Yetersiz bakiye');
      }
    });

    it('fuzzes extreme numbers (10^15, MAX_SAFE_INTEGER, Number.MAX_VALUE): protects upper bound', () => {
      const extremeNumbers = [
        10_000_001,
        15_000_000,
        100_000_000,
        1_000_000_000,
        1e12,
        1e15, // 10^15 required by mission
        Number.MAX_SAFE_INTEGER,
        Number.MAX_VALUE,
      ];

      // Even if player has infinite/astronomical balance (10^18), stake cannot exceed 10,000,000
      const hugeBalance = 1e18;
      for (const extreme of extremeNumbers) {
        const result = validateCrashStake(extreme, hugeBalance);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('INVALID_STAKE');
        expect(result.message).toContain('Maksimum yatırım');
      }
    });

    it('boundary conditions around minStake and maxStake', () => {
      // minStake - 1 = 9
      expect(validateCrashStake(9, 1000).valid).toBe(false);
      // minStake = 10
      expect(validateCrashStake(10, 1000).valid).toBe(true);
      // minStake + 1 = 11
      expect(validateCrashStake(11, 1000).valid).toBe(true);

      // maxStake - 1 = 9_999_999
      expect(validateCrashStake(9_999_999, 20_000_000).valid).toBe(true);
      // maxStake = 10_000_000
      expect(validateCrashStake(10_000_000, 20_000_000).valid).toBe(true);
      // maxStake + 1 = 10_000_001
      expect(validateCrashStake(10_000_001, 20_000_000).valid).toBe(false);
    });

    it('verifies custom CryptoCrashConfig limits when passed', () => {
      const customConfig = {
        minStakeCash: 50,
        maxStakeCash: 5000,
      };

      expect(validateCrashStake(40, 1000, customConfig).valid).toBe(false);
      expect(validateCrashStake(50, 1000, customConfig).valid).toBe(true);
      expect(validateCrashStake(5000, 10000, customConfig).valid).toBe(true);
      expect(validateCrashStake(5001, 10000, customConfig).valid).toBe(false);
    });
  });

  // =========================================================================
  // CHALLENGE 2: Adaptive Crash Engine Fuzzer & House Edge Oracle
  // =========================================================================
  describe('Challenge 2: Adaptive Crash Engine & House Edge Protection', () => {
    const SERVER_SEED = 'empirical_challenger_server_seed_o10';
    const CLIENT_SEED = 'empirical_challenger_client_seed_o10';

    it('calculates risk score escalation deterministically across stake ratios and win streaks', () => {
      // 1. Modest steady bets (lambda <= 1.5, W <= 1) => riskScore = 0
      expect(calculateCrashRiskScore(100, 100, 0).riskScore).toBe(0);
      expect(calculateCrashRiskScore(150, 100, 0).riskScore).toBe(0);
      expect(calculateCrashRiskScore(100, 100, 1).riskScore).toBe(0);
      expect(calculateCrashRiskScore(150, 100, 1).riskScore).toBe(0);

      // 2. Modest bets during long win streak (lambda = 1.0, W = 10) => riskScore MUST remain 0!
      // (A cautious player betting baseline should NOT be penalised for winning)
      expect(calculateCrashRiskScore(100, 100, 10).riskScore).toBe(0);

      // 3. Sudden stake jump (lambda = 2.5, W = 0):
      // stakePenalty = 0.8 * (2.5 - 1.5)/2.0 = 0.40
      const r25 = calculateCrashRiskScore(250, 100, 0);
      expect(r25.riskScore).toBeCloseTo(0.4, 3);
      expect(r25.stakeRatio).toBe(2.5);

      // 4. Large stake jump (lambda = 3.5, W = 0):
      // stakePenalty = 0.8 * (3.5 - 1.5)/2.0 = 0.80
      const r35 = calculateCrashRiskScore(350, 100, 0);
      expect(r35.riskScore).toBeCloseTo(0.8, 3);
      expect(r35.stakeRatio).toBe(3.5);

      // 5. Extreme stake jump (lambda = 4.0+, W = 0):
      // stakePenalty = 0.8 * (4.0 - 1.5)/2.0 = 1.0 (clamped to 1.0)
      const r40 = calculateCrashRiskScore(400, 100, 0);
      expect(r40.riskScore).toBe(1.0);

      // 6. Martingale jump after consecutive wins:
      // lambda = 2.5, W = 3:
      // stakePenalty = 0.40, streakPenalty = 0.3 * (3 - 1) * (2.5 - 1.0)/1.5 = 0.60 => total 1.0
      const rMartingale = calculateCrashRiskScore(250, 100, 3);
      expect(rMartingale.riskScore).toBe(1.0);

      // lambda = 2.0, W = 3:
      // stakePenalty = 0.8 * (2.0 - 1.5)/2 = 0.20, streakPenalty = 0.3 * 2 * (1.0/1.5) = 0.40 => 0.60
      const rMartingale2 = calculateCrashRiskScore(200, 100, 3);
      expect(rMartingale2.riskScore).toBeCloseTo(0.6, 3);
    });

    it('Monte Carlo Oracle (10,000 rounds): steady modest bets yield low early dump rate ~35.35% and 0% biased dumps', () => {
      const N = 10_000;
      const normalContext: PlayerCrashAdaptiveContext = {
        recentStakes: [100, 100, 100, 100, 100],
        averageStake: 100,
        consecutiveWins: 0,
        currentStake: 100, // lambda = 1.0
      };

      let earlyDumpCount = 0;
      let biasedRoundCount = 0;
      let totalMultiplierSum = 0;

      for (let nonce = 0; nonce < N; nonce++) {
        const res = generateAdaptiveCrashMultiplier(
          SERVER_SEED,
          CLIENT_SEED,
          nonce,
          normalContext,
        );

        if (res.crashMultiplier < 1.5) {
          earlyDumpCount++;
        }
        if (res.isAdaptiveBiased) {
          biasedRoundCount++;
        }
        totalMultiplierSum += res.crashMultiplier;
      }

      const earlyDumpRatePct = (earlyDumpCount / N) * 100;

      // P(M < 1.50) must be ~35.35% (tolerance: 33.0% to 37.5%)
      expect(earlyDumpRatePct).toBeGreaterThanOrEqual(33.0);
      expect(earlyDumpRatePct).toBeLessThanOrEqual(37.5);

      // Biased round count must be strictly 0
      expect(biasedRoundCount).toBe(0);

      // High RTP engagement: average multiplier is generous (Pareto long tail)
      const avgMultiplier = totalMultiplierSum / N;
      expect(avgMultiplier).toBeGreaterThanOrEqual(4.0);
    });

    it('Monte Carlo Oracle (10,000 rounds): sudden spike bets (>2.5x average) escalate early dump rate to 70%-80%', () => {
      const N = 10_000;
      // High roller jump: average = 100, bet = 400 (4.0x average) -> riskScore = 1.0
      const spikeContext: PlayerCrashAdaptiveContext = {
        recentStakes: [100, 100, 100, 100],
        averageStake: 100,
        consecutiveWins: 0,
        currentStake: 400, // lambda = 4.0 -> riskScore = 1.0
      };

      let earlyDumpCount = 0;
      let biasedRoundCount = 0;
      let instantCrashCount = 0;

      for (let nonce = 0; nonce < N; nonce++) {
        const res = generateAdaptiveCrashMultiplier(
          SERVER_SEED,
          CLIENT_SEED,
          nonce,
          spikeContext,
        );

        if (res.crashMultiplier < 1.5) {
          earlyDumpCount++;
        }
        if (res.isAdaptiveBiased) {
          biasedRoundCount++;
          // Biased dump multiplier must strictly reside in [1.01x, 1.48x]
          expect(res.crashMultiplier).toBeGreaterThanOrEqual(1.01);
          expect(res.crashMultiplier).toBeLessThanOrEqual(1.48);
        }
        if (res.isInstantCrash) {
          instantCrashCount++;
        }
      }

      const earlyDumpRatePct = (earlyDumpCount / N) * 100;
      const biasedRatePct = (biasedRoundCount / N) * 100;

      // MISSION REQUIREMENT: Verify early dump rate escalates to 70%-80%, protecting the house edge
      // Theoretical: 0.65 (bias) + 0.35 * 0.3535 (unbiased) = 77.37%
      expect(earlyDumpRatePct).toBeGreaterThanOrEqual(74.5);
      expect(earlyDumpRatePct).toBeLessThanOrEqual(80.0);

      // Biased early dump activated in ~65% of rounds
      expect(biasedRatePct).toBeGreaterThanOrEqual(62.5);
      expect(biasedRatePct).toBeLessThanOrEqual(67.5);
      expect(instantCrashCount).toBeGreaterThan(0);
    });

    it('Monte Carlo Oracle (10,000 rounds): Martingale jumps after consecutive wins escalate early dump rate to 75%-80%', () => {
      const N = 10_000;
      // Player won 3 times in a row, then jumps bet 2.5x
      // stakePenalty = 0.40, streakPenalty = 0.60 -> total riskScore = 1.0
      const martingaleContext: PlayerCrashAdaptiveContext = {
        recentStakes: [100, 100, 100],
        averageStake: 100,
        consecutiveWins: 3,
        currentStake: 250,
      };

      let earlyDumpCount = 0;
      let biasedRoundCount = 0;

      for (let nonce = 0; nonce < N; nonce++) {
        const res = generateAdaptiveCrashMultiplier(
          SERVER_SEED,
          CLIENT_SEED,
          nonce,
          martingaleContext,
        );

        if (res.crashMultiplier < 1.5) {
          earlyDumpCount++;
        }
        if (res.isAdaptiveBiased) {
          biasedRoundCount++;
        }
      }

      const earlyDumpRatePct = (earlyDumpCount / N) * 100;
      // Escalates to 70%-80%
      expect(earlyDumpRatePct).toBeGreaterThanOrEqual(74.5);
      expect(earlyDumpRatePct).toBeLessThanOrEqual(80.0);
      expect((biasedRoundCount / N) * 100).toBeGreaterThanOrEqual(62.5);
    });

    it('verifies settlement math on biased rounds vs normal rounds', () => {
      // When round dumps at 1.20x:
      // Player trying to cash out at 2.0x loses stake
      const lateCashout = settleCrashBet({
        stake: 1000,
        crashMultiplier: 1.2,
        cashoutMultiplier: 2.0,
      });
      expect(lateCashout.status).toBe('crashed');
      expect(lateCashout.payoutCash).toBe(0);
      expect(lateCashout.netProfit).toBe(-1000);

      // Player who cashes out cleanly before dump (e.g. 1.10x) wins
      const cleanCashout = settleCrashBet({
        stake: 1000,
        crashMultiplier: 1.2,
        cashoutMultiplier: 1.1,
      });
      expect(cleanCashout.status).toBe('won');
      expect(cleanCashout.payoutCash).toBe(1100);
      expect(cleanCashout.netProfit).toBe(100);
    });

    it('documents IEEE 754 precision boundary in settleCrashBet: 1.15 * 100 evaluates to 114.99999999999999 and floors to 1.14', () => {
      const settlement = settleCrashBet({
        stake: 1000,
        crashMultiplier: 1.2,
        cashoutMultiplier: 1.15,
      });
      // Documented finding: Math.floor(1.15 * 100) / 100 truncates to 1.14
      expect(settlement.finalMultiplier).toBe(1.14);
      expect(settlement.payoutCash).toBe(1140);
    });
  });

  // =========================================================================
  // CHALLENGE 3: Extended Streak Milestones Math & Continuous Progression
  // =========================================================================
  describe('Challenge 3: Extended Streak Milestones Math & Continuous Progression', () => {
    const sru = 1000;

    it('verifies exact math, cash bonuses, SRU multipliers, and badge for all 5 milestones', () => {
      // Day 7: 1.0x SRU + 500 Cash
      const d7 = calculateExtendedStreakReward(7, sru);
      expect(d7.points).toBe(1000); // 1.0 * 1000
      expect(d7.cash).toBe(500);
      expect(d7.sruMultiplier).toBe(1.0);
      expect(d7.isMilestone).toBe(true);
      expect(d7.milestoneDay).toBe(7);
      expect(d7.isCycleBonus).toBe(true);
      expect(d7.badge).toBeUndefined();

      // Day 30 (1 Ay): 2.5x SRU + 5,000 Cash
      const d30 = calculateExtendedStreakReward(30, sru);
      expect(d30.points).toBe(2500); // 2.5 * 1000
      expect(d30.cash).toBe(5000);
      expect(d30.sruMultiplier).toBe(2.5);
      expect(d30.isMilestone).toBe(true);
      expect(d30.milestoneDay).toBe(30);
      expect(d30.isCycleBonus).toBe(true);
      expect(d30.badge).toBeUndefined();

      // Day 90 (3 Ay): 5.0x SRU + 25,000 Cash
      const d90 = calculateExtendedStreakReward(90, sru);
      expect(d90.points).toBe(5000); // 5.0 * 1000
      expect(d90.cash).toBe(25000);
      expect(d90.sruMultiplier).toBe(5.0);
      expect(d90.isMilestone).toBe(true);
      expect(d90.milestoneDay).toBe(90);
      expect(d90.isCycleBonus).toBe(true);
      expect(d90.badge).toBeUndefined();

      // Day 180 (6 Ay): 10.0x SRU + 100,000 Cash
      const d180 = calculateExtendedStreakReward(180, sru);
      expect(d180.points).toBe(10000); // 10.0 * 1000
      expect(d180.cash).toBe(100000);
      expect(d180.sruMultiplier).toBe(10.0);
      expect(d180.isMilestone).toBe(true);
      expect(d180.milestoneDay).toBe(180);
      expect(d180.isCycleBonus).toBe(true);
      expect(d180.badge).toBeUndefined();

      // Day 365 (1 Yıl): 25.0x SRU + 500,000 Cash + imperial_veteran badge
      const d365 = calculateExtendedStreakReward(365, sru);
      expect(d365.points).toBe(25000); // 25.0 * 1000
      expect(d365.cash).toBe(500000);
      expect(d365.sruMultiplier).toBe(25.0);
      expect(d365.isMilestone).toBe(true);
      expect(d365.milestoneDay).toBe(365);
      expect(d365.isCycleBonus).toBe(true);
      expect(d365.badge).toBe('imperial_veteran');
    });

    it('verifies exact math across test matrix requested in user prompt: Days 0, 1, 6, 7, 8, 29, 30, 31, 89, 90, 91, 179, 180, 181, 364, 365, 366, 1000', () => {
      const matrix: Array<{
        day: number;
        expectedMultiplier: number;
        expectedCash: number;
        expectedPoints: number;
        expectedIsMilestone: boolean;
        expectedIsCycleBonus: boolean;
        expectedBadge?: string;
      }> = [
        // Day 0
        {
          day: 0,
          expectedMultiplier: 0.25,
          expectedCash: 0,
          expectedPoints: 250,
          expectedIsMilestone: false,
          expectedIsCycleBonus: false,
        },
        // Day 1
        {
          day: 1,
          expectedMultiplier: 0.25,
          expectedCash: 0,
          expectedPoints: 250,
          expectedIsMilestone: false,
          expectedIsCycleBonus: false,
        },
        // Day 6
        {
          day: 6,
          expectedMultiplier: 0.25,
          expectedCash: 0,
          expectedPoints: 250,
          expectedIsMilestone: false,
          expectedIsCycleBonus: false,
        },
        // Day 7: Milestone 1
        {
          day: 7,
          expectedMultiplier: 1.0,
          expectedCash: 500,
          expectedPoints: 1000,
          expectedIsMilestone: true,
          expectedIsCycleBonus: true,
        },
        // Day 8
        {
          day: 8,
          expectedMultiplier: 0.25,
          expectedCash: 0,
          expectedPoints: 250,
          expectedIsMilestone: false,
          expectedIsCycleBonus: false,
        },
        // Day 29
        {
          day: 29,
          expectedMultiplier: 0.25,
          expectedCash: 0,
          expectedPoints: 250,
          expectedIsMilestone: false,
          expectedIsCycleBonus: false,
        },
        // Day 30: Milestone 2
        {
          day: 30,
          expectedMultiplier: 2.5,
          expectedCash: 5000,
          expectedPoints: 2500,
          expectedIsMilestone: true,
          expectedIsCycleBonus: true,
        },
        // Day 31
        {
          day: 31,
          expectedMultiplier: 0.25,
          expectedCash: 0,
          expectedPoints: 250,
          expectedIsMilestone: false,
          expectedIsCycleBonus: false,
        },
        // Day 89
        {
          day: 89,
          expectedMultiplier: 0.25,
          expectedCash: 0,
          expectedPoints: 250,
          expectedIsMilestone: false,
          expectedIsCycleBonus: false,
        },
        // Day 90: Milestone 3
        {
          day: 90,
          expectedMultiplier: 5.0,
          expectedCash: 25000,
          expectedPoints: 5000,
          expectedIsMilestone: true,
          expectedIsCycleBonus: true,
        },
        // Day 91: 91 % 7 === 0 -> cyclical weekly bonus
        {
          day: 91,
          expectedMultiplier: 1.0,
          expectedCash: 0,
          expectedPoints: 1000,
          expectedIsMilestone: false,
          expectedIsCycleBonus: true,
        },
        // Day 179
        {
          day: 179,
          expectedMultiplier: 0.25,
          expectedCash: 0,
          expectedPoints: 250,
          expectedIsMilestone: false,
          expectedIsCycleBonus: false,
        },
        // Day 180: Milestone 4
        {
          day: 180,
          expectedMultiplier: 10.0,
          expectedCash: 100000,
          expectedPoints: 10000,
          expectedIsMilestone: true,
          expectedIsCycleBonus: true,
        },
        // Day 181
        {
          day: 181,
          expectedMultiplier: 0.25,
          expectedCash: 0,
          expectedPoints: 250,
          expectedIsMilestone: false,
          expectedIsCycleBonus: false,
        },
        // Day 364: 364 % 7 === 0 (Week 52) -> cyclical weekly bonus
        {
          day: 364,
          expectedMultiplier: 1.0,
          expectedCash: 0,
          expectedPoints: 1000,
          expectedIsMilestone: false,
          expectedIsCycleBonus: true,
        },
        // Day 365: Milestone 5
        {
          day: 365,
          expectedMultiplier: 25.0,
          expectedCash: 500000,
          expectedPoints: 25000,
          expectedIsMilestone: true,
          expectedIsCycleBonus: true,
          expectedBadge: 'imperial_veteran',
        },
        // Day 366
        {
          day: 366,
          expectedMultiplier: 0.25,
          expectedCash: 0,
          expectedPoints: 250,
          expectedIsMilestone: false,
          expectedIsCycleBonus: false,
        },
        // Day 1000
        {
          day: 1000,
          expectedMultiplier: 0.25,
          expectedCash: 0,
          expectedPoints: 250,
          expectedIsMilestone: false,
          expectedIsCycleBonus: false,
        },
      ];

      for (const row of matrix) {
        const reward = calculateExtendedStreakReward(row.day, sru);
        expect(reward.sruMultiplier).toBe(row.expectedMultiplier);
        expect(reward.cash).toBe(row.expectedCash);
        expect(reward.points).toBe(row.expectedPoints);
        expect(reward.isMilestone).toBe(row.expectedIsMilestone);
        expect(reward.isCycleBonus).toBe(row.expectedIsCycleBonus);
        if (row.expectedBadge) {
          expect(reward.badge).toBe(row.expectedBadge);
        }
      }
    });

    it('verifies continuous streak progression without 7-day modulo reset up to Day 1000', () => {
      // Simulate player logging in every single calendar day from Day 1 to Day 1000
      let currentStreak = 0;
      let lastDate = new Date('2026-01-01T00:00:00.000Z');

      // First day
      const firstEval = evaluateStreak(
        null,
        lastDate.toISOString().slice(0, 10),
        currentStreak,
      );
      expect(firstEval.canClaim).toBe(true);
      expect(firstEval.nextStreak).toBe(1);
      expect(firstEval.wasReset).toBe(false);
      currentStreak = 1;

      // 999 consecutive days
      for (let day = 2; day <= 1000; day++) {
        const nextDate = new Date(lastDate.getTime() + 24 * 60 * 60 * 1000);
        const evalResult = evaluateStreak(
          lastDate.toISOString().slice(0, 10),
          nextDate.toISOString().slice(0, 10),
          currentStreak,
        );

        expect(evalResult.canClaim).toBe(true);
        expect(evalResult.nextStreak).toBe(day);
        expect(evalResult.wasReset).toBe(false);

        // Explicit checkpoints: Day 8 must be 8 (NOT 1!)
        if (day === 8) {
          expect(evalResult.nextStreak).toBe(8);
        }
        if (day === 30) {
          expect(evalResult.nextStreak).toBe(30);
        }
        if (day === 31) {
          expect(evalResult.nextStreak).toBe(31);
        }
        if (day === 90) {
          expect(evalResult.nextStreak).toBe(90);
        }
        if (day === 180) {
          expect(evalResult.nextStreak).toBe(180);
        }
        if (day === 365) {
          expect(evalResult.nextStreak).toBe(365);
        }
        if (day === 366) {
          expect(evalResult.nextStreak).toBe(366);
        }

        currentStreak = evalResult.nextStreak;
        lastDate = nextDate;
      }

      expect(currentStreak).toBe(1000);
    });

    it('verifies reset invariants when missing a day across months and years', () => {
      // Missed 1 day (e.g. 2 days elapsed): reset to 1
      const missed1 = evaluateStreak('2026-09-10', '2026-09-12', 45);
      expect(missed1.canClaim).toBe(true);
      expect(missed1.nextStreak).toBe(1);
      expect(missed1.wasReset).toBe(true);

      // Missed 10 days: reset to 1
      const missed10 = evaluateStreak('2026-09-01', '2026-09-11', 180);
      expect(missed10.canClaim).toBe(true);
      expect(missed10.nextStreak).toBe(1);
      expect(missed10.wasReset).toBe(true);

      // Same calendar day duplicate claim: reject claim
      const sameDay = evaluateStreak('2026-09-14', '2026-09-14', 15);
      expect(sameDay.canClaim).toBe(false);
      expect(sameDay.nextStreak).toBe(15);
      expect(sameDay.wasReset).toBe(false);

      // Clock anomaly (current date in past): reject claim
      const clockAnomaly = evaluateStreak('2026-09-15', '2026-09-14', 15);
      expect(clockAnomaly.canClaim).toBe(false);
      expect(clockAnomaly.nextStreak).toBe(15);
      expect(clockAnomaly.wasReset).toBe(false);

      // Month transitions (31st to 1st)
      const monthEnd = evaluateStreak('2026-01-31', '2026-02-01', 25);
      expect(monthEnd.canClaim).toBe(true);
      expect(monthEnd.nextStreak).toBe(26);
      expect(monthEnd.wasReset).toBe(false);

      // Leap year transition (2028-02-28 to 2028-02-29)
      const leapDay = evaluateStreak('2028-02-28', '2028-02-29', 58);
      expect(leapDay.canClaim).toBe(true);
      expect(leapDay.nextStreak).toBe(59);
      expect(leapDay.wasReset).toBe(false);

      // Leap year to March (2028-02-29 to 2028-03-01)
      const leapToMarch = evaluateStreak('2028-02-29', '2028-03-01', 59);
      expect(leapToMarch.canClaim).toBe(true);
      expect(leapToMarch.nextStreak).toBe(60);
      expect(leapToMarch.wasReset).toBe(false);

      // Year transition (2026-12-31 to 2027-01-01)
      const yearEnd = evaluateStreak('2026-12-31', '2027-01-01', 364);
      expect(yearEnd.canClaim).toBe(true);
      expect(yearEnd.nextStreak).toBe(365);
      expect(yearEnd.wasReset).toBe(false);
    });
  });
});
