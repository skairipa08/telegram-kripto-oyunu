# Quality & Adversarial Review Report: Core Fraud Engine

**Reviewer**: teamwork_preview_reviewer_1 (Reviewer & Adversarial Critic)  
**Target Module**: `packages/game-core/src/fraud.ts`, `packages/game-core/src/fraud.test.ts`, `packages/game-core/src/index.ts`  
**Timestamp**: 2026-09-15T09:51:30Z  
**Verdict**: APPROVE  

---

## 1. Review Summary

The Core Fraud Engine for Project Empire (`packages/game-core/src/fraud.ts`) has been comprehensively reviewed and stress-tested. The module is pure, deterministic, side-effect free, and completely independent of network, database, and UI layers.

All four core fraud detection signals, composite risk scoring, critical floor overrides, and structured explainability mechanisms meet all blueprint and architectural specifications without any shortcuts, facades, or integrity violations.

- **Integrity Assessment**: CLEAN. No hardcoded test responses, no facades, no bypasses, no dummy implementations.
- **Typecheck**: `pnpm --filter @empire/game-core typecheck` exited with code 0.
- **Unit & Stress Tests**: `pnpm test packages/game-core` passed all 12 test suites and 181 tests (including 45 dedicated fraud engine tests) with code 0.
- **Exports**: Properly exported in `packages/game-core/src/index.ts`.

---

## 2. Detailed Verification of Detection Signals

### Signal 1: Economy Velocity (`evaluateEconomyVelocity`)
- **Claimed Cash vs Physical Production Ceiling**:
  - Formulas: `effectiveSeconds = Math.min(elapsed, capSec)`, `maxAllowedCash = Math.floor(prodRate * effectiveSeconds * tolerance)`.
  - Non-linear ratio tiers:
    - $1.0 < \text{ratio} \le 1.25$: slight drift allowed with warning score $\le 40$ (`isViolated: false`).
    - $1.25 < \text{ratio} \le 2.0$: violation with score $40 \dots 70$.
    - $\text{ratio} > 2.0$: severe violation with score $70 \dots 100$.
  - Zero-rate exploit: Claiming cash with zero production rate results in immediate score 100 and violation.
- **Offline Cap Enforced**: Clamps effective time to `offlineCapSeconds` (default 14,400s / 4 hours).
- **Clock Rollback Detection**: Elapsed seconds $< 0$ immediately triggers `NEGATIVE_ELAPSED_TIME` and `VELOCITY_CAP_EXCEEDED` with score 95.
- **Season Points Velocity**: Compares claimed SP against `maxExpectedSeasonPoints` (default 3,000 SP), scoring up to 100 on excessive claims.
- **Robustness**: Sanitizes `NaN`, negative rates, and non-finite numbers via `Number.isFinite`.

### Signal 2: Burst & Replay (`evaluateBurstAndReplay`)
- **Nonce Replay Prevention**: Performs exact match against `history.requestId`. Duplicate request triggers immediate score 100, `isDuplicate: true`, `isViolated: true`, and `REPLAY_REQUEST_DETECTED`.
- **Sub-Human Motor Debounce**: Flags intervals $< 200\text{ms}$ with `SUB_DEBOUNCE_INTERVAL_VIOLATION` (score 50).
- **Rapid Burst Detection**: Evaluates sliding window of $5,000\text{ms}$; triggers `RAPID_BURST_REQUESTS` if request count exceeds 15 (score escalates with $40 + \text{over} \times 6$, up to 100).
- **Sustained High-Rate Detection**: Evaluates sliding window of $60,000\text{ms}$; triggers `SUSTAINED_RATE_EXCEEDED` if request count exceeds 60 (score escalates with $50 + \text{over} \times 2$, up to 100).
- **Robustness**: Future timestamps ($\Delta < 0$) are filtered out and do not distort interval tracking. Empty history is handled cleanly.

### Signal 3: Device & IP Clustering (`evaluateDeviceAndIpClustering`)
- **Device Fingerprint Density**:
  - Warning at $\ge 2$ accounts: score $30 + (\text{devCount} - 2) \times 15$.
  - Critical at $\ge 4$ accounts: score $70 + (\text{devCount} - 4) \times 10$, flagging `DEVICE_CLUSTER_DETECTED`.
- **IP Address Density**:
  - Warning at $\ge 4$ accounts: score $20 + (\text{ipCount} - 4) \times 6$.
  - Critical at $\ge 10$ accounts: score $60 + (\text{ipCount} - 10) \times 4$, flagging `IP_CLUSTER_DETECTED`.
- **Weighted Synthesis & Severity**: Blends device and IP clustering scores; outputs severity tiers (`low`, `medium`, `high`, `critical`). Null/undefined fingerprints are handled gracefully.

### Signal 4: Referral Graph & Sybil Abuse (`evaluateReferralGraphAndAbuse`)
- **Self-Referral**: Direct $1$-hop self-referral (`invitee === referrer`) triggers score 100, `cycleLength: 1`, `cyclePath: [invitee, referrer]`, and `SELF_REFERRAL_DETECTED`.
- **Reciprocal Referral Loop**: $2$-hop mutual referrals ($A \to B \to A$) trigger score 100, `cycleLength: 2`, `RECIPROCAL_REFERRAL_SUSPECT`.
- **Circular Referral Rings**: Multi-hop rings ($A \to B \to C \to A$, up to arbitrary depth) trigger score 100, `cycleLength: N`, `CIRCULAR_REFERRAL_SUSPECT`.
- **Graph Traversal Termination**: Uses a `visited` Set to guarantee loop termination even in the presence of disconnected, pre-existing cycles in parent maps.
- **Hardware Device Collusion**: Matching non-empty device fingerprints between referrer and invitee trigger score 90, `isCollusion: true`, and `REFERRAL_DEVICE_COLLUSION`.
- **IP Collusion Window**: Identical IP addresses within 10 minutes ($600,000\text{ms}$) of invitee registration trigger score 65, `isCollusion: true`, and `REFERRAL_IP_COLLUSION`.
- **Burst Referral Farming**: Exceeding the burst threshold ($> 10$ binds in window) triggers score $50 + \text{over} \times 5$ and `REFERRAL_BURST_FARMING`.
- **Prototype Pollution Safety**: Uses `Object.prototype.hasOwnProperty.call` when traversing plain object parent maps, protecting against prototype pollution.

---

## 3. Composite Risk Scoring & Critical Floors

### Weighting & Baseline
The baseline composite score is computed as:
$$\text{Baseline} = 0.35 \times s_{\text{vel}} + 0.20 \times s_{\text{burst}} + 0.20 \times s_{\text{clust}} + 0.25 \times s_{\text{ref}}$$

### Critical Floor Overrides
To ensure that single catastrophic exploit attempts cannot be masked by low scores in unrelated dimensions, the following floor overrides are strictly enforced:
| Condition | Trigger | Minimum Critical Floor |
| :--- | :--- | :--- |
| **Request Replay** | `burstSignal.isDuplicate === true` | **100** |
| **Referral Cycle** | `referralSignal.hasCycle === true` | **100** |
| **Self-Referral** | `SELF_REFERRAL_DETECTED` present | **100** |
| **Velocity Anomaly** | $s_{\text{vel}} \ge 95$ (e.g. clock rollback) | **95** |
| **Device Collusion** | `REFERRAL_DEVICE_COLLUSION` present | **90** |
| **Critical Cluster** | `clusterSignal.severity === 'critical'` | **85** |

### Risk Tiers & Recommendations
| Composite Score | Risk Tier | Actionable Recommendation | Action Blocked ($\ge 90$) | Reward Frozen ($\ge 70$) |
| :---: | :---: | :---: | :---: | :---: |
| $0 \dots 29$ | **LOW** | `allow` | No | No |
| $30 \dots 69$ | **MEDIUM** | `monitor` | No | No |
| $70 \dots 89$ | **HIGH** | `freeze` | No | **Yes** |
| $90 \dots 100$ | **CRITICAL** | `reject` | **Yes** | **Yes** |

### Explainability Details
Returns a deduplicated array of `ExplainableReasonItem` with `code`, `severity`, `scoreContribution`, and human-readable `description` for audit logs and admin review.

---

## 4. Adversarial Stress Test Scenarios & Invariant Verification

| Scenario | Adversarial Vector | Expected System Defense | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Clock Rollback** | Player rolls back client clock ($t_{\text{elapsed}} = -60$) | Immediate score 95, flagged `NEGATIVE_ELAPSED_TIME` | Score 95, tier CRITICAL, reject | **PASS** |
| **Zero Rate Free Cash** | Claiming cash with 0 businesses producing | Immediate score 100, flagged `CASH_VELOCITY_CAP_EXCEEDED` | Score 100, tier CRITICAL, reject | **PASS** |
| **Replay Attack** | Resending valid nonce from earlier session | Immediate score 100 override, blocked action | Score 100, `isDuplicate: true`, reject | **PASS** |
| **Sub-Human Motor Macro** | Successive requests at 40ms intervals | Flag `SUB_DEBOUNCE_INTERVAL_VIOLATION`, score $\ge 50$ | Detected 40ms interval, score 50 | **PASS** |
| **Multi-Hop Sybil Ring** | 5-node cyclic ring ($A \to B \to C \to D \to E \to A$) | Detect cycle, reconstruct path, floor score 100 | Detected cycle len 5, score 100 | **PASS** |
| **Graph Traversal Trap** | Pre-existing disconnected loop ($X \to Y \to X$) | Must terminate without infinite loop or hanging | Terminated safely, zero hang | **PASS** |
| **Device Spoof / Collusion** | Same device fingerprint on invitee and referrer | Detect collusion, enforce floor 90, reject | Flagged `REFERRAL_DEVICE_COLLUSION`, score 90 | **PASS** |
| **Fuzzing & Malformed Input** | `NaN`, negative numbers, null device fingerprints | Gracefully normalize to 0, no unhandled exceptions | All sanitized safely, finite scores | **PASS** |

---

## 5. Integrity & Quality Findings

- **Integrity Check**: Pass. Zero integrity violations detected.
- **Code Quality**: Clean TypeScript, strong typing, comprehensive JSDoc annotations, deterministic pure functions without external I/O.
- **Test Coverage**: 45 comprehensive test cases covering positive paths, boundary conditions, malicious exploit vectors, and override combinations.

## 6. Final Recommendation

**VERDICT: APPROVE**
The Core Fraud Engine is production-ready, highly robust, and satisfies all requirements.
