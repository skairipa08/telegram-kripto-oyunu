/**
 * Pure deterministic rule-based fraud & abuse detection engine for Project Empire.
 * Side-effect free, independent of network, database, or UI.
 *
 * Implements Requirement R1:
 * - Economy velocity evaluation
 * - Burst & replay attack detection
 * - Device & IP clustering analysis
 * - Referral graph cycle & Sybil abuse detection
 * - Composite risk scoring with critical floor overrides & explainable reasons
 */

// ============================================================================
// 1. Standardized Reason Codes
// ============================================================================

export const FRAUD_REASON_CODES = {
  // Velocity
  VELOCITY_CAP_EXCEEDED: 'VELOCITY_CAP_EXCEEDED',
  CASH_VELOCITY_CAP_EXCEEDED: 'CASH_VELOCITY_CAP_EXCEEDED',
  SEASON_POINTS_VELOCITY_EXCEEDED: 'SEASON_POINTS_VELOCITY_EXCEEDED',
  NEGATIVE_ELAPSED_TIME: 'NEGATIVE_ELAPSED_TIME',

  // Burst & Replay
  RAPID_BURST_REQUESTS: 'RAPID_BURST_REQUESTS',
  REPLAY_REQUEST_DETECTED: 'REPLAY_REQUEST_DETECTED',
  SUB_DEBOUNCE_INTERVAL_VIOLATION: 'SUB_DEBOUNCE_INTERVAL_VIOLATION',
  SUSTAINED_RATE_EXCEEDED: 'SUSTAINED_RATE_EXCEEDED',

  // Clustering
  DEVICE_CLUSTER_DETECTED: 'DEVICE_CLUSTER_DETECTED',
  IP_CLUSTER_DETECTED: 'IP_CLUSTER_DETECTED',
  HIGH_DENSITY_SUBNET_ANOMALY: 'HIGH_DENSITY_SUBNET_ANOMALY',

  // Referral Abuse
  CIRCULAR_REFERRAL_SUSPECT: 'CIRCULAR_REFERRAL_SUSPECT',
  RECIPROCAL_REFERRAL_SUSPECT: 'RECIPROCAL_REFERRAL_SUSPECT',
  SELF_REFERRAL_DETECTED: 'SELF_REFERRAL_DETECTED',
  REFERRAL_DEVICE_COLLUSION: 'REFERRAL_DEVICE_COLLUSION',
  REFERRAL_IP_COLLUSION: 'REFERRAL_IP_COLLUSION',
  REFERRAL_BURST_FARMING: 'REFERRAL_BURST_FARMING',
} as const;

export type FraudReasonCode =
  (typeof FRAUD_REASON_CODES)[keyof typeof FRAUD_REASON_CODES];

// ============================================================================
// 2. Data Types & Interfaces
// ============================================================================

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RiskRecommendation = 'allow' | 'monitor' | 'freeze' | 'reject';
export type RiskTier = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// --- Signal 1: Economy Velocity ---
export interface EconomyVelocityInput {
  claimedCash: number;
  currentProductionPerSecond: number;
  elapsedSeconds: number;
  offlineCapSeconds?: number | undefined;
  toleranceMultiplier?: number | undefined; // default 1.05 (5% drift)
  claimedSeasonPoints?: number | undefined;
  maxExpectedSeasonPoints?: number | undefined; // default 3000
}

export interface EconomyVelocitySignal {
  score: number; // 0..100
  isViolated: boolean;
  cashVelocityRatio: number;
  seasonPointsVelocityRatio: number;
  maxAllowedCash: number;
  reasonCodes: FraudReasonCode[];
  details: {
    claimedCash: number;
    maxAllowedCash: number;
    claimedSeasonPoints: number;
    maxAllowedSeasonPoints: number;
    elapsedSeconds: number;
  };
}

// --- Signal 2: Burst & Replay ---
export interface RequestHistoryItem {
  timestampMs: number;
  requestId?: string | undefined;
  actionType?: string | undefined;
}

export interface BurstReplayInput {
  currentRequestId: string;
  currentTimestampMs: number;
  currentActionType?: string | undefined;
  history: readonly RequestHistoryItem[];
  minDebounceIntervalMs?: number | undefined; // default 200ms
  burstWindowMs?: number | undefined; // default 5000ms (5s)
  maxBurstRequests?: number | undefined; // default 15
  sustainedWindowMs?: number | undefined; // default 60000ms (60s)
  maxSustainedRequests?: number | undefined; // default 60
}

export interface BurstReplaySignal {
  score: number; // 0..100
  isViolated: boolean;
  isDuplicate: boolean;
  burstCount: number;
  sustainedCount: number;
  shortestIntervalMs: number | null;
  reasonCodes: FraudReasonCode[];
  details: {
    burstWindowMs: number;
    burstCount: number;
    maxBurstRequests: number;
    sustainedCount: number;
    duplicateRequestId?: string | undefined;
  };
}

// --- Signal 3: Device & IP Clustering ---
export interface DeviceIpClusteringInput {
  userId: string;
  ipAddress: string;
  deviceFingerprint?: string | null | undefined;
  accountsOnIp: number;
  accountsOnDevice?: number | undefined;
  ipThresholdWarn?: number | undefined; // default 4
  ipThresholdCritical?: number | undefined; // default 10
  deviceThresholdWarn?: number | undefined; // default 2
  deviceThresholdCritical?: number | undefined; // default 4
}

export interface DeviceIpClusteringSignal {
  score: number; // 0..100
  isViolated: boolean;
  severity: RiskSeverity;
  reasonCodes: FraudReasonCode[];
  details: {
    accountsOnIp: number;
    accountsOnDevice: number;
    ipThresholdCritical: number;
    deviceThresholdCritical: number;
  };
}

// --- Signal 4: Referral Graph & Abuse ---
export interface ReferralBindingInput {
  inviteeUserId: string;
  referrerUserId: string;
  inviteeDeviceFingerprint?: string | null | undefined;
  referrerDeviceFingerprint?: string | null | undefined;
  inviteeIp?: string | null | undefined;
  referrerIp?: string | null | undefined;
  inviteeCreatedAtMs?: number | undefined;
  currentTimestampMs?: number | undefined;
  referralParents: ReadonlyMap<string, string> | Record<string, string>;
  recentBindsToReferrerInWindow?: number | undefined;
  maxRecentBindsThreshold?: number | undefined; // default 10
}

export interface ReferralGraphSignal {
  score: number; // 0..100
  isViolated: boolean;
  hasCycle: boolean;
  cycleLength: number;
  cyclePath: string[];
  isCollusion: boolean;
  reasonCodes: FraudReasonCode[];
  details: {
    cycleDetected: boolean;
    cyclePath?: string[] | undefined;
    isDeviceCollusion: boolean;
    isIpCollusion: boolean;
    recentBindsCount: number;
  };
}

// --- Composite Risk Scoring ---
export interface ExplainableReasonItem {
  code: FraudReasonCode;
  severity: RiskSeverity;
  scoreContribution: number;
  description: string;
}

export interface CompositeRiskScoreInput {
  velocity?: EconomyVelocityInput | undefined;
  burst?: BurstReplayInput | undefined;
  clustering?: DeviceIpClusteringInput | undefined;
  referral?: ReferralBindingInput | undefined;
  precomputedSignals?:
    | {
        velocity?: EconomyVelocitySignal | undefined;
        burst?: BurstReplaySignal | undefined;
        clustering?: DeviceIpClusteringSignal | undefined;
        referral?: ReferralGraphSignal | undefined;
      }
    | undefined;
}

export interface CompositeRiskScoreResult {
  score: number; // 0..100 normalized
  tier: RiskTier;
  recommendation: RiskRecommendation;
  isActionBlocked: boolean; // score >= 90
  isRewardFrozen: boolean; // score >= 70
  primaryReasons: FraudReasonCode[];
  explainableDetails: ExplainableReasonItem[];
  signalScores: {
    velocity: number;
    burst: number;
    clustering: number;
    referral: number;
  };
  signals: {
    velocity?: EconomyVelocitySignal | undefined;
    burst?: BurstReplaySignal | undefined;
    clustering?: DeviceIpClusteringSignal | undefined;
    referral?: ReferralGraphSignal | undefined;
  };
  evaluatedAt: string; // ISO 8601
}

// ============================================================================
// 3. Core Signal 1: Economy Velocity
// ============================================================================

/**
 * Evaluates claimed cash and season points against physical production ceilings and offline caps.
 * Detects negative elapsed time (clock manipulation) and rate anomalies.
 */
export function evaluateEconomyVelocity(
  input: EconomyVelocityInput,
): EconomyVelocitySignal {
  const elapsed = Number.isFinite(input.elapsedSeconds)
    ? Math.floor(input.elapsedSeconds)
    : 0;

  const claimedCash = Number.isFinite(input.claimedCash)
    ? Math.max(0, input.claimedCash)
    : 0;

  const prodRate = Number.isFinite(input.currentProductionPerSecond)
    ? Math.max(0, input.currentProductionPerSecond)
    : 0;

  const maxSP = Number.isFinite(input.maxExpectedSeasonPoints ?? 3000)
    ? Math.max(0, input.maxExpectedSeasonPoints ?? 3000)
    : 3000;

  const claimedSP = Number.isFinite(input.claimedSeasonPoints ?? 0)
    ? Math.max(0, input.claimedSeasonPoints ?? 0)
    : 0;

  // Clock rollback manipulation check
  if (elapsed < 0) {
    return {
      score: 95,
      isViolated: true,
      cashVelocityRatio: Infinity,
      seasonPointsVelocityRatio: 0,
      maxAllowedCash: 0,
      reasonCodes: [
        FRAUD_REASON_CODES.NEGATIVE_ELAPSED_TIME,
        FRAUD_REASON_CODES.VELOCITY_CAP_EXCEEDED,
      ],
      details: {
        claimedCash,
        maxAllowedCash: 0,
        claimedSeasonPoints: claimedSP,
        maxAllowedSeasonPoints: 0,
        elapsedSeconds: elapsed,
      },
    };
  }

  const capSec = input.offlineCapSeconds ?? 14400;
  const tolerance = input.toleranceMultiplier ?? 1.05;
  const effectiveSeconds = Math.min(elapsed, capSec);
  const maxAllowedCash = Math.floor(prodRate * effectiveSeconds * tolerance);

  let cashScore = 0;
  const cashRatio =
    maxAllowedCash > 0
      ? claimedCash / maxAllowedCash
      : claimedCash > 0
        ? Infinity
        : 1.0;

  const reasons: FraudReasonCode[] = [];

  if (prodRate === 0 && claimedCash > 0) {
    cashScore = 100;
    reasons.push(
      FRAUD_REASON_CODES.VELOCITY_CAP_EXCEEDED,
      FRAUD_REASON_CODES.CASH_VELOCITY_CAP_EXCEEDED,
    );
  } else if (cashRatio > 1.0) {
    if (cashRatio <= 1.25) {
      cashScore = Math.min(40, Math.round((cashRatio - 1.0) * 160));
    } else if (cashRatio <= 2.0) {
      cashScore = 40 + Math.round((cashRatio - 1.25) * 40);
    } else {
      cashScore = Math.min(100, Math.round(70 + cashRatio * 5));
    }
    reasons.push(
      FRAUD_REASON_CODES.VELOCITY_CAP_EXCEEDED,
      FRAUD_REASON_CODES.CASH_VELOCITY_CAP_EXCEEDED,
    );
  }

  let spScore = 0;
  const spRatio =
    maxSP > 0 ? claimedSP / maxSP : claimedSP > 0 ? Infinity : 1.0;

  if (spRatio > 1.0) {
    spScore = Math.min(100, Math.round(50 + (spRatio - 1.0) * 50));
    reasons.push(FRAUD_REASON_CODES.SEASON_POINTS_VELOCITY_EXCEEDED);
  }

  const finalScore = Math.min(100, Math.max(cashScore, spScore));

  return {
    score: finalScore,
    isViolated: finalScore >= 40,
    cashVelocityRatio: Number.isFinite(cashRatio)
      ? Number(cashRatio.toFixed(4))
      : Infinity,
    seasonPointsVelocityRatio: Number.isFinite(spRatio)
      ? Number(spRatio.toFixed(4))
      : Infinity,
    maxAllowedCash,
    reasonCodes: reasons,
    details: {
      claimedCash,
      maxAllowedCash,
      claimedSeasonPoints: claimedSP,
      maxAllowedSeasonPoints: maxSP,
      elapsedSeconds: elapsed,
    },
  };
}

// ============================================================================
// 4. Core Signal 2: Burst & Replay
// ============================================================================

/**
 * Evaluates request history for nonce replays, sub-human debounce timing, and high-frequency bursts.
 */
export function evaluateBurstAndReplay(
  input: BurstReplayInput,
): BurstReplaySignal {
  const minDebounce = input.minDebounceIntervalMs ?? 200;
  const burstWin = input.burstWindowMs ?? 5000;
  const maxBurst = input.maxBurstRequests ?? 15;
  const sustainedWin = input.sustainedWindowMs ?? 60000;
  const maxSustained = input.maxSustainedRequests ?? 60;

  // 1. Replay Check (Exact duplicate requestId match in history)
  const isDuplicate = input.history.some(
    (h) =>
      typeof h.requestId === 'string' && h.requestId === input.currentRequestId,
  );

  if (isDuplicate) {
    return {
      score: 100,
      isViolated: true,
      isDuplicate: true,
      burstCount: 1,
      sustainedCount: 1,
      shortestIntervalMs: 0,
      reasonCodes: [FRAUD_REASON_CODES.REPLAY_REQUEST_DETECTED],
      details: {
        burstWindowMs: burstWin,
        burstCount: 1,
        maxBurstRequests: maxBurst,
        sustainedCount: 1,
        duplicateRequestId: input.currentRequestId,
      },
    };
  }

  // 2. Sliding window counts and shortest interval
  let burstCount = 1;
  let sustainedCount = 1;
  let shortestIntervalMs: number | null = null;
  const reasons: FraudReasonCode[] = [];

  for (const item of input.history) {
    const delta = input.currentTimestampMs - item.timestampMs;
    if (delta >= 0 && delta <= burstWin) {
      burstCount++;
    }
    if (delta >= 0 && delta <= sustainedWin) {
      sustainedCount++;
    }
    if (delta >= 0) {
      if (shortestIntervalMs === null || delta < shortestIntervalMs) {
        shortestIntervalMs = delta;
      }
    }
  }

  let burstScore = 0;

  // Sub-debounce check (< 200ms)
  if (shortestIntervalMs !== null && shortestIntervalMs < minDebounce) {
    burstScore = Math.max(burstScore, 50);
    reasons.push(FRAUD_REASON_CODES.SUB_DEBOUNCE_INTERVAL_VIOLATION);
  }

  // Rapid burst ceiling (> 15 requests / 5s)
  if (burstCount > maxBurst) {
    const over = burstCount - maxBurst;
    burstScore = Math.max(burstScore, Math.min(100, 40 + over * 6));
    reasons.push(FRAUD_REASON_CODES.RAPID_BURST_REQUESTS);
  }

  // Sustained rate ceiling (> 60 requests / 60s)
  if (sustainedCount > maxSustained) {
    const over = sustainedCount - maxSustained;
    burstScore = Math.max(burstScore, Math.min(100, 50 + over * 2));
    reasons.push(FRAUD_REASON_CODES.SUSTAINED_RATE_EXCEEDED);
  }

  return {
    score: burstScore,
    isViolated: burstScore >= 40,
    isDuplicate: false,
    burstCount,
    sustainedCount,
    shortestIntervalMs,
    reasonCodes: reasons,
    details: {
      burstWindowMs: burstWin,
      burstCount,
      maxBurstRequests: maxBurst,
      sustainedCount,
    },
  };
}

// ============================================================================
// 5. Core Signal 3: Device & IP Clustering
// ============================================================================

/**
 * Detects multi-account density anomalies across hardware device fingerprints and IP addresses.
 */
export function evaluateDeviceAndIpClustering(
  input: DeviceIpClusteringInput,
): DeviceIpClusteringSignal {
  const ipWarn = input.ipThresholdWarn ?? 4;
  const ipCrit = input.ipThresholdCritical ?? 10;
  const devWarn = input.deviceThresholdWarn ?? 2;
  const devCrit = input.deviceThresholdCritical ?? 4;

  const devCount = input.accountsOnDevice ?? 0;
  const ipCount = input.accountsOnIp;

  let devScore = 0;
  const reasons: FraudReasonCode[] = [];

  if (devCount >= devCrit) {
    devScore = Math.min(100, 70 + (devCount - devCrit) * 10);
    reasons.push(FRAUD_REASON_CODES.DEVICE_CLUSTER_DETECTED);
  } else if (devCount >= devWarn) {
    devScore = 30 + (devCount - devWarn) * 15;
  }

  let ipScore = 0;
  if (ipCount >= ipCrit) {
    ipScore = Math.min(100, 60 + (ipCount - ipCrit) * 4);
    reasons.push(FRAUD_REASON_CODES.IP_CLUSTER_DETECTED);
  } else if (ipCount >= ipWarn) {
    ipScore = 20 + (ipCount - ipWarn) * 6;
  }

  const combinedScore = Math.min(
    100,
    Math.max(
      devScore,
      Math.round(ipScore * 0.85),
      Math.min(100, devScore + Math.round(ipScore * 0.4)),
    ),
  );

  let severity: RiskSeverity = 'low';
  if (combinedScore >= 90) {
    severity = 'critical';
  } else if (combinedScore >= 70) {
    severity = 'high';
  } else if (combinedScore >= 35) {
    severity = 'medium';
  }

  return {
    score: combinedScore,
    isViolated: combinedScore >= 40,
    severity,
    reasonCodes: reasons,
    details: {
      accountsOnIp: ipCount,
      accountsOnDevice: devCount,
      ipThresholdCritical: ipCrit,
      deviceThresholdCritical: devCrit,
    },
  };
}

// ============================================================================
// 6. Core Signal 4: Referral Graph & Sybil Cycle Detection
// ============================================================================

/**
 * Traces parent-chain graph for cycle detection (self-referral, 2-hop reciprocal, multi-hop circular rings),
 * device/IP collusion, and burst farming.
 */
export function evaluateReferralGraphAndAbuse(
  input: ReferralBindingInput,
): ReferralGraphSignal {
  const invitee = input.inviteeUserId.trim();
  const referrer = input.referrerUserId.trim();

  // 1. Direct self-referral (1-hop)
  if (invitee === referrer) {
    return {
      score: 100,
      isViolated: true,
      hasCycle: true,
      cycleLength: 1,
      cyclePath: [invitee, referrer],
      isCollusion: false,
      reasonCodes: [
        FRAUD_REASON_CODES.SELF_REFERRAL_DETECTED,
        FRAUD_REASON_CODES.CIRCULAR_REFERRAL_SUSPECT,
      ],
      details: {
        cycleDetected: true,
        cyclePath: [invitee, referrer],
        isDeviceCollusion: false,
        isIpCollusion: false,
        recentBindsCount: 0,
      },
    };
  }

  // 2. Multi-hop cycle detection by tracing parent chain from referrer
  const getParent = (id: string): string | undefined => {
    if (input.referralParents instanceof Map) {
      return input.referralParents.get(id);
    }
    const record = input.referralParents as Record<string, string>;
    return Object.prototype.hasOwnProperty.call(record, id)
      ? record[id]
      : undefined;
  };

  const visited = new Set<string>();
  const path: string[] = [referrer];
  let current: string | undefined = referrer;
  let hasCycle = false;
  let cyclePath: string[] = [];

  while (current) {
    if (current === invitee) {
      hasCycle = true;
      cyclePath = [...path];
      break;
    }
    visited.add(current);
    const parent = getParent(current);
    if (!parent || visited.has(parent)) {
      break;
    }
    path.push(parent);
    current = parent;
  }

  if (hasCycle) {
    const code =
      cyclePath.length === 2
        ? FRAUD_REASON_CODES.RECIPROCAL_REFERRAL_SUSPECT
        : FRAUD_REASON_CODES.CIRCULAR_REFERRAL_SUSPECT;

    return {
      score: 100,
      isViolated: true,
      hasCycle: true,
      cycleLength: cyclePath.length,
      cyclePath,
      isCollusion: false,
      reasonCodes: [code],
      details: {
        cycleDetected: true,
        cyclePath,
        isDeviceCollusion: false,
        isIpCollusion: false,
        recentBindsCount: 0,
      },
    };
  }

  // 3. Device & IP Collusion
  let collusionScore = 0;
  const reasons: FraudReasonCode[] = [];

  const isDeviceCollusion = Boolean(
    input.inviteeDeviceFingerprint &&
    input.referrerDeviceFingerprint &&
    input.inviteeDeviceFingerprint.trim() !== '' &&
    input.inviteeDeviceFingerprint === input.referrerDeviceFingerprint,
  );

  if (isDeviceCollusion) {
    collusionScore = Math.max(collusionScore, 90);
    reasons.push(FRAUD_REASON_CODES.REFERRAL_DEVICE_COLLUSION);
  }

  const isIpCollusion = Boolean(
    input.inviteeIp &&
    input.referrerIp &&
    input.inviteeIp.trim() !== '' &&
    input.inviteeIp === input.referrerIp &&
    typeof input.currentTimestampMs === 'number' &&
    typeof input.inviteeCreatedAtMs === 'number' &&
    input.currentTimestampMs - input.inviteeCreatedAtMs < 600000, // 10 minutes
  );

  if (isIpCollusion) {
    collusionScore = Math.max(collusionScore, 65);
    reasons.push(FRAUD_REASON_CODES.REFERRAL_IP_COLLUSION);
  }

  // 4. Referral Burst Farming
  const recentBinds = input.recentBindsToReferrerInWindow ?? 0;
  const bindThreshold = input.maxRecentBindsThreshold ?? 10;
  if (recentBinds > bindThreshold) {
    const over = recentBinds - bindThreshold;
    collusionScore = Math.max(collusionScore, Math.min(100, 50 + over * 5));
    reasons.push(FRAUD_REASON_CODES.REFERRAL_BURST_FARMING);
  }

  return {
    score: collusionScore,
    isViolated: collusionScore >= 40,
    hasCycle: false,
    cycleLength: 0,
    cyclePath: [],
    isCollusion: isDeviceCollusion || isIpCollusion,
    reasonCodes: reasons,
    details: {
      cycleDetected: false,
      isDeviceCollusion,
      isIpCollusion,
      recentBindsCount: recentBinds,
    },
  };
}

// ============================================================================
// 7. Composite Risk Scoring Engine
// ============================================================================

/**
 * Calculates a composite risk score (0-100), assigns risk tier and actionable recommendation,
 * applies critical floor overrides for severe isolated violations, and returns structured explainability.
 */
export function calculateCompositeRiskScore(
  input: CompositeRiskScoreInput,
): CompositeRiskScoreResult {
  const velocitySignal =
    input.precomputedSignals?.velocity ??
    (input.velocity ? evaluateEconomyVelocity(input.velocity) : undefined);

  const burstSignal =
    input.precomputedSignals?.burst ??
    (input.burst ? evaluateBurstAndReplay(input.burst) : undefined);

  const clusterSignal =
    input.precomputedSignals?.clustering ??
    (input.clustering
      ? evaluateDeviceAndIpClustering(input.clustering)
      : undefined);

  const referralSignal =
    input.precomputedSignals?.referral ??
    (input.referral
      ? evaluateReferralGraphAndAbuse(input.referral)
      : undefined);

  const sVel = velocitySignal?.score ?? 0;
  const sBurst = burstSignal?.score ?? 0;
  const sClust = clusterSignal?.score ?? 0;
  const sRef = referralSignal?.score ?? 0;

  // Weighted composite baseline: 0.35 vel, 0.20 burst, 0.20 clust, 0.25 ref
  const weighted = 0.35 * sVel + 0.2 * sBurst + 0.2 * sClust + 0.25 * sRef;

  // Critical floor overrides (prevents diluting severe single exploits)
  let criticalFloor = 0;
  if (burstSignal?.isDuplicate) {
    criticalFloor = Math.max(criticalFloor, 100);
  }
  if (referralSignal?.hasCycle) {
    criticalFloor = Math.max(criticalFloor, 100);
  }
  if (
    referralSignal?.reasonCodes.includes(
      FRAUD_REASON_CODES.SELF_REFERRAL_DETECTED,
    )
  ) {
    criticalFloor = Math.max(criticalFloor, 100);
  }
  if (sVel >= 95) {
    criticalFloor = Math.max(criticalFloor, 95);
  }
  if (
    referralSignal?.reasonCodes.includes(
      FRAUD_REASON_CODES.REFERRAL_DEVICE_COLLUSION,
    )
  ) {
    criticalFloor = Math.max(criticalFloor, 90);
  }
  if (clusterSignal?.severity === 'critical') {
    criticalFloor = Math.max(criticalFloor, 85);
  }

  const finalScore = Math.min(
    100,
    Math.max(Math.round(weighted), criticalFloor),
  );

  let tier: RiskTier = 'LOW';
  let recommendation: RiskRecommendation = 'allow';
  if (finalScore >= 90) {
    tier = 'CRITICAL';
    recommendation = 'reject';
  } else if (finalScore >= 70) {
    tier = 'HIGH';
    recommendation = 'freeze';
  } else if (finalScore >= 30) {
    tier = 'MEDIUM';
    recommendation = 'monitor';
  }

  const primaryReasons: FraudReasonCode[] = Array.from(
    new Set([
      ...(velocitySignal?.reasonCodes ?? []),
      ...(burstSignal?.reasonCodes ?? []),
      ...(clusterSignal?.reasonCodes ?? []),
      ...(referralSignal?.reasonCodes ?? []),
    ]),
  );

  const explainableDetails: ExplainableReasonItem[] = primaryReasons.map(
    (code) => {
      let sev: RiskSeverity;
      let contrib: number;
      let desc: string;

      switch (code) {
        case FRAUD_REASON_CODES.REPLAY_REQUEST_DETECTED:
          sev = 'critical';
          contrib = 100;
          desc = 'Duplicate request identifier replayed.';
          break;
        case FRAUD_REASON_CODES.CIRCULAR_REFERRAL_SUSPECT:
          sev = 'critical';
          contrib = 100;
          desc = 'Circular referral ring detected in parent graph.';
          break;
        case FRAUD_REASON_CODES.RECIPROCAL_REFERRAL_SUSPECT:
          sev = 'critical';
          contrib = 100;
          desc =
            'Reciprocal mutual referral loop detected between two accounts.';
          break;
        case FRAUD_REASON_CODES.SELF_REFERRAL_DETECTED:
          sev = 'critical';
          contrib = 100;
          desc = 'Direct self-referral attempt detected.';
          break;
        case FRAUD_REASON_CODES.NEGATIVE_ELAPSED_TIME:
          sev = 'critical';
          contrib = 95;
          desc = 'Negative elapsed time indicative of clock manipulation.';
          break;
        case FRAUD_REASON_CODES.VELOCITY_CAP_EXCEEDED:
        case FRAUD_REASON_CODES.CASH_VELOCITY_CAP_EXCEEDED:
          sev = sVel >= 90 ? 'critical' : 'high';
          contrib = sVel;
          desc =
            'Earnings claim rate exceeded physical business production ceiling.';
          break;
        case FRAUD_REASON_CODES.SEASON_POINTS_VELOCITY_EXCEEDED:
          sev = 'high';
          contrib = sVel;
          desc = 'Season Points claim exceeded expected maximum threshold.';
          break;
        case FRAUD_REASON_CODES.REFERRAL_DEVICE_COLLUSION:
          sev = 'critical';
          contrib = 90;
          desc =
            'Referrer and invitee share identical hardware device fingerprint.';
          break;
        case FRAUD_REASON_CODES.DEVICE_CLUSTER_DETECTED:
          sev = clusterSignal?.severity ?? 'high';
          contrib = sClust;
          desc =
            'High account clustering density detected on single device fingerprint.';
          break;
        case FRAUD_REASON_CODES.IP_CLUSTER_DETECTED:
          sev = clusterSignal?.severity ?? 'medium';
          contrib = sClust;
          desc =
            'High account clustering density detected on single IP address.';
          break;
        case FRAUD_REASON_CODES.HIGH_DENSITY_SUBNET_ANOMALY:
          sev = 'high';
          contrib = sClust;
          desc = 'Abnormal account density detected in subnet.';
          break;
        case FRAUD_REASON_CODES.RAPID_BURST_REQUESTS:
          sev = 'high';
          contrib = sBurst;
          desc = 'High request volume burst exceeding rate ceilings.';
          break;
        case FRAUD_REASON_CODES.SUB_DEBOUNCE_INTERVAL_VIOLATION:
          sev = 'medium';
          contrib = sBurst;
          desc =
            'Successive requests arrived below minimum human debounce interval.';
          break;
        case FRAUD_REASON_CODES.SUSTAINED_RATE_EXCEEDED:
          sev = 'high';
          contrib = sBurst;
          desc = 'Sustained request rate exceeded maximum threshold.';
          break;
        case FRAUD_REASON_CODES.REFERRAL_IP_COLLUSION:
          sev = 'medium';
          contrib = 65;
          desc =
            'Referrer and invitee share identical IP address during account creation window.';
          break;
        case FRAUD_REASON_CODES.REFERRAL_BURST_FARMING:
          sev = 'high';
          contrib = sRef;
          desc =
            'Abnormal burst of referral bindings directed to referrer in short window.';
          break;
        default:
          sev = 'medium';
          contrib = 20;
          desc = 'Suspicious gameplay anomaly flagged.';
          break;
      }

      return {
        code,
        severity: sev,
        scoreContribution: contrib,
        description: desc,
      };
    },
  );

  const signals: CompositeRiskScoreResult['signals'] = {};
  if (velocitySignal !== undefined) signals.velocity = velocitySignal;
  if (burstSignal !== undefined) signals.burst = burstSignal;
  if (clusterSignal !== undefined) signals.clustering = clusterSignal;
  if (referralSignal !== undefined) signals.referral = referralSignal;

  return {
    score: finalScore,
    tier,
    recommendation,
    isActionBlocked: finalScore >= 90,
    isRewardFrozen: finalScore >= 70,
    primaryReasons,
    explainableDetails,
    signalScores: {
      velocity: sVel,
      burst: sBurst,
      clustering: sClust,
      referral: sRef,
    },
    signals,
    evaluatedAt: new Date().toISOString(),
  };
}
