# Core Engine Explorer Survey Report: Fraud Detection Signals & Risk Scoring Engine (Requirement R1)

## 1. Observation


### 1.1 Directory Structure & Workspace Layout
- **Package Path**: `packages/game-core`; Package name: `@empire/game-core`
- **Package Manifest**: `exports: ./src/index.ts`, `"scripts": { "typecheck": "tsc -p tsconfig.json" }`
- **TypeScript Configuration**: `tsconfig.json` extends `tsconfig.base.json` with `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`, `strict: true`, `verbatimModuleSyntax: true` (no implicit values or lax types).
- **Source Files in `packages/game-core/src/: 22 files total (11 files + 11 colocated test suites).
- **Current Exports in `index.ts**: config, formulas, missions, referral, leaderboard, monetization, remote-config, analytics, starter, simulation.


### 1.2 Test Runner & Test Execution
- Root `package.json`runs `vitest run`.
- Executing `pnpm test packages/game-core` runs all 11 test suites across `packages/game-core`:
  - 136 tests passed (100% green). Test run duration: 4.22s.
- Existing modules have comprehensive boundary and stress tests (e.g. `math-simulation-stress.test.ts` has 31 tests fuzzing 20,000 inputs, `leaderboard-stress.test.ts` has 6 tests with invariant shuffling).


### 1.3 Shared Contracts & Domain Boundaries
- `packages/shared/src/index.ts`:
  - Lines 534-535 define canonical analytics events: `'fraud_flag_created'` and `'reward_frozen'`.
  - Line 282 defines milestone status in `referralEventItemSchema`: `status: z.enum(['pending', 'claimed', 'frozen'])`.
  - All mutation DTOs require `requestId: z.uuid()` (`ClaimCashRequest`, `UpgradeBusinessRequest`, `BindReferralRequest`, `ClaimMissionRequest`, `ClaimStreakRequest`, `CreateInvoiceRequest`).
- Strictly preserved boundaries:
  - apps/api/src/auth/test-db.ts, apps/api/src/economy/**, apps/web/src/game/**, supabase/migrations/202609140007_game_loop_apis.sql are Codex/Sol game-loop files and must not be modified.
  - Workspace-wide test run shows apps/api tests currently expect `202609140007_game_loop_apis.sql` to be present, which another agent is handling. Therefore, anti-fraud design must remain strictly isolated and self-contained.

## 2. Logic Chain

1. **Pure Functional Contract in `packages/game-core`**:
   - Observation: All modules in `packages/game-core` (`formulas.ts`, `referral.ts`, `missions.ts`, `leaderboard.ts`, `monetization.ts`, `remote-config.ts`, `analytics.ts`, `simulation.ts`, `starter.ts`) are 100% pure functions with zero runtime dependencies.
   - Inference: The anti-fraud engine for Requirement R1 must live in `packages/game-core/src/fraud.ts` and export deterministic functions that take in-memory structures and return deterministic signals, normalized scores (0-100), and structured reason codes.

2. **Economy Velocity Formulation**:
   - Observation: Business production rates scale deterministically:
     `calculateProductionPerSecond(baseIncome, level, 1.07) * milestoneBonus`.
     Total cash generation is $\sum \text{production}$.
     Offline claims over $\Delta t$ seconds are capped at 14,400s (free) or 43,200s (pass) via `calculateOfflineEarnings`.
   - Inference: In any claim or reporting window $\Delta t$, the maximum allowable cash increment is $\lfloor P_{\text{total}} \times \min(\Delta t, \text{offlineCapSeconds}) \times 1.05 \rfloor$ (allowing 5% tolerance for client-server clock drift). Any claim where claimed cash exceeds this ceiling (or where production is 0 but claimed cash > 0) is physically impossible and constitutes velocity fraud.
   - For Season Points, rewards are strictly defined by discrete SRU multipliers: daily missions (max 3.0x SRU = 1,500 SP), weekly mission (5.0x SRU = 2,500 SP), daily streak (0.25x SRU = 125 SP, cycle bonus 1.0x SRU = 500 SP), and referral milestones (5.0x SRU max per qualified referral). Gaining > 3,000 SP in a single claim without admin intervention is mathematically impossible.
   - Any negative elapsed time ($\Delta t < 0$) indicates clock rollback manipulation and must trigger immediate high risk (score 95).

3. **Replay & Burst Request Modeling**:
   - Observation: All game mutation endpoints require a UUID `requestId`.
   - Inference:
     - Exact Replay: If a request's `requestId` matches a previously recorded `requestId` in recent history, it is an exact replay (`isDuplicate = true`, risk floor = 100).
     - Sub-debounce violation: Human motor limits prevent sending distinct actions faster than 150-200ms. If inter-arrival interval $\Delta t < 200\text{ms}$, it violates debounce ceilings.
     - Burst ceiling: If more than 15 requests arrive within a 5-second window (> 3 req/s), this violates normal human interation ceilings and indicates automation/scripting.
     - Sustained rate ceiling: If more than 60 requests arrive within 60 seconds (> 1 req/s sustained), it indicates unattended macro bots.

4. **Multi-Account & IP/Device Clustering**:
   - Observation: Telegram bot farms run multi-instance Android/web emulators on identical machines or behind shared proxies/VPNs.
   - Inference:
     - 1-2 accounts on the same IP is standard organic behavior (home Wi-Fi).
     - >= 4 accounts sharing the identical hardware/device fingerprint indicates multi-instance emulator abuse (Critical risk).
     - >= 8 accounts sharing an IP within 24 hours indicates proxy/VPN farm activity (High risk).
     - Severity scoring must combine device and IP signals with higher weighting given to device fingerprints (since IPs can be NATed across mobile towers).

5. **Referral Abuse & Sybil Rings**:
   - Observation: `packages/game-core/src/referral.ts` currently provides `isSelfReferral(referrer, invitee)`. However, attackers construct multi-hop rings (A -> B -> C -> A) or 2-hop reciprocal pairs (A -> B -> A) to harvest starter cash (+500) and referral milestone SP.
   - Inference:
     - Referral graph cycle detection: When player V attempts to bind player U as referrer, we trace the parent ancestor chain starting from U. If V is found among the ancestors of U, adding edge U -> V would close a cycle.
     - If cycle length L = 1: Direct self-referral (`SELF_REFERRAL_DETECTED`, score 100).
     - If cycle length L = 2: Reciprocal referral (`RECIPROCAL_REFERRAL_SUSPECT`, score 100).
     - If cycle length L >= 3: Circular ring (`CIRCULAR_REFERRAL_SUSPECT`, score 100).
     - Collusion detection: If referrer and invitee share the identical device fingerprint, it is an intra-device referral fraud (`REFERRAL_DEVICE_COLLUSION`, score 90).
     - Referral burst farming: If an account receives > 10 referral binds within a short window, flag as `REFERRAL_BURST_FARMING`.

6. **Explainable Risk Scoring Engine & Floor Overrides**:
   - Observation: Weighted composite score alone (0.35 \lcdot S_{\text{vel}} + 0.20 \lcdot S_{\text{burst}} + 0.20 \lcdot S_{\text{clust}} + 0.25 \lcdot S_{\text{ref}}) would dilute severe isolated violations (e.g. a confirmed circular referral cycle would only produce a score of 25 if other signals are 0).
   - Inference: The engine must apply **critical floor overrides**:
     finalScore = min(100, max(weightedScore, criticalFloors))
     where replay = 100, cycle = 100, self-referral = 100, velocity ratio > 3.0 = 95, device collusion = 90.
   - Actionable recommendations:
     - `LOW` (0-29): `recommendation: 'allow'`
     - `MEDIUM` (30-69): `recommendation: 'monitor'`
     - `HIGH` (70-89): `recommendation: 'freeze'` (Quarantine reward in `frozen_rewards`, alert admin)
     - `CRITICAL` (90-100): `recommendation: 'reject'` (Hard block action, flag for ban)
   - Explainability: Every detected violation produces an `ExplainableReasonItem` with code, severity, score contribution, and plain-text description.

## 3. Caveats

1. **In-Memory Graph vs Database Graph**: `packages/game-core` operates purely in memory. The cycle detection algorithm takes a referral parent lookup mapping (`ReadonlyMap<string, string>` or `Record<string, string>`). The backend API / store (`apps/api/src/fraud`) is responsible for querying the ancestor chain or recent graph snapshot from PostgreSQL to supply to the pure function.
2. **Device Fingerprint Availability**: Telegram Web / Mini App provides Telegram user ID and initData; device fingerprinting relies on client telemetry or canvas/header hashing. If `deviceFingerprint` is missing or null, the clustering and collusion algorithms fall back safely to IP and rate checks without throwing errors.
3. **No Project Code Modifications Made**: Consistent with the read-only explorer constraint, no modifications were made to `packages/game-core/src/index.ts` or any project source files.


## 4. Conclusion & Complete Design Specification


### 4.1 Target File Placement
- Engine Module: `packages/game-core/src/fraud.ts`
- Export Registration: `packages/game-core/src/index.ts` (`export * from './fraud';`)
- Unit Test Suite: `packages/game-core/src/fraud.test.ts`


### 4.2 Standardized Reason Codes (`FRAUD_REASON_CODES)`
```ts
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
```

### 4.3 Data Structures & TypeScript Interfaces

```ts
export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RiskRecommendation = 'allow' | 'monitor' | 'freeze' | 'reject';
export type RiskTier = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// --- Signal 1: Economy Velocity ---
export interface EconomyVelocityInput {
  claimedCash: number;
  currentProductionPerSecond: number;
  elapsedSeconds: number;
  offlineCapSeconds?: number;
  toleranceMultiplier?: number; // default 1.05 (5% drift)
  claimedSeasonPoints?: number;
  maxExpectedSeasonPoints?: number; // default 3000
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
  requestId?: string;
  actionType?: string;
}

export interface BurstReplayInput {
  currentRequestId: string;
  currentTimestampMs: number;
  currentActionType?: string;
  history: readonly RequestHistoryItem[];
  minDebounceIntervalMs?: number; // default 200ms
  burstWindowMs?: number; // default 5000ms (5s)
  maxBurstRequests?: number; // default 15
  sustainedWindowMs?: number; // default 60000ms (60s)
  maxSustainedRequests?: number; // default 60
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
    duplicateRequestId?: string;
  };
}

�
// --- Signal 3: Clustering ---
export interface DeviceIpClusteringInput {
  userId: string;
  ipAddress: string;
  deviceFingerprint?: string | null;
  accountsOnIp: number;
  accountsOnDevice?: number;
  ipThresholdWarn?: number; // default 4
  ipThresholdCritical?: number; // default 10
  deviceThresholdWarn?: number; // default 2
  deviceThresholdCritical?: number; // default 4
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
  inviteeDeviceFingerprint?: string | null;
  referrerDeviceFingerprint?: string | null;
  inviteeIp?: string | null;
  referrerIp?: string | null;
  inviteeCreatedAtMs?: number;
  currentTimestampMs?: number;
  referralParents: ReadonlyMap<string, string> | Record<string, string>;
  recentBindsToReferrerInWindow?: number;
  maxRecentBindsThreshold?: number; // default 10
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
    cyclePath?: string[];
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
  velocity?: EconomyVelocityInput;
  burst?: BurstReplayInput;
  clustering?: DeviceIpClusteringInput;
  referral?: ReferralBindingInput;
  precomputedSignals?: {
    velocity?: EconomyVelocitySignal;
    burst?: BurstReplaySignal;
    clustering?: DeviceIpClusteringSignal;
    referral?: ReferralGraphSignal;
  };
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
    velocity?: EconomyVelocitySignal;
    burst?: BurstReplaySignal;
    clustering?: DeviceIpClusteringSignal;
    referral?: ReferralGraphSignal;
  };
  evaluatedAt: string; // ISO 8601
}
`` 

### 4.4 Pure Mathematical Formulas & Implementation Specifications

#### 1. Economy Velocity (`evaluateEconomyVelocity`)
```ts
export function evaluateEconomyVelocity(input: EconomyVelocityInput): EconomyVelocitySignal {
  const elapsed = Math.floor(input.elapsedSeconds);
  if (elapsed < 0) {
    return {
      score: 95,
      isViolated: true,
      cashVelocityRatio: Infinity,
      seasonPointsVelocityRatio: 0,
      maxAllowedCash: 0,
      reasonCodes: [FRAUD_REASON_CODES.NEGATIVE_ELAPSED_TIME, FRAUD_REASON_CODES.VELOCITY_CAP_EXCEEDED],
      details: { claimedCash: input.claimedCash, maxAllowedCash: 0, claimedSeasonPoints: input.claimedSeasonPoints ?? 0, maxAllowedSeasonPoints: 0, elapsedSeconds: elapsed }
    };
  }

  const capSec = input.offlineCapSeconds ?? 14400;
  const tolerance = input.toleranceMultiplier ?? 1.05;
  const effectiveSeconds = Math.min(elapsed, capSec);
  const maxAllowedCash = Math.floor(input.currentProductionPerSecond * effectiveSeconds * tolerance);

  let cashScore = 0;
  const cashRatio = maxAllowedCash > 0 ? input.claimedCash / maxAllowedCash : (input.claimedCash > 0 ? Infinity : 1.0);
  const reasons: FraudReasonCode[] = [];

  if (input.currentProductionPerSecond === 0 && input.claimedCash > 0) {
    cashScore = 100;
    reasons.push(FRAUD_REASON_CODES.VELOCITY_CAP_EXCEEDED, FRAUD_REASON_CODES.CASH_VELOCITY_CAP_EXCEEDED);
  } else if (cashRatio > 1.0) {
    if (cashRatio <= 1.25) {
      cashScore = Math.min(40, Math.round((cashRatio - 1.0) * 160));
    } else if (cashRatio <= 2.0) {
      cashScore = 40 + Math.round((cashRatio - 1.25) * 40);
    } else {
      cashScore = Math.min(100, Math.round(70 + cashRatio * 5));
    }
    reasons.push(FRAUD_REASON_CODES.VELOCITY_CAP_EXCEEDED, FRAUD_REASON_CODES.CASH_VELOCITY_CAP_EXCEEDED);
  }

  let spScore = 0;
  const maxSP = input.maxExpectedSeasonPoints ?? 3000;
  const claimedSP = input.claimedSeasonPoints ?? 0;
  const spRatio = maxSP > 0 ? claimedSP / maxSP : 1.0;
  if (spRatio > 1.0) {
    spScore = Math.min(100, Math.round(50 + (spRatio - 1.0) * 50));
    reasons.push(FRAUD_REASON_CODES.SEASON_POINTS_VELOCITY_EXCEEDED);
  }

  const finalScore = Math.min(100, Math.max(cashScore, spScore));
  return {
    score: finalScore,
    isViolated: finalScore >= 40,
    cashVelocityRatio: Number(cashRatio.toFixed(4)),
    seasonPointsVelocityRatio: Number(spRatio.toFixed(4)),
    maxAllowedCash,
    reasonCodes: reasons,
    details: {
      claimedCash: input.claimedCash,
      maxAllowedCash,
      claimedSeasonPoints: claimedSP,
      maxAllowedSeasonPoints: maxSP,
      elapsedSeconds: elapsed
    }
  };
}
`` 
#### 2. Burst & Replay Requests (`evaluateBurstAndReplay`)
```ts
export function evaluateBurstAndReplay(input: BurstReplayInput): BurstReplaySignal {
  const minDebounce = input.minDebounceIntervalMs ?? 200;
  const burstWin = input.burstWindowMs ?? 5000;
  const maxBurst = input.maxBurstRequests ?? 15;
  const sustainedWin = input.sustainedWindowMs ?? 60000;
  const maxSustained = input.maxSustainedRequests ?? 60;

  // 1. Replay Check
  const isDuplicate = input.history.some((h) => h.requestId && h.requestId === input.currentRequestId);
  if (isDuplicate) {
    return {
      score: 100,
      isViolated: true,
      isDuplicate: true,
      burstCount: 1,
      sustainedCount: 1,
      shortestIntervalMs: 0,
      reasonCodes: [FRAUD_RESON_CODES.REPLAY_REQUEST_DETECTED],
      details: { burstWindowMs: burstWin, burstCount: 1, maxBurstRequests: maxBurst, sustainedCount: 1, duplicateRequestId: input.currentRequestId }
    };
  }

  // 2. Sliding window counts
  let burstCount = 1;
  let sustainedCount = 1;
  let shortestIntervalMs: number | null = null;
  const reasons: FraudReasonCode[] = [];

  for (const item of input.history) {
    const delta = input.currentTimestampMs - item.timestampMs;
    if (delta >= 0 && delta <= burstWin) burstCount++;
    if (delta >= 0 && delta <= sustainedWin) sustainedCount++;
    if (delta >= 0) {
      if (shortestIntervalMs === null || delta < shortestIntervalMs) {
        shortestIntervalMs = delta;
      }
    }
  }

  let burstScore = 0;
  if (shortestIntervalMs !== null && shortestIntervalMs < minDebounce) {
    burstScore = Math.max(burstScore, 50);
    reasons.push(FRAUD_REASON_CODES.SUB_DEBOUNCE_INTERVAL_VIOLATION);
  }

  if (burstCount > maxBurst) {
    const over = burstCount - maxBurst;
    burstScore = Math.max(burstScore, Math.min(100, 40 + over * 6));
    reasons.push(FRAUD_RESON_CODES.RAPID_BURST_REQUESTS);
  }

  if (sustainedCount > maxSustained) {
    burstScore = Math.max(burstScore, Math.min(100, 50 + (sustainedCount - maxSustained) * 2));
    reasons.push(FRAUD_RESON_CODES.SUST_EXCEEDED);
  }

  return {
    score: burstScore,
    isViolated: burstScore >= 40,
    isDuplicate: false,
    burstCount,
    sustainedCount,
    shortestIntervalMs,
    reasonCodes: reasons,
    details: { burstWindowMs: burstWin, burstCount, maxBurstRequests: maxBurst, sustainedCount }
  };
}
``

#### 3. Device & IP Clustering (`evaluateDeviceAndIpClustering`)
```ts
export function evaluateDeviceAndIpClustering(input: DeviceIpClusteringInput): DeviceIpClusteringSignal {
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
    reasons.push(FRAUD_RESON_CODES.IP_CLUSTER_DETECTED);
  } else if (ipCount >= ipWarn) {
    ipScore = 20 + (ipCount - ipWarn) * 6;
  }

  const score = Math.min(100, Math.max(devScore, Math.round(ipScore * 0.85), Math.min(100, devScore + Math.round(ipScore * 0.4))));
  let severity: RiskSeverity = 'low';
  if (score >= 90) severity = 'critical';
  else if (score >= 70) severity = 'high';
  else if (score >= 35) severity = 'medium';

  return {
    score,
    isViolated: score >= 40,
    severity,
    reasonCodes: reasons,
    details: { accountsOnIp: ipCount, accountsOnDevice: devCount, ipThresholdCritical: ipCrit, deviceThresholdCritical: devCrit }
  };
}
``

#### 4. Referral Graph & Sybil Cycle Detection (`evaluateReferralGraphAndAbuse`)
```ts
export function evaluateReferralGraphAndAbuse(input: ReferralBindingInput): ReferralGraphSignal {
  const invitee = input.inviteeUserId.trim();
  const referrer = input.referrerUserId.trim();

  // 1. Direct self-referral
  if (invitee === referrer) {
    return {
      score: 100,
      isViolated: true,
      hasCycle: true,
      cycleLength: 1,
      cyclePath: [invitee, referrer],
      isCollusion: false,
      reasonCodes: [FRAUD_RESON_CODES.SELF_REFERRAL_DETECTED, FRAUD_RESON_CODES.CIRCULAR_REFERRAL_SUSPECT],
      details: {
        cycleDetected: true,
        cyclePath: [invitee, referrer],
        isDeviceCollusion: false,
        isIpCollusion: false,
        recentBindsCount: 0
      }
    };
  }

  // 2. Multi-hop cycle detection by tracing parent chain from referrer
  const getParent = (id: string): string | undefined => {
    if (input.referralParents instanceof Map) {
      return input.referralParents.get(id);
    }
    return (input.referralParents as Record<string, string>)[id];
  };

  const visited = new Set<string>();
  const path: string[] = [referrer];
  let current = referrer;
  let hasCycle = false;
  let cyclePath: string[] = [];

  while (current) {
    if (current === invitee) {
      hasCycle = true;
      cyclePath = [...path, invitee];
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
    const code = cyclePath.length === 2 ? FRAUD_RESON_CODES.RECIPROCAL_REFERRAL_SUSPECT : FRAUD_RESON_CODES.CIRCULAR_REFERRAL_SUSPECT;
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
        recentBindsCount: 0
      }
    };
  }

  // 3. Device & IP Collusion
  let collusionScore = 0;
  const reasons: FraudReasonCode[] = [];
  const isDeviceCollusion = Boolean(
    input.inviteeDeviceFingerprint &&
    input.referrerDeviceFingerprint &&
    input.inviteeDeviceFingerprint === input.referrerDeviceFingerprint
  );
  if (isDeviceCollusion) {
    collusionScore = Math.max(collusionScore, 90);
    reasons.push(FRAUD_REASON_CODES.REFERRAL_DEVICE_COLLUSION);
  }

  const isIpCollusion = Boolean(
    input.inviteeIp &&
    input.referrerIp &&
    input.inviteeIp === input.referrerIp &&
    input.currentTimestampMs &&
    input.inviteeCreatedAtMs &&
    input.currentTimestampMs - input.inviteeCreatedAtMs < 600000
  );
  if (isIpCollusion) {
    collusionScore = Math.max(collusionScore, 65);
    reasons.push(FRAUD_REASON_CODES.REFERRAL_IP_COLLUSION);
  }

  // 4. Referral Burst Farming
  const recentBinds = input.recentBindsToReferrerInWindow ?? 0;
  const bindThreshold = input.maxRecentBindsThreshold ?? 10;
  if (recentBinds > bindThreshold) {
    collusionScore = Math.max(collusionScore, Math.min(100, 50 + (recentBinds - bindThreshold) * 5));
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
    details: { cycleDetected: false, isDeviceCollusion, isIpCollusion, recentBindsCount: recentBinds }
  };
}
``

#### 5. Composite Risk Scoring Engine (`calculateCompositeRiskScore`)
```ts
export function calculateCompositeRiskScore(input: CompositeRiskScoreInput): CompositeRiskScoreResult {
  const velocitySignal = input.precomputedSignals?.velocity ?? (input.velocity ? evaluateEconomyVelocity(input.velocity) : undefined);
  const burstSignal = input.precomputedSignals?.burst ?? (input.burst ? evaluateBurstAndReplay(input.burst) : undefined);
  const clusterSignal = input.precomputedSignals?.clustering ?? (input.clustering ? evaluateDeviceAndIpClustering(input.clustering) : undefined);
  const referralSignal = input.precomputedSignals?.referral ?? (input.referral ? evaluateReferralGraphAndAbuse(input.referral) : undefined);

  const sVel = velocitySignal?.score ?? 0;
  const sBurst = burstSignal?.score ?? 0;
  const sClust = clusterSignal?.score ?? 0;
  const SRef = referralSignal?.score ?? 0;

  // Weighted composite: 0.35 vel, 0.20 burst, 0.20 clust, 0.25 ref
  const weighted = 0.35 * sVel + 0.20 * sBurst + 0.20 * sClust + 0.25 * PRef;

  // Critical floor overrides (prevents diluting severe single exploits)
  let criticalFloor = 0;
  if (burstSignal?.isDuplicate) criticalFloor = 100;
  if (referralSignal?.hasCycle) criticalFloor = 100;
  if (referralSignal?.reasonCodes.includes(FRAUD_REASON_CODES.SELF_REFERRAL_DETECTED)) criticalFloor = 100;
  if (sVel >= 95) criticalFloor = Math.max(criticalFloor, 95);
  if (referralSignal?.reasonCodes.includes(FRAUD_REASON_CODES.REFERRAL_DEVICE_COLLUSION)) criticalFloor = Math.max(criticalFloor, 90);
  if (clusterSignal?.severity === 'critical') criticalFloor = Math.max(criticalFloor, 85);

  const finalScore = Math.min(100, Math.max(Math.round(weighted), criticalFloor));

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
      ...(referralSignal?.reasonCodes ?? [])
    ])
  );

  const explainableDetails: ExplainableReasonItem[] = primaryReasons.map((code) => {
    let sev: RiskSeverity = 'low';
    let contrib = 10;
    let desc = 'Detected anomalous pattern.';

    switch (code) {
      case FRAUD_REASON_CODES.REPLAY_REQUEST_DETECTED:
        sev = 'critical'; contrib = 100; desc = 'Duplicate request identifier replayed.'; break;
      case FRAUD_REASON_CODES.CIRCULAR_REFERRAL_SUSPECT:
      case FRAUD_REASON_CODES.RECIPROCAL_REFERRAL_SUSPECT:
      case FRAUD_RESON_CODES.SELF_REFERRAL_DETECTED:
        sev = 'critical'; contrib = 100; desc = 'Referral graph cycle or self-referral detected.'; break;
      case FRAUD_RESON_CODES.VELOCITY_CAP_EXCEEDED:
      case FRAUD_REASON_CODES.CASH_VELOCITY_CAP_EXCEEDED:
        sev = sVel >= 90 ? 'critical' : 'high'; contrib = sVel; desc = 'Earnings claim rate exceeded physical business production ceiling.'; break;
      case FRAUD_RESON_CODES.NEGATIVE_ELAPSED_TIME:
        sev = 'critical'; contrib = 95; desc = 'Negative elapsed time indicative of clock manipulation.'; break;
      case FRAUD_RESON_CODES.REFERRAL_DEVICE_COLLUSION:
        sev = 'critical'; contrib = 90; desc = 'Referrer and invitee share identical hardware device fingerprint.'; break;
      case FRAUD_REASON_CODES.DEVICE_CLUSTER_DETECTED:
        sev = clusterSignal?.severity ?? 'high'; contrib = sClust; desc = 'High account clustering density detected on single device fingerprint.'; break;
      case FRAUD_REASON_CODES.IP_CLUSTER_DETECTED:
        sev = clusterSignal?.severity ?? 'medium'; contrib = sClust; desc = 'High account clustering density detected on single IP address.'; break;
      case FRAUD_REASON_CODES.RAPID_BURST_REQUESTS:
        sev = 'high'; contrib = sBurst; desc = 'High request volume burst exceeding rate ceilings.'; break;
      case FRAUD_REASON_CODES.SUB_DEBOUNCE_INTERVAL_VIOLATION:
        sev = 'medium'; contrib = sBurst; desc = 'Successive requests arrived below minimum human debounce interval.'; break;
      default:
        sev = 'medium'; contrib = 20; desc = 'Suspicious gameplay anomaly flagged.'; break;
    }

    return { code, severity: sev, scoreContribution: contrib, description: desc };
  });

  return {
    score: finalScore,
    tier,
    recommendation,
    isActionBlocked: finalScore >= 90,
    isRewardFrozen: finalScore >= 70,
    primaryReasons,
    explainableDetails,
    signalScores: { velocity: sVel, burst: sBurst, clustering: sClust, referral: sRef },
    signals: {
      velocity: velocitySignal,
      burst: burstSignal,
      clustering: clusterSignal,
      referral: referralSignal
    },
    evaluatedAt: new Date().toISOString()
  };
}
```

## 5. Verification Method

### 5.1 Independent Verification Commands
1. **Unit Test Verification in `packages/game-core`**:
   ```powershell
   pnpm test packages/game-core
   ```
   - Confirms all 11 existing test suites (136 tests) and the new `packages/game-core/src/fraud.test.ts` pass cleanly.
2. **TypeScript Compilation Check**:
   ```powershell
   pnpm --filter @empire/game-core typecheck
   ```
   - Validates that `packages/game-core` satisfies `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, and `verbatimModuleSyntax: true`.
3. **Inspect Implementation & Handoff**:
   - Inspect `.agents/teamwork_preview_explorer_survey_core/handoff.md` for complete API signatures and mathematical proofs.

### 5.2 Invalidation Conditions
- If any function in `fraud.ts` relies on external I/O (database, network fetch, filesystem) -> violates pure functional architecture.
- If composite risk score is masked below 70 during an active circular referral cycle or nonce replay -> violates fraud security guarantee.
- If TypeScript compilation throws errors under `exactOptionalPropertyTypes` or `noUncheckedIndexedAccess` -> violates workspace strict typecheck.

## 6. Recommended Next Steps for Implementer

1. Create `packages/game-core/src/fraud.ts` implementing the interfaces and algorithms specified in Section 4.
2. Update `packages/game-core/src/index.ts` to append `export * from './fraud';`.
3. Create `packages/game-core/src/fraud.test.ts` covering all 4 core signals, composite scoring, edge cases (zero values, Infinity, NaN, empty history, direct self-referral, long cycles, device collusion).
4. Run `pnpm --filter @empire/game-core typecheck` and `pnpm test packages/game-core` to verify 100% green status.
