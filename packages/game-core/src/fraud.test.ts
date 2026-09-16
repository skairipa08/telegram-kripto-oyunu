import { describe, expect, it } from 'vitest';
import {
  calculateCompositeRiskScore,
  evaluateBurstAndReplay,
  evaluateDeviceAndIpClustering,
  evaluateEconomyVelocity,
  evaluateReferralGraphAndAbuse,
  FRAUD_REASON_CODES,
  type RequestHistoryItem,
} from './fraud';

describe('Requirement R1: Rule-Based Fraud & Abuse Engine', () => {
  // ==========================================================================
  // Signal 1: Economy Velocity Evaluation
  // ==========================================================================
  describe('evaluateEconomyVelocity', () => {
    it('approves legitimate production claim within ceiling and tolerance', () => {
      // 100 cash/sec for 60 seconds = 6,000 cash. Max with 5% drift = 6,300 cash. Claim 6,000.
      const signal = evaluateEconomyVelocity({
        claimedCash: 6000,
        currentProductionPerSecond: 100,
        elapsedSeconds: 60,
      });

      expect(signal.score).toBe(0);
      expect(signal.isViolated).toBe(false);
      expect(signal.maxAllowedCash).toBe(6300);
      expect(signal.cashVelocityRatio).toBeLessThanOrEqual(1.0);
      expect(signal.reasonCodes).toHaveLength(0);
      expect(signal.details.claimedCash).toBe(6000);
      expect(signal.details.elapsedSeconds).toBe(60);
    });

    it('enforces offline time caps (clamping effective elapsed seconds)', () => {
      // Elapsed 20,000s, default offline cap is 14,400s (4 hours)
      // Max allowed = 10 * 14,400 * 1.05 = 151,200
      const signal = evaluateEconomyVelocity({
        claimedCash: 151200,
        currentProductionPerSecond: 10,
        elapsedSeconds: 20000,
      });

      expect(signal.maxAllowedCash).toBe(151200);
      expect(signal.score).toBe(0);
      expect(signal.isViolated).toBe(false);
    });

    it('flags slight excess beyond tolerance ceiling (1.0 < ratio <= 1.25)', () => {
      // maxAllowed = 10 * 100 * 1.05 = 1050. Claimed = 1200 (ratio = 1200 / 1050 = 1.1429)
      const signal = evaluateEconomyVelocity({
        claimedCash: 1200,
        currentProductionPerSecond: 10,
        elapsedSeconds: 100,
      });

      expect(signal.score).toBeGreaterThan(0);
      expect(signal.score).toBeLessThanOrEqual(40);
      expect(signal.reasonCodes).toContain(
        FRAUD_REASON_CODES.VELOCITY_CAP_EXCEEDED,
      );
      expect(signal.reasonCodes).toContain(
        FRAUD_REASON_CODES.CASH_VELOCITY_CAP_EXCEEDED,
      );
    });

    it('flags moderate excess (1.25 < ratio <= 2.0) with violation', () => {
      // maxAllowed = 1050. Claimed = 1600 (ratio ~ 1.52)
      const signal = evaluateEconomyVelocity({
        claimedCash: 1600,
        currentProductionPerSecond: 10,
        elapsedSeconds: 100,
      });

      expect(signal.score).toBeGreaterThan(40);
      expect(signal.score).toBeLessThanOrEqual(70);
      expect(signal.isViolated).toBe(true);
      expect(signal.reasonCodes).toContain(
        FRAUD_REASON_CODES.VELOCITY_CAP_EXCEEDED,
      );
    });

    it('flags heavy excess (ratio > 2.0)', () => {
      // maxAllowed = 1050. Claimed = 5000 (ratio ~ 4.76)
      const signal = evaluateEconomyVelocity({
        claimedCash: 5000,
        currentProductionPerSecond: 10,
        elapsedSeconds: 100,
      });

      expect(signal.score).toBeGreaterThanOrEqual(70);
      expect(signal.score).toBeLessThanOrEqual(100);
      expect(signal.isViolated).toBe(true);
    });

    it('scores 100 when claiming cash with zero production rate', () => {
      const signal = evaluateEconomyVelocity({
        claimedCash: 500,
        currentProductionPerSecond: 0,
        elapsedSeconds: 300,
      });

      expect(signal.score).toBe(100);
      expect(signal.isViolated).toBe(true);
      expect(signal.maxAllowedCash).toBe(0);
      expect(signal.cashVelocityRatio).toBe(Infinity);
      expect(signal.reasonCodes).toContain(
        FRAUD_REASON_CODES.VELOCITY_CAP_EXCEEDED,
      );
      expect(signal.reasonCodes).toContain(
        FRAUD_REASON_CODES.CASH_VELOCITY_CAP_EXCEEDED,
      );
    });

    it('returns score 0 when claiming zero cash with zero production', () => {
      const signal = evaluateEconomyVelocity({
        claimedCash: 0,
        currentProductionPerSecond: 0,
        elapsedSeconds: 300,
      });

      expect(signal.score).toBe(0);
      expect(signal.isViolated).toBe(false);
      expect(signal.reasonCodes).toHaveLength(0);
    });

    it('detects negative elapsed time (clock rollback) as immediate critical violation', () => {
      const signal = evaluateEconomyVelocity({
        claimedCash: 100,
        currentProductionPerSecond: 50,
        elapsedSeconds: -15,
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

    it('detects Season Points velocity excess', () => {
      // Default max expected SP = 3000. Claimed = 6000 (ratio = 2.0)
      const signal = evaluateEconomyVelocity({
        claimedCash: 100,
        currentProductionPerSecond: 10,
        elapsedSeconds: 100,
        claimedSeasonPoints: 6000,
      });

      expect(signal.score).toBe(100);
      expect(signal.isViolated).toBe(true);
      expect(signal.seasonPointsVelocityRatio).toBe(2.0);
      expect(signal.reasonCodes).toContain(
        FRAUD_REASON_CODES.SEASON_POINTS_VELOCITY_EXCEEDED,
      );
    });

    it('handles custom tolerance and offline cap parameters', () => {
      const signal = evaluateEconomyVelocity({
        claimedCash: 1200,
        currentProductionPerSecond: 10,
        elapsedSeconds: 100,
        offlineCapSeconds: 200,
        toleranceMultiplier: 1.25, // 25% tolerance -> 10 * 100 * 1.25 = 1250
      });

      expect(signal.maxAllowedCash).toBe(1250);
      expect(signal.score).toBe(0);
      expect(signal.isViolated).toBe(false);
    });

    it('sanitizes NaN and negative inputs safely', () => {
      const signal = evaluateEconomyVelocity({
        claimedCash: NaN,
        currentProductionPerSecond: -5,
        elapsedSeconds: 60,
      });

      expect(signal.score).toBe(0);
      expect(signal.isViolated).toBe(false);
      expect(Number.isFinite(signal.score)).toBe(true);
    });
  });

  // ==========================================================================
  // Signal 2: Burst & Replay Evaluation
  // ==========================================================================
  describe('evaluateBurstAndReplay', () => {
    it('approves legitimate request with empty history', () => {
      const signal = evaluateBurstAndReplay({
        currentRequestId: 'req-100',
        currentTimestampMs: 1000000,
        history: [],
      });

      expect(signal.score).toBe(0);
      expect(signal.isViolated).toBe(false);
      expect(signal.isDuplicate).toBe(false);
      expect(signal.burstCount).toBe(1);
      expect(signal.sustainedCount).toBe(1);
      expect(signal.shortestIntervalMs).toBeNull();
      expect(signal.reasonCodes).toHaveLength(0);
    });

    it('detects duplicate requestId replay with score 100', () => {
      const history: RequestHistoryItem[] = [
        { timestampMs: 995000, requestId: 'req-001' },
        { timestampMs: 998000, requestId: 'req-replay-target' },
      ];

      const signal = evaluateBurstAndReplay({
        currentRequestId: 'req-replay-target',
        currentTimestampMs: 1000000,
        history,
      });

      expect(signal.score).toBe(100);
      expect(signal.isViolated).toBe(true);
      expect(signal.isDuplicate).toBe(true);
      expect(signal.reasonCodes).toContain(
        FRAUD_REASON_CODES.REPLAY_REQUEST_DETECTED,
      );
      expect(signal.details.duplicateRequestId).toBe('req-replay-target');
    });

    it('detects sub-debounce interval (< 200ms) human motor violation', () => {
      const history: RequestHistoryItem[] = [
        { timestampMs: 1000000 - 80, requestId: 'req-prev' }, // 80ms delta
      ];

      const signal = evaluateBurstAndReplay({
        currentRequestId: 'req-curr',
        currentTimestampMs: 1000000,
        history,
      });

      expect(signal.score).toBe(50);
      expect(signal.isViolated).toBe(true);
      expect(signal.shortestIntervalMs).toBe(80);
      expect(signal.reasonCodes).toContain(
        FRAUD_REASON_CODES.SUB_DEBOUNCE_INTERVAL_VIOLATION,
      );
    });

    it('accepts compliant debounce intervals (>= 200ms)', () => {
      const history: RequestHistoryItem[] = [
        { timestampMs: 1000000 - 250, requestId: 'req-prev' }, // 250ms delta
      ];

      const signal = evaluateBurstAndReplay({
        currentRequestId: 'req-curr',
        currentTimestampMs: 1000000,
        history,
      });

      expect(signal.score).toBe(0);
      expect(signal.isViolated).toBe(false);
      expect(signal.reasonCodes).toHaveLength(0);
    });

    it('detects rapid burst (> 15 requests in 5s)', () => {
      const now = 1000000;
      // 17 requests in history within last 4 seconds + current request = 18 total (> 15)
      const history: RequestHistoryItem[] = Array.from(
        { length: 17 },
        (_, i) => ({
          timestampMs: now - 3500 + i * 200,
          requestId: `req-h-${i}`,
        }),
      );

      const signal = evaluateBurstAndReplay({
        currentRequestId: 'req-now',
        currentTimestampMs: now,
        history,
      });

      expect(signal.burstCount).toBe(18);
      expect(signal.isViolated).toBe(true);
      expect(signal.reasonCodes).toContain(
        FRAUD_REASON_CODES.RAPID_BURST_REQUESTS,
      );
      // over = 18 - 15 = 3; score = 40 + 3 * 6 = 58
      expect(signal.score).toBe(58);
    });

    it('detects sustained rate violation (> 60 requests in 60s)', () => {
      const now = 1000000;
      // 65 requests spread evenly over 55s (approx 1 every 840ms, well above debounce)
      const history: RequestHistoryItem[] = Array.from(
        { length: 65 },
        (_, i) => ({
          timestampMs: now - 55000 + i * 840,
          requestId: `req-sustained-${i}`,
        }),
      );

      const signal = evaluateBurstAndReplay({
        currentRequestId: 'req-now',
        currentTimestampMs: now,
        history,
      });

      expect(signal.sustainedCount).toBe(66);
      expect(signal.isViolated).toBe(true);
      expect(signal.reasonCodes).toContain(
        FRAUD_REASON_CODES.SUSTAINED_RATE_EXCEEDED,
      );
      // over = 66 - 60 = 6; score = 50 + 6 * 2 = 62
      expect(signal.score).toBe(62);
    });

    it('ignores requests outside burst and sustained sliding windows', () => {
      const now = 1000000;
      const history: RequestHistoryItem[] = [
        { timestampMs: now - 120000, requestId: 'req-old-1' }, // 120s ago
        { timestampMs: now - 70000, requestId: 'req-old-2' }, // 70s ago
      ];

      const signal = evaluateBurstAndReplay({
        currentRequestId: 'req-curr',
        currentTimestampMs: now,
        history,
      });

      expect(signal.burstCount).toBe(1);
      expect(signal.sustainedCount).toBe(1);
      expect(signal.score).toBe(0);
      expect(signal.isViolated).toBe(false);
    });
  });

  // ==========================================================================
  // Signal 3: Device & IP Clustering
  // ==========================================================================
  describe('evaluateDeviceAndIpClustering', () => {
    it('approves standard organic behavior (1-2 accounts on IP, 1 on device)', () => {
      const signal = evaluateDeviceAndIpClustering({
        userId: 'u1',
        ipAddress: '192.168.1.10',
        deviceFingerprint: 'dev-fp-1',
        accountsOnIp: 1,
        accountsOnDevice: 1,
      });

      expect(signal.score).toBe(0);
      expect(signal.isViolated).toBe(false);
      expect(signal.severity).toBe('low');
      expect(signal.reasonCodes).toHaveLength(0);
    });

    it('evaluates IP warning threshold (4 accounts on IP)', () => {
      const signal = evaluateDeviceAndIpClustering({
        userId: 'u1',
        ipAddress: '192.168.1.10',
        accountsOnIp: 4,
        accountsOnDevice: 0,
      });

      // ipScore = 20 + (4 - 4) * 6 = 20; score = round(20 * 0.85) = 17
      expect(signal.score).toBe(17);
      expect(signal.isViolated).toBe(false);
      expect(signal.severity).toBe('low');
    });

    it('flags IP critical threshold (>= 10 accounts on IP)', () => {
      const signal = evaluateDeviceAndIpClustering({
        userId: 'u1',
        ipAddress: '192.168.1.10',
        accountsOnIp: 10,
        accountsOnDevice: 0,
      });

      // ipScore = 60; combinedScore = round(60 * 0.85) = 51
      expect(signal.score).toBe(51);
      expect(signal.isViolated).toBe(true);
      expect(signal.severity).toBe('medium');
      expect(signal.reasonCodes).toContain(
        FRAUD_REASON_CODES.IP_CLUSTER_DETECTED,
      );
    });

    it('flags device critical clustering (>= 4 accounts on device)', () => {
      const signal = evaluateDeviceAndIpClustering({
        userId: 'u1',
        ipAddress: '192.168.1.10',
        deviceFingerprint: 'emulator-fp-99',
        accountsOnIp: 2,
        accountsOnDevice: 4,
      });

      // devScore = 70 + (4 - 4) * 10 = 70
      expect(signal.score).toBeGreaterThanOrEqual(70);
      expect(signal.isViolated).toBe(true);
      expect(signal.severity).toBe('high');
      expect(signal.reasonCodes).toContain(
        FRAUD_REASON_CODES.DEVICE_CLUSTER_DETECTED,
      );
    });

    it('escalates to critical severity for massive device farm (>= 6 accounts on device)', () => {
      const signal = evaluateDeviceAndIpClustering({
        userId: 'u1',
        ipAddress: '192.168.1.10',
        deviceFingerprint: 'farm-device-1',
        accountsOnIp: 6,
        accountsOnDevice: 6,
      });

      // devScore = 70 + (6 - 4) * 10 = 90
      expect(signal.score).toBeGreaterThanOrEqual(90);
      expect(signal.isViolated).toBe(true);
      expect(signal.severity).toBe('critical');
    });

    it('gracefully handles missing or null device fingerprint', () => {
      const signal = evaluateDeviceAndIpClustering({
        userId: 'u1',
        ipAddress: '192.168.1.10',
        deviceFingerprint: null,
        accountsOnIp: 15,
      });

      expect(signal.details.accountsOnDevice).toBe(0);
      expect(signal.reasonCodes).toContain(
        FRAUD_REASON_CODES.IP_CLUSTER_DETECTED,
      );
      expect(signal.score).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Signal 4: Referral Graph & Sybil Cycle Detection
  // ==========================================================================
  describe('evaluateReferralGraphAndAbuse', () => {
    it('detects direct 1-hop self-referral (invitee === referrer)', () => {
      const signal = evaluateReferralGraphAndAbuse({
        inviteeUserId: 'user_alpha',
        referrerUserId: 'user_alpha',
        referralParents: {},
      });

      expect(signal.score).toBe(100);
      expect(signal.isViolated).toBe(true);
      expect(signal.hasCycle).toBe(true);
      expect(signal.cycleLength).toBe(1);
      expect(signal.cyclePath).toEqual(['user_alpha', 'user_alpha']);
      expect(signal.reasonCodes).toContain(
        FRAUD_REASON_CODES.SELF_REFERRAL_DETECTED,
      );
      expect(signal.reasonCodes).toContain(
        FRAUD_REASON_CODES.CIRCULAR_REFERRAL_SUSPECT,
      );
    });

    it('detects 1-hop self-referral with whitespace trimming', () => {
      const signal = evaluateReferralGraphAndAbuse({
        inviteeUserId: '  user_alpha  ',
        referrerUserId: 'user_alpha',
        referralParents: {},
      });

      expect(signal.score).toBe(100);
      expect(signal.hasCycle).toBe(true);
      expect(signal.cycleLength).toBe(1);
    });

    it('detects 2-hop reciprocal referral loop (A -> B -> A)', () => {
      // userA referred userB. Now userB tries to refer userA (invitee: userA, referrer: userB).
      // referralParents maps userB -> userA
      const parents: Record<string, string> = {
        userB: 'userA',
      };

      const signal = evaluateReferralGraphAndAbuse({
        inviteeUserId: 'userA',
        referrerUserId: 'userB',
        referralParents: parents,
      });

      expect(signal.score).toBe(100);
      expect(signal.isViolated).toBe(true);
      expect(signal.hasCycle).toBe(true);
      expect(signal.cycleLength).toBe(2);
      expect(signal.cyclePath).toEqual(['userB', 'userA']);
      expect(signal.reasonCodes).toContain(
        FRAUD_REASON_CODES.RECIPROCAL_REFERRAL_SUSPECT,
      );
    });

    it('detects 3-hop circular referral ring (A -> B -> C -> A)', () => {
      // Chain: userA referred userB, userB referred userC.
      // Now userA tries to bind userC as referrer (invitee: userA, referrer: userC).
      const parents: Record<string, string> = {
        userC: 'userB',
        userB: 'userA',
      };

      const signal = evaluateReferralGraphAndAbuse({
        inviteeUserId: 'userA',
        referrerUserId: 'userC',
        referralParents: parents,
      });

      expect(signal.score).toBe(100);
      expect(signal.isViolated).toBe(true);
      expect(signal.hasCycle).toBe(true);
      expect(signal.cycleLength).toBe(3);
      expect(signal.cyclePath).toEqual(['userC', 'userB', 'userA']);
      expect(signal.reasonCodes).toContain(
        FRAUD_REASON_CODES.CIRCULAR_REFERRAL_SUSPECT,
      );
    });

    it('detects 5-hop circular referral ring (A -> B -> C -> D -> E -> A)', () => {
      const parents: Record<string, string> = {
        userE: 'userD',
        userD: 'userC',
        userC: 'userB',
        userB: 'userA',
      };

      const signal = evaluateReferralGraphAndAbuse({
        inviteeUserId: 'userA',
        referrerUserId: 'userE',
        referralParents: parents,
      });

      expect(signal.score).toBe(100);
      expect(signal.hasCycle).toBe(true);
      expect(signal.cycleLength).toBe(5);
      expect(signal.cyclePath).toEqual([
        'userE',
        'userD',
        'userC',
        'userB',
        'userA',
      ]);
      expect(signal.reasonCodes).toContain(
        FRAUD_REASON_CODES.CIRCULAR_REFERRAL_SUSPECT,
      );
    });

    it('approves legitimate acyclic tree binding with Map lookup', () => {
      const parentsMap = new Map<string, string>([
        ['userC', 'userB'],
        ['userB', 'userA'],
        ['userA', 'rootFounder'],
      ]);

      // New userX wants to bind userC as referrer
      const signal = evaluateReferralGraphAndAbuse({
        inviteeUserId: 'userX',
        referrerUserId: 'userC',
        referralParents: parentsMap,
      });

      expect(signal.score).toBe(0);
      expect(signal.isViolated).toBe(false);
      expect(signal.hasCycle).toBe(false);
      expect(signal.cycleLength).toBe(0);
      expect(signal.cyclePath).toEqual([]);
      expect(signal.reasonCodes).toHaveLength(0);
    });

    it('terminates safely when parent graph contains pre-existing disconnected cycles', () => {
      // Pre-existing broken cycle: X -> Y -> X
      const parents: Record<string, string> = {
        nodeX: 'nodeY',
        nodeY: 'nodeX',
      };

      // Node Z tries to bind nodeX as referrer
      const signal = evaluateReferralGraphAndAbuse({
        inviteeUserId: 'nodeZ',
        referrerUserId: 'nodeX',
        referralParents: parents,
      });

      // Z is not part of X -> Y -> X, so no cycle for Z
      expect(signal.hasCycle).toBe(false);
      expect(signal.score).toBe(0);
    });

    it('detects referral hardware device collusion', () => {
      const signal = evaluateReferralGraphAndAbuse({
        inviteeUserId: 'invitee_1',
        referrerUserId: 'referrer_1',
        inviteeDeviceFingerprint: 'shared-hardware-id-1234',
        referrerDeviceFingerprint: 'shared-hardware-id-1234',
        referralParents: {},
      });

      expect(signal.score).toBe(90);
      expect(signal.isViolated).toBe(true);
      expect(signal.isCollusion).toBe(true);
      expect(signal.reasonCodes).toContain(
        FRAUD_REASON_CODES.REFERRAL_DEVICE_COLLUSION,
      );
    });

    it('detects referral IP collusion within 10-minute creation window', () => {
      const now = 1000000;
      const signal = evaluateReferralGraphAndAbuse({
        inviteeUserId: 'invitee_1',
        referrerUserId: 'referrer_1',
        inviteeIp: '203.0.113.42',
        referrerIp: '203.0.113.42',
        inviteeCreatedAtMs: now - 2 * 60 * 1000, // 2 minutes ago (< 10 min)
        currentTimestampMs: now,
        referralParents: {},
      });

      expect(signal.score).toBe(65);
      expect(signal.isViolated).toBe(true);
      expect(signal.isCollusion).toBe(true);
      expect(signal.reasonCodes).toContain(
        FRAUD_REASON_CODES.REFERRAL_IP_COLLUSION,
      );
    });

    it('does not flag IP collusion if account creation was beyond 10 minutes', () => {
      const now = 1000000;
      const signal = evaluateReferralGraphAndAbuse({
        inviteeUserId: 'invitee_1',
        referrerUserId: 'referrer_1',
        inviteeIp: '203.0.113.42',
        referrerIp: '203.0.113.42',
        inviteeCreatedAtMs: now - 15 * 60 * 1000, // 15 minutes ago (> 10 min)
        currentTimestampMs: now,
        referralParents: {},
      });

      expect(signal.score).toBe(0);
      expect(signal.isCollusion).toBe(false);
      expect(signal.reasonCodes).not.toContain(
        FRAUD_REASON_CODES.REFERRAL_IP_COLLUSION,
      );
    });

    it('detects referral burst farming (> 10 binds to referrer in window)', () => {
      const signal = evaluateReferralGraphAndAbuse({
        inviteeUserId: 'invitee_1',
        referrerUserId: 'popular_referrer',
        recentBindsToReferrerInWindow: 14,
        maxRecentBindsThreshold: 10,
        referralParents: {},
      });

      // over = 14 - 10 = 4; score = 50 + 4 * 5 = 70
      expect(signal.score).toBe(70);
      expect(signal.isViolated).toBe(true);
      expect(signal.reasonCodes).toContain(
        FRAUD_REASON_CODES.REFERRAL_BURST_FARMING,
      );
    });
  });

  // ==========================================================================
  // Composite Risk Scoring Engine & Floor Overrides
  // ==========================================================================
  describe('calculateCompositeRiskScore', () => {
    it('returns score 0, LOW tier, and allow recommendation when all signals clean', () => {
      const result = calculateCompositeRiskScore({
        velocity: {
          claimedCash: 100,
          currentProductionPerSecond: 10,
          elapsedSeconds: 20,
        },
        burst: {
          currentRequestId: 'req-1',
          currentTimestampMs: 1000000,
          history: [],
        },
        clustering: {
          userId: 'u1',
          ipAddress: '10.0.0.1',
          accountsOnIp: 1,
          accountsOnDevice: 1,
        },
        referral: {
          inviteeUserId: 'uA',
          referrerUserId: 'uB',
          referralParents: {},
        },
      });

      expect(result.score).toBe(0);
      expect(result.tier).toBe('LOW');
      expect(result.recommendation).toBe('allow');
      expect(result.isActionBlocked).toBe(false);
      expect(result.isRewardFrozen).toBe(false);
      expect(result.primaryReasons).toHaveLength(0);
      expect(result.explainableDetails).toHaveLength(0);
      expect(result.evaluatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('computes weighted composite score when signals are moderate', () => {
      // Velocity: score 40
      // Burst: score 0
      // Clustering: score 30
      // Referral: score 0
      // Weighted = 0.35 * 40 + 0.20 * 0 + 0.20 * 30 + 0.25 * 0 = 14 + 6 = 20 (LOW)
      const result = calculateCompositeRiskScore({
        precomputedSignals: {
          velocity: {
            score: 40,
            isViolated: true,
            cashVelocityRatio: 1.25,
            seasonPointsVelocityRatio: 0,
            maxAllowedCash: 1000,
            reasonCodes: [FRAUD_REASON_CODES.VELOCITY_CAP_EXCEEDED],
            details: {
              claimedCash: 1250,
              maxAllowedCash: 1000,
              claimedSeasonPoints: 0,
              maxAllowedSeasonPoints: 3000,
              elapsedSeconds: 100,
            },
          },
          clustering: {
            score: 30,
            isViolated: false,
            severity: 'medium',
            reasonCodes: [],
            details: {
              accountsOnIp: 2,
              accountsOnDevice: 2,
              ipThresholdCritical: 10,
              deviceThresholdCritical: 4,
            },
          },
        },
      });

      expect(result.score).toBe(20);
      expect(result.tier).toBe('LOW');
      expect(result.recommendation).toBe('allow');
      expect(result.isActionBlocked).toBe(false);
      expect(result.isRewardFrozen).toBe(false);
    });

    it('enforces CRITICAL floor override (100) on request replay', () => {
      // Even if velocity, clustering, and referral are clean (0), replay MUST force score to 100
      const result = calculateCompositeRiskScore({
        burst: {
          currentRequestId: 'duplicate-nonce',
          currentTimestampMs: 1000000,
          history: [{ timestampMs: 990000, requestId: 'duplicate-nonce' }],
        },
      });

      expect(result.score).toBe(100);
      expect(result.tier).toBe('CRITICAL');
      expect(result.recommendation).toBe('reject');
      expect(result.isActionBlocked).toBe(true);
      expect(result.isRewardFrozen).toBe(true);
      expect(result.primaryReasons).toContain(
        FRAUD_REASON_CODES.REPLAY_REQUEST_DETECTED,
      );

      const replayExplain = result.explainableDetails.find(
        (e) => e.code === FRAUD_REASON_CODES.REPLAY_REQUEST_DETECTED,
      );
      expect(replayExplain).toBeDefined();
      expect(replayExplain?.severity).toBe('critical');
      expect(replayExplain?.scoreContribution).toBe(100);
    });

    it('enforces CRITICAL floor override (100) on referral graph cycle', () => {
      const result = calculateCompositeRiskScore({
        referral: {
          inviteeUserId: 'uA',
          referrerUserId: 'uB',
          referralParents: { uB: 'uA' },
        },
      });

      expect(result.score).toBe(100);
      expect(result.tier).toBe('CRITICAL');
      expect(result.recommendation).toBe('reject');
      expect(result.isActionBlocked).toBe(true);
      expect(result.isRewardFrozen).toBe(true);
      expect(result.primaryReasons).toContain(
        FRAUD_REASON_CODES.RECIPROCAL_REFERRAL_SUSPECT,
      );
    });

    it('enforces CRITICAL floor override (100) on direct self-referral', () => {
      const result = calculateCompositeRiskScore({
        referral: {
          inviteeUserId: 'uSame',
          referrerUserId: 'uSame',
          referralParents: {},
        },
      });

      expect(result.score).toBe(100);
      expect(result.tier).toBe('CRITICAL');
      expect(result.recommendation).toBe('reject');
      expect(result.isActionBlocked).toBe(true);
    });

    it('enforces CRITICAL floor override (95) on velocity score >= 95', () => {
      // Negative elapsed time produces velocity score 95
      const result = calculateCompositeRiskScore({
        velocity: {
          claimedCash: 100,
          currentProductionPerSecond: 10,
          elapsedSeconds: -10,
        },
      });

      expect(result.score).toBe(95);
      expect(result.tier).toBe('CRITICAL');
      expect(result.recommendation).toBe('reject');
      expect(result.isActionBlocked).toBe(true);
      expect(result.isRewardFrozen).toBe(true);
    });

    it('enforces CRITICAL floor override (90) on referral device collusion', () => {
      const result = calculateCompositeRiskScore({
        referral: {
          inviteeUserId: 'invitee_x',
          referrerUserId: 'referrer_y',
          inviteeDeviceFingerprint: 'identical-hardware-uuid',
          referrerDeviceFingerprint: 'identical-hardware-uuid',
          referralParents: {},
        },
      });

      expect(result.score).toBe(90);
      expect(result.tier).toBe('CRITICAL');
      expect(result.recommendation).toBe('reject');
      expect(result.isActionBlocked).toBe(true);
      expect(result.isRewardFrozen).toBe(true);
      expect(result.primaryReasons).toContain(
        FRAUD_REASON_CODES.REFERRAL_DEVICE_COLLUSION,
      );
    });

    it('enforces HIGH floor override (85) when clustering is critical', () => {
      const result = calculateCompositeRiskScore({
        clustering: {
          userId: 'u1',
          ipAddress: '10.0.0.1',
          deviceFingerprint: 'emulator-farm-1',
          accountsOnIp: 5,
          accountsOnDevice: 6, // devCount >= 6 -> severity 'critical'
        },
      });

      expect(result.score).toBeGreaterThanOrEqual(85);
      expect(result.isRewardFrozen).toBe(true);
      expect(result.recommendation).toMatch(/freeze|reject/);
    });

    it('categorizes risk tiers and recommendations across full 0-100 spectrum', () => {
      // 0..29 -> LOW / allow
      const lowResult = calculateCompositeRiskScore({
        precomputedSignals: {
          velocity: {
            score: 25,
            isViolated: false,
            cashVelocityRatio: 1.1,
            seasonPointsVelocityRatio: 0,
            maxAllowedCash: 100,
            reasonCodes: [],
            details: {
              claimedCash: 110,
              maxAllowedCash: 100,
              claimedSeasonPoints: 0,
              maxAllowedSeasonPoints: 3000,
              elapsedSeconds: 10,
            },
          },
        },
      });
      // 0.35 * 25 = 8.75 -> round to 9
      expect(lowResult.tier).toBe('LOW');
      expect(lowResult.recommendation).toBe('allow');
      expect(lowResult.isRewardFrozen).toBe(false);
      expect(lowResult.isActionBlocked).toBe(false);

      // 30..69 -> MEDIUM / monitor
      const medResult = calculateCompositeRiskScore({
        precomputedSignals: {
          clustering: {
            score: 80,
            isViolated: true,
            severity: 'high',
            reasonCodes: [FRAUD_REASON_CODES.DEVICE_CLUSTER_DETECTED],
            details: {
              accountsOnIp: 5,
              accountsOnDevice: 4,
              ipThresholdCritical: 10,
              deviceThresholdCritical: 4,
            },
          },
          burst: {
            score: 70,
            isViolated: true,
            isDuplicate: false,
            burstCount: 20,
            sustainedCount: 20,
            shortestIntervalMs: 250,
            reasonCodes: [FRAUD_REASON_CODES.RAPID_BURST_REQUESTS],
            details: {
              burstWindowMs: 5000,
              burstCount: 20,
              maxBurstRequests: 15,
              sustainedCount: 20,
            },
          },
        },
      });
      // 0.20 * 80 + 0.20 * 70 = 16 + 14 = 30
      expect(medResult.score).toBe(30);
      expect(medResult.tier).toBe('MEDIUM');
      expect(medResult.recommendation).toBe('monitor');
      expect(medResult.isRewardFrozen).toBe(false);
      expect(medResult.isActionBlocked).toBe(false);

      // 70..89 -> HIGH / freeze
      const highResult = calculateCompositeRiskScore({
        precomputedSignals: {
          velocity: {
            score: 80,
            isViolated: true,
            cashVelocityRatio: 2.5,
            seasonPointsVelocityRatio: 0,
            maxAllowedCash: 1000,
            reasonCodes: [FRAUD_REASON_CODES.VELOCITY_CAP_EXCEEDED],
            details: {
              claimedCash: 2500,
              maxAllowedCash: 1000,
              claimedSeasonPoints: 0,
              maxAllowedSeasonPoints: 3000,
              elapsedSeconds: 100,
            },
          },
          burst: {
            score: 80,
            isViolated: true,
            isDuplicate: false,
            burstCount: 20,
            sustainedCount: 20,
            shortestIntervalMs: 250,
            reasonCodes: [FRAUD_REASON_CODES.RAPID_BURST_REQUESTS],
            details: {
              burstWindowMs: 5000,
              burstCount: 20,
              maxBurstRequests: 15,
              sustainedCount: 20,
            },
          },
          clustering: {
            score: 80,
            isViolated: true,
            severity: 'high',
            reasonCodes: [FRAUD_REASON_CODES.DEVICE_CLUSTER_DETECTED],
            details: {
              accountsOnIp: 5,
              accountsOnDevice: 4,
              ipThresholdCritical: 10,
              deviceThresholdCritical: 4,
            },
          },
          referral: {
            score: 60,
            isViolated: true,
            hasCycle: false,
            cycleLength: 0,
            cyclePath: [],
            isCollusion: false,
            reasonCodes: [FRAUD_REASON_CODES.REFERRAL_BURST_FARMING],
            details: {
              cycleDetected: false,
              isDeviceCollusion: false,
              isIpCollusion: false,
              recentBindsCount: 12,
            },
          },
        },
      });
      // 0.35 * 80 (28) + 0.20 * 80 (16) + 0.20 * 80 (16) + 0.25 * 60 (15) = 75
      expect(highResult.score).toBe(75);
      expect(highResult.tier).toBe('HIGH');
      expect(highResult.recommendation).toBe('freeze');
      expect(highResult.isRewardFrozen).toBe(true);
      expect(highResult.isActionBlocked).toBe(false);
    });

    it('generates rich explainability details for every identified violation reason', () => {
      const result = calculateCompositeRiskScore({
        velocity: {
          claimedCash: 5000,
          currentProductionPerSecond: 10,
          elapsedSeconds: 100,
        },
        burst: {
          currentRequestId: 'burst-req',
          currentTimestampMs: 1000000,
          history: [
            { timestampMs: 1000000 - 50, requestId: 'prev-req' }, // 50ms interval (< 200ms)
          ],
        },
      });

      expect(result.explainableDetails.length).toBeGreaterThanOrEqual(2);
      for (const item of result.explainableDetails) {
        expect(item.code).toBeDefined();
        expect(['low', 'medium', 'high', 'critical']).toContain(item.severity);
        expect(typeof item.scoreContribution).toBe('number');
        expect(item.description.length).toBeGreaterThan(10);
      }
    });
  });
});
