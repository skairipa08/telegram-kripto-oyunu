import { describe, expect, it } from 'vitest';
import {
  calculateCompositeRiskScore,
  evaluateBurstAndReplay,
  evaluateEconomyVelocity,
  evaluateReferralGraphAndAbuse,
  FRAUD_REASON_CODES,
  type RequestHistoryItem,
} from './fraud';

describe('Adversarial Anti-Fraud Stress Harness (Challenger 1)', () => {
  // ==========================================================================
  // OBJECTIVE 1: Referral Graph Cycle Traversal & Sybil Abuse
  // ==========================================================================
  describe('1. Referral Graph Cycle Traversal Stress', () => {
    it('detects cycle in a 50-node deep ancestor chain (N49 -> N48 -> ... -> N0)', () => {
      // Build a 50-node linear parent map: N_0 -> N_1 -> N_2 -> ... -> N_49
      // When N_49 attempts to bind N_0 as its parent, it closes a 50-node circular loop.
      const parents = new Map<string, string>();
      for (let i = 0; i < 49; i++) {
        parents.set(`node_${i}`, `node_${i + 1}`);
      }

      const signal = evaluateReferralGraphAndAbuse({
        inviteeUserId: 'node_49',
        referrerUserId: 'node_0',
        referralParents: parents,
      });

      expect(signal.hasCycle).toBe(true);
      expect(signal.isViolated).toBe(true);
      expect(signal.score).toBe(100);
      expect(signal.cycleLength).toBe(50); // node_0 through node_49
      expect(signal.cyclePath[0]).toBe('node_0');
      expect(signal.cyclePath[signal.cyclePath.length - 1]).toBe('node_49');
      expect(signal.reasonCodes).toContain(
        FRAUD_REASON_CODES.CIRCULAR_REFERRAL_SUSPECT,
      );
    });

    it('detects cycle in a 100-node deep chain without stack overflow', () => {
      const parents = new Map<string, string>();
      for (let i = 0; i < 99; i++) {
        parents.set(`deep_${i}`, `deep_${i + 1}`);
      }

      const signal = evaluateReferralGraphAndAbuse({
        inviteeUserId: 'deep_99',
        referrerUserId: 'deep_0',
        referralParents: parents,
      });

      expect(signal.hasCycle).toBe(true);
      expect(signal.cycleLength).toBe(100);
      expect(signal.score).toBe(100);
    });

    it('confirms non-cycle in a 50-node ancestor chain when invitee is external', () => {
      const parents = new Map<string, string>();
      for (let i = 0; i < 49; i++) {
        parents.set(`linear_${i}`, `linear_${i + 1}`);
      }

      const signal = evaluateReferralGraphAndAbuse({
        inviteeUserId: 'external_user',
        referrerUserId: 'linear_0',
        referralParents: parents,
      });

      expect(signal.hasCycle).toBe(false);
      expect(signal.isViolated).toBe(false);
      expect(signal.score).toBe(0);
      expect(signal.cycleLength).toBe(0);
      expect(signal.cyclePath).toHaveLength(0);
    });

    it('handles complex branching tree topologies with multiple leaf nodes', () => {
      // Tree: Root(R) -> BranchA(A1 -> A2) and BranchB(B1 -> B2)
      const parents = new Map<string, string>([
        ['leaf_A2', 'node_A1'],
        ['node_A1', 'root'],
        ['leaf_B2', 'node_B1'],
        ['node_B1', 'root'],
      ]);

      // Binding root to leaf_A2 creates cycle: root -> leaf_A2 -> node_A1 -> root
      const signal = evaluateReferralGraphAndAbuse({
        inviteeUserId: 'root',
        referrerUserId: 'leaf_A2',
        referralParents: parents,
      });

      expect(signal.hasCycle).toBe(true);
      expect(signal.cycleLength).toBe(3); // leaf_A2 -> node_A1 -> root
      expect(signal.cyclePath).toEqual(['leaf_A2', 'node_A1', 'root']);
      expect(signal.reasonCodes).toContain(
        FRAUD_REASON_CODES.CIRCULAR_REFERRAL_SUSPECT,
      );

      // Binding leaf_B2 to leaf_A2 does NOT create a cycle (leaf_B2 -> leaf_A2 -> node_A1 -> root -> end)
      const safeSignal = evaluateReferralGraphAndAbuse({
        inviteeUserId: 'leaf_B2',
        referrerUserId: 'leaf_A2',
        referralParents: parents,
      });
      expect(safeSignal.hasCycle).toBe(false);
    });

    it('safely handles disconnected cycles in unrelated graph components', () => {
      // Unrelated cycle: X -> Y -> Z -> X
      // Valid path: Referrer(B) -> Parent(C) -> null
      // Invitee: A
      const parents = new Map<string, string>([
        ['cycle_X', 'cycle_Y'],
        ['cycle_Y', 'cycle_Z'],
        ['cycle_Z', 'cycle_X'],
        ['user_B', 'user_C'],
      ]);

      const signal = evaluateReferralGraphAndAbuse({
        inviteeUserId: 'user_A',
        referrerUserId: 'user_B',
        referralParents: parents,
      });

      expect(signal.hasCycle).toBe(false);
      expect(signal.isViolated).toBe(false);
    });

    it('terminates safely when referrer points to a cycle not involving invitee (loop termination)', () => {
      // Referrer(R) -> LoopA -> LoopB -> LoopA
      // Invitee(I) is not in the loop.
      const parents = new Map<string, string>([
        ['user_R', 'loop_A'],
        ['loop_A', 'loop_B'],
        ['loop_B', 'loop_A'],
      ]);

      const signal = evaluateReferralGraphAndAbuse({
        inviteeUserId: 'user_I',
        referrerUserId: 'user_R',
        referralParents: parents,
      });

      // Visited set terminates loop before infinite cycle
      expect(signal.hasCycle).toBe(false);
      expect(signal.isViolated).toBe(false);
    });

    it('normalizes whitespace variations on invitee and referrer IDs', () => {
      // Test 1: Self-referral with whitespace
      const selfSignal = evaluateReferralGraphAndAbuse({
        inviteeUserId: '   player_alpha \t',
        referrerUserId: 'player_alpha\n',
        referralParents: {},
      });

      expect(selfSignal.hasCycle).toBe(true);
      expect(selfSignal.cycleLength).toBe(1);
      expect(selfSignal.reasonCodes).toContain(
        FRAUD_REASON_CODES.SELF_REFERRAL_DETECTED,
      );
      expect(selfSignal.score).toBe(100);

      // Test 2: Cycle with whitespace
      const cycleSignal = evaluateReferralGraphAndAbuse({
        inviteeUserId: '  player_target  ',
        referrerUserId: ' \t player_ref ',
        referralParents: {
          player_ref: 'player_target',
        },
      });

      expect(cycleSignal.hasCycle).toBe(true);
      expect(cycleSignal.cycleLength).toBe(2);
      expect(cycleSignal.reasonCodes).toContain(
        FRAUD_REASON_CODES.RECIPROCAL_REFERRAL_SUSPECT,
      );
    });

    it('detects 2-node reciprocal mutual loops (A -> B -> A)', () => {
      const signal = evaluateReferralGraphAndAbuse({
        inviteeUserId: 'alice',
        referrerUserId: 'bob',
        referralParents: { bob: 'alice' },
      });

      expect(signal.hasCycle).toBe(true);
      expect(signal.cycleLength).toBe(2);
      expect(signal.reasonCodes).toContain(
        FRAUD_REASON_CODES.RECIPROCAL_REFERRAL_SUSPECT,
      );
      expect(signal.score).toBe(100);
    });

    it('behaves identically with Map and plain Record dictionary inputs', () => {
      const mapInput = new Map<string, string>([
        ['b', 'c'],
        ['c', 'a'],
      ]);
      const recordInput = { b: 'c', c: 'a' };

      const resMap = evaluateReferralGraphAndAbuse({
        inviteeUserId: 'a',
        referrerUserId: 'b',
        referralParents: mapInput,
      });

      const resRecord = evaluateReferralGraphAndAbuse({
        inviteeUserId: 'a',
        referrerUserId: 'b',
        referralParents: recordInput,
      });

      expect(resMap.hasCycle).toBe(resRecord.hasCycle);
      expect(resMap.cycleLength).toBe(resRecord.cycleLength);
      expect(resMap.score).toBe(resRecord.score);
      expect(resMap.cyclePath).toEqual(resRecord.cyclePath);
    });

    it('resists prototype pollution keys in object records (__proto__, toString, valueOf)', () => {
      const recordWithProto = Object.create(null);
      recordWithProto['user_b'] = 'user_c';
      recordWithProto['__proto__'] = 'malicious_parent';
      recordWithProto['toString'] = 'malicious_parent';

      const signal = evaluateReferralGraphAndAbuse({
        inviteeUserId: 'user_a',
        referrerUserId: 'user_b',
        referralParents: recordWithProto,
      });

      expect(signal.hasCycle).toBe(false);
      expect(signal.isViolated).toBe(false);
    });

    it('scores 100 on massive referral burst farming (> 10 binds)', () => {
      const signal = evaluateReferralGraphAndAbuse({
        inviteeUserId: 'bot_invitee_45',
        referrerUserId: 'sybil_master',
        referralParents: {},
        recentBindsToReferrerInWindow: 45, // 35 over threshold
        maxRecentBindsThreshold: 10,
      });

      expect(signal.isViolated).toBe(true);
      expect(signal.score).toBe(100);
      expect(signal.reasonCodes).toContain(
        FRAUD_REASON_CODES.REFERRAL_BURST_FARMING,
      );
    });
  });

  // ==========================================================================
  // OBJECTIVE 2: Economy Velocity & Mathematical Stability
  // ==========================================================================
  describe('2. Economy Velocity & Math Stability Stress', () => {
    it('handles floating point inaccuracies without precision crashes or false positives', () => {
      // 100 * 100 * 1.05 = 10,500
      // Claiming exactly 10,500.0000000001
      const signal = evaluateEconomyVelocity({
        claimedCash: 10500.0000000001,
        currentProductionPerSecond: 100,
        elapsedSeconds: 100,
        toleranceMultiplier: 1.05,
      });

      expect(signal.maxAllowedCash).toBe(10500);
      // cashRatio will be 1.00000000000001
      expect(signal.cashVelocityRatio).toBe(1);
      // Micro-excess gives cashScore = 0, isViolated = false
      expect(signal.isViolated).toBe(false);
      expect(signal.score).toBe(0);
    });

    it('enforces offline cap on extreme elapsed durations (10^12 seconds)', () => {
      const signal = evaluateEconomyVelocity({
        claimedCash: 200000,
        currentProductionPerSecond: 10,
        elapsedSeconds: 1e12, // astronomical elapsed time
        offlineCapSeconds: 14400, // 4 hours cap
        toleranceMultiplier: 1.05,
      });

      // Effective seconds capped at 14400: 10 * 14400 * 1.05 = 151200
      expect(signal.maxAllowedCash).toBe(151200);
      expect(signal.isViolated).toBe(true);
      expect(signal.score).toBeGreaterThan(40);
    });

    it('scores 100 for positive claim with zero production across any positive claim magnitude', () => {
      const testCases = [0.00001, 1, 100, 1e9, 1e15];
      for (const claimed of testCases) {
        const signal = evaluateEconomyVelocity({
          claimedCash: claimed,
          currentProductionPerSecond: 0,
          elapsedSeconds: 3600,
        });

        expect(signal.score).toBe(100);
        expect(signal.isViolated).toBe(true);
        expect(signal.cashVelocityRatio).toBe(Infinity);
        expect(signal.reasonCodes).toContain(
          FRAUD_REASON_CODES.VELOCITY_CAP_EXCEEDED,
        );
        expect(signal.reasonCodes).toContain(
          FRAUD_REASON_CODES.CASH_VELOCITY_CAP_EXCEEDED,
        );
      }
    });

    it('scores 0 for zero claim with zero production', () => {
      const signal = evaluateEconomyVelocity({
        claimedCash: 0,
        currentProductionPerSecond: 0,
        elapsedSeconds: 3600,
      });

      expect(signal.score).toBe(0);
      expect(signal.isViolated).toBe(false);
      expect(signal.cashVelocityRatio).toBe(1.0);
      expect(signal.reasonCodes).toHaveLength(0);
    });

    it('detects negative elapsed time as clock manipulation with score 95', () => {
      const signal = evaluateEconomyVelocity({
        claimedCash: 50,
        currentProductionPerSecond: 100,
        elapsedSeconds: -0.5,
      });

      expect(signal.score).toBe(95);
      expect(signal.isViolated).toBe(true);
      expect(signal.cashVelocityRatio).toBe(Infinity);
      expect(signal.reasonCodes).toContain(
        FRAUD_REASON_CODES.NEGATIVE_ELAPSED_TIME,
      );
      expect(signal.reasonCodes).toContain(
        FRAUD_REASON_CODES.VELOCITY_CAP_EXCEEDED,
      );
    });

    it('handles massive velocity ratios (claimedCash = 1e25) without numeric overflow', () => {
      const signal = evaluateEconomyVelocity({
        claimedCash: 1e25,
        currentProductionPerSecond: 10,
        elapsedSeconds: 100,
      });

      expect(signal.score).toBe(100);
      expect(signal.isViolated).toBe(true);
      expect(Number.isFinite(signal.cashVelocityRatio)).toBe(true);
    });

    it('defends against non-finite inputs (NaN, Infinity, -Infinity)', () => {
      const signal = evaluateEconomyVelocity({
        claimedCash: NaN,
        currentProductionPerSecond: Infinity,
        elapsedSeconds: NaN,
      });

      // All sanitized to 0
      expect(signal.score).toBe(0);
      expect(signal.isViolated).toBe(false);
      expect(signal.details.claimedCash).toBe(0);
      expect(signal.details.elapsedSeconds).toBe(0);
    });

    it('validates exact tolerance multiplier boundaries (1.05 drift)', () => {
      const prod = 100;
      const elapsed = 100;
      const tolerance = 1.05;
      const maxAllowed = Math.floor(prod * elapsed * tolerance); // 10500

      // Exact ceiling claim
      const exactSignal = evaluateEconomyVelocity({
        claimedCash: maxAllowed,
        currentProductionPerSecond: prod,
        elapsedSeconds: elapsed,
        toleranceMultiplier: tolerance,
      });
      expect(exactSignal.score).toBe(0);
      expect(exactSignal.isViolated).toBe(false);
      expect(exactSignal.reasonCodes).toHaveLength(0);

      // 1 cash over ceiling claim
      const overSignal = evaluateEconomyVelocity({
        claimedCash: maxAllowed + 1,
        currentProductionPerSecond: prod,
        elapsedSeconds: elapsed,
        toleranceMultiplier: tolerance,
      });
      expect(overSignal.cashVelocityRatio).toBeGreaterThan(1.0);
      expect(overSignal.reasonCodes).toContain(
        FRAUD_REASON_CODES.VELOCITY_CAP_EXCEEDED,
      );
    });
  });

  // ==========================================================================
  // OBJECTIVE 3: Burst & Debounce Sliding Windows
  // ==========================================================================
  describe('3. Burst & Debounce Sliding Windows Stress', () => {
    const baseTime = 1726350000000; // Fixed anchor timestamp

    it('strictly enforces debounce boundary: 199ms fails, 200ms passes, 201ms passes', () => {
      // 199ms delta (< 200ms default)
      const signal199 = evaluateBurstAndReplay({
        currentRequestId: 'req_199',
        currentTimestampMs: baseTime + 199,
        history: [{ timestampMs: baseTime, requestId: 'req_prev' }],
        minDebounceIntervalMs: 200,
      });
      expect(signal199.shortestIntervalMs).toBe(199);
      expect(signal199.score).toBe(50);
      expect(signal199.isViolated).toBe(true);
      expect(signal199.reasonCodes).toContain(
        FRAUD_REASON_CODES.SUB_DEBOUNCE_INTERVAL_VIOLATION,
      );

      // 200ms delta (exact boundary)
      const signal200 = evaluateBurstAndReplay({
        currentRequestId: 'req_200',
        currentTimestampMs: baseTime + 200,
        history: [{ timestampMs: baseTime, requestId: 'req_prev' }],
        minDebounceIntervalMs: 200,
      });
      expect(signal200.shortestIntervalMs).toBe(200);
      expect(signal200.score).toBe(0);
      expect(signal200.isViolated).toBe(false);
      expect(signal200.reasonCodes).not.toContain(
        FRAUD_REASON_CODES.SUB_DEBOUNCE_INTERVAL_VIOLATION,
      );

      // 201ms delta (> 200ms boundary)
      const signal201 = evaluateBurstAndReplay({
        currentRequestId: 'req_201',
        currentTimestampMs: baseTime + 201,
        history: [{ timestampMs: baseTime, requestId: 'req_prev' }],
        minDebounceIntervalMs: 200,
      });
      expect(signal201.shortestIntervalMs).toBe(201);
      expect(signal201.score).toBe(0);
      expect(signal201.isViolated).toBe(false);
    });

    it('correctly processes rapid out-of-order timestamps in history', () => {
      // Out-of-order history: t-4000, t-150, t-1000, t-500
      const history: RequestHistoryItem[] = [
        { timestampMs: baseTime - 4000, requestId: 'r1' },
        { timestampMs: baseTime - 150, requestId: 'r2' }, // shortest delta = 150ms
        { timestampMs: baseTime - 1000, requestId: 'r3' },
        { timestampMs: baseTime - 500, requestId: 'r4' },
      ];

      const signal = evaluateBurstAndReplay({
        currentRequestId: 'current_req',
        currentTimestampMs: baseTime,
        history,
        minDebounceIntervalMs: 200,
      });

      expect(signal.shortestIntervalMs).toBe(150);
      expect(signal.burstCount).toBe(5); // 4 in history (within 5000ms) + 1 current
      expect(signal.isViolated).toBe(true);
      expect(signal.reasonCodes).toContain(
        FRAUD_REASON_CODES.SUB_DEBOUNCE_INTERVAL_VIOLATION,
      );
    });

    it('safely handles future timestamps in history without false shortest interval', () => {
      // History has item from future (t + 5000ms), delta = current - future = -5000 (< 0)
      const history: RequestHistoryItem[] = [
        { timestampMs: baseTime + 5000, requestId: 'future_req' },
        { timestampMs: baseTime - 300, requestId: 'valid_past_req' },
      ];

      const signal = evaluateBurstAndReplay({
        currentRequestId: 'current_req',
        currentTimestampMs: baseTime,
        history,
        minDebounceIntervalMs: 200,
      });

      // Negative delta item ignored by delta >= 0 guard; valid past delta 300ms used
      expect(signal.shortestIntervalMs).toBe(300);
      expect(signal.burstCount).toBe(2);
      expect(signal.isViolated).toBe(false);
    });

    it('detects duplicate request nonce immediately with score 100 and REPLAY_REQUEST_DETECTED', () => {
      const history: RequestHistoryItem[] = [
        { timestampMs: baseTime - 2000, requestId: 'nonce_abc_123' },
        { timestampMs: baseTime - 1000, requestId: 'nonce_def_456' },
      ];

      const signal = evaluateBurstAndReplay({
        currentRequestId: 'nonce_abc_123',
        currentTimestampMs: baseTime,
        history,
      });

      expect(signal.isDuplicate).toBe(true);
      expect(signal.score).toBe(100);
      expect(signal.isViolated).toBe(true);
      expect(signal.reasonCodes).toContain(
        FRAUD_REASON_CODES.REPLAY_REQUEST_DETECTED,
      );
      expect(signal.details.duplicateRequestId).toBe('nonce_abc_123');
    });

    it('triggers burst ceiling at exactly maxBurstRequests + 1', () => {
      const maxBurst = 15;
      const history14: RequestHistoryItem[] = Array.from(
        { length: 14 },
        (_, i) => ({
          timestampMs: baseTime - (i + 1) * 300, // all within 5s, > 200ms debounce
          requestId: `r_${i}`,
        }),
      );

      // 14 in history + current = 15 => exactly maxBurst => no violation
      const signal15 = evaluateBurstAndReplay({
        currentRequestId: 'r_curr',
        currentTimestampMs: baseTime,
        history: history14,
        maxBurstRequests: maxBurst,
      });
      expect(signal15.burstCount).toBe(15);
      expect(signal15.reasonCodes).not.toContain(
        FRAUD_REASON_CODES.RAPID_BURST_REQUESTS,
      );

      // 15 in history + current = 16 => exceeds maxBurst => violation
      const history15: RequestHistoryItem[] = [
        ...history14,
        { timestampMs: baseTime - 4600, requestId: 'r_14' },
      ];
      const signal16 = evaluateBurstAndReplay({
        currentRequestId: 'r_curr',
        currentTimestampMs: baseTime,
        history: history15,
        maxBurstRequests: maxBurst,
      });
      expect(signal16.burstCount).toBe(16);
      expect(signal16.isViolated).toBe(true);
      expect(signal16.reasonCodes).toContain(
        FRAUD_REASON_CODES.RAPID_BURST_REQUESTS,
      );
    });

    it('triggers sustained rate ceiling at exactly maxSustainedRequests + 1', () => {
      const maxSustained = 60;
      // 60 requests in history spaced 900ms apart across 54 seconds
      const history60: RequestHistoryItem[] = Array.from(
        { length: 60 },
        (_, i) => ({
          timestampMs: baseTime - (i + 1) * 900,
          requestId: `s_${i}`,
        }),
      );

      const signal = evaluateBurstAndReplay({
        currentRequestId: 's_curr',
        currentTimestampMs: baseTime,
        history: history60,
        maxSustainedRequests: maxSustained,
        sustainedWindowMs: 60000,
      });

      expect(signal.sustainedCount).toBe(61);
      expect(signal.isViolated).toBe(true);
      expect(signal.reasonCodes).toContain(
        FRAUD_REASON_CODES.SUSTAINED_RATE_EXCEEDED,
      );
    });
  });

  // ==========================================================================
  // OBJECTIVE 4: Composite Risk Scoring Invariants & Critical Floors
  // ==========================================================================
  describe('4. Composite Risk Scoring Invariants & Fuzzing', () => {
    it('critical floor override: replay attack forces score 100 and recommendation reject regardless of other signals', () => {
      const result = calculateCompositeRiskScore({
        velocity: {
          claimedCash: 10,
          currentProductionPerSecond: 100,
          elapsedSeconds: 10,
        }, // velocity score = 0
        burst: {
          currentRequestId: 'replayed_nonce',
          currentTimestampMs: 1000,
          history: [{ timestampMs: 500, requestId: 'replayed_nonce' }],
        }, // burst replay score = 100
      });

      expect(result.score).toBe(100);
      expect(result.tier).toBe('CRITICAL');
      expect(result.recommendation).toBe('reject');
      expect(result.isActionBlocked).toBe(true);
      expect(result.primaryReasons).toContain(
        FRAUD_REASON_CODES.REPLAY_REQUEST_DETECTED,
      );
    });

    it('critical floor override: referral cycle forces score 100 and recommendation reject', () => {
      const result = calculateCompositeRiskScore({
        referral: {
          inviteeUserId: 'user_A',
          referrerUserId: 'user_B',
          referralParents: { user_B: 'user_A' },
        },
      });

      expect(result.score).toBe(100);
      expect(result.tier).toBe('CRITICAL');
      expect(result.recommendation).toBe('reject');
      expect(result.isActionBlocked).toBe(true);
      expect(result.primaryReasons).toContain(
        FRAUD_REASON_CODES.RECIPROCAL_REFERRAL_SUSPECT,
      );
    });

    it('critical floor override: device fingerprint collusion forces score >= 90', () => {
      const result = calculateCompositeRiskScore({
        referral: {
          inviteeUserId: 'user_alpha',
          referrerUserId: 'user_beta',
          inviteeDeviceFingerprint: 'fp_hardware_xyz_999',
          referrerDeviceFingerprint: 'fp_hardware_xyz_999',
          referralParents: {},
        },
      });

      expect(result.score).toBeGreaterThanOrEqual(90);
      expect(result.tier).toBe('CRITICAL');
      expect(result.isActionBlocked).toBe(true);
      expect(result.primaryReasons).toContain(
        FRAUD_REASON_CODES.REFERRAL_DEVICE_COLLUSION,
      );
    });

    it('critical floor override: negative elapsed time forces score >= 95 and freeze/reject', () => {
      const result = calculateCompositeRiskScore({
        velocity: {
          claimedCash: 50,
          currentProductionPerSecond: 10,
          elapsedSeconds: -10,
        },
      });

      expect(result.score).toBeGreaterThanOrEqual(95);
      expect(result.tier).toBe('CRITICAL');
      expect(result.isActionBlocked).toBe(true);
      expect(result.isRewardFrozen).toBe(true);
      expect(result.primaryReasons).toContain(
        FRAUD_REASON_CODES.NEGATIVE_ELAPSED_TIME,
      );
    });

    it('fuzzing invariant: score is strictly clamped to [0, 100] for random inputs', () => {
      for (let i = 0; i < 50; i++) {
        const claimed = Math.random() * 1000000;
        const prod = Math.random() * 500;
        const elapsed = Math.random() * 20000 - 1000;

        const result = calculateCompositeRiskScore({
          velocity: {
            claimedCash: claimed,
            currentProductionPerSecond: prod,
            elapsedSeconds: elapsed,
          },
        });

        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
        expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(result.tier);
        expect(['allow', 'monitor', 'freeze', 'reject']).toContain(
          result.recommendation,
        );
      }
    });
  });
});
