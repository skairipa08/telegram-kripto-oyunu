# Stream 1 Architectural Blueprint: Core Math, Adaptive Crash Engine & Streak Milestones

## 1. Observation

### 1.1 Existing Crypto Crash Engine (`packages/game-core/src/crypto-crash.ts`)
- **HMAC-SHA256 Pareto CDF Generation (Lines 34–77)**:
  ```ts
  export function generateCrashMultiplier(
    serverSeed: string,
    clientSeed: string,
    nonce: number | string,
    config: CryptoCrashConfig = DEFAULT_CRASH_CONFIG,
  ): CrashMultiplierResult {
    const hash = createHmac('sha256', serverSeed)
      .update(`${clientSeed}:${nonce}`)
      .digest('hex');
    const hexPart = hash.slice(0, 13);
    const h = parseInt(hexPart, 16);
    const isInstantCrash = h % config.instantCrashRateModulo === 0;
    if (isInstantCrash) {
      return { crashMultiplier: config.minMultiplier, hash, isInstantCrash: true, rawMultiplier: config.minMultiplier };
    }
    const U = h / Math.pow(2, 52);
    const rawMultiplier = 1.0 / (1 - U);
    const truncated = Math.floor(rawMultiplier * 100) / 100;
    const crashMultiplier = Math.max(config.minMultiplier, Math.min(config.maxMultiplier, truncated));
    return { crashMultiplier, hash, isInstantCrash: false, rawMultiplier };
  }
  ```
- **Observations on Current Engine**:
  1. It is entirely **memoryless**: It takes only `(serverSeed, clientSeed, nonce, config)`. It has zero knowledge of the player's recent bets, bet history, win streak, or sudden stake spikes.
  2. The natural probability of a multiplier $< 1.50\times$ under the baseline Pareto distribution is:
     $$P(M < 1.50) = p_{\text{instant}} + (1 - p_{\text{instant}}) \times \left(1 - \frac{1}{1.50}\right) = \frac{1}{33} + \frac{32}{33} \times \frac{1}{3} \approx 3.03\% + 32.32\% = 35.35\%$$
     Conversely, in $64.65\%$ of rounds, the multiplier is $\ge 1.50\times$, which creates high engagement for small bets.
  3. However, if a player exploits this by betting tiny amounts (e.g. 10 Cash) to build confidence or streaks and then spikes their bet to 10,000 Cash with an early cashout target ($1.20\times - 1.40\times$), the house risks bleeding significant capital because the win probability remains ~80%.
  4. In `settleCrashBet` (Lines 195–239), stake validation checks:
     ```ts
     if (stake < config.minStakeCash) throw new RangeError(...);
     if (stake > config.maxStakeCash) throw new RangeError(...);
     ```
     where `minStakeCash = 10` and `maxStakeCash = 10_000_000` from `DEFAULT_CRASH_CONFIG`. There is currently no check against user balance in `settleCrashBet`.

### 1.2 Existing Arcade API Routes & Store (`apps/api/src/arcade/store.ts` & `routes.ts`)
- **Store Stake & Crash Management (Lines 602–661 & 663–724)**:
  - In `startCrashRound`:
    ```ts
    if (stake < DEFAULT_CRASH_CONFIG.minStakeCash || stake > DEFAULT_CRASH_CONFIG.maxStakeCash) {
      return { roundId: '', stake, serverSeedHash: '', startTime: '', error: 'INVALID_STAKE' };
    }
    if (p.cash < stake) {
      return { roundId: '', stake, serverSeedHash: '', startTime: '', error: 'INSUFFICIENT_CASH' };
    }
    p.cash -= stake;
    // Creates round record and saves to p.crashRounds
    ```
  - In `cashoutCrashRound`:
    ```ts
    const crashResult = generateCrashMultiplier(round.serverSeed, round.clientSeed, round.nonce);
    const settlement = settleCrashBet({ stake: round.stake, crashMultiplier: crashResult.crashMultiplier, cashoutMultiplier: claimMultiplier });
    // Settles round, credits p.cash += settlement.payoutCash if won
    ```
  - `PlayerArcadeMemory` currently tracks `cash`, `crashRounds: Map<string, ...>`, and `crashNonce: number`. It does **not** track `recentStakes` or `consecutiveWins`.

### 1.3 Existing Missions & Streak Progression (`packages/game-core/src/missions.ts`)
- **Current Streak Evaluation (Lines 123–204)**:
  ```ts
  export const STREAK_SRU_MULTIPLIER = 0.25;

  export function calculateStreakReward(streakDays: number, currentSRU: number) {
    const isCycleBonus = streakDays > 0 && streakDays % 7 === 0;
    const multiplier = isCycleBonus ? 1.0 : STREAK_SRU_MULTIPLIER;
    const points = Math.round(multiplier * currentSRU);
    return { points, isCycleBonus };
  }

  export function evaluateStreak(lastClaimDate: string | null, currentDate: string, currentStreak: number) {
    ...
    if (diffDays === 1) {
      const nextStreak = currentStreak >= 7 ? 1 : currentStreak + 1;
      return { canClaim: true, nextStreak, wasReset: false };
    }
    ...
  }
  ```
- **Observations on Streak System**:
  1. `evaluateStreak` forcibly cycles back to Day 1 once Day 7 is reached (`currentStreak >= 7 ? 1 : currentStreak + 1`).
  2. Because of this modulo reset, players can **never** reach Day 30, Day 90, Day 180, or Day 365.
  3. `calculateStreakReward` only returns Season Points (`points`). It awards zero Cash rewards.
  4. In `supabase/migrations/202609140009_missions_and_launch.sql` (Line 382):
     `set current_streak = case when v_new_streak >= 7 then 0 else v_new_streak end` mirrors this 7-day revolving cycle.

### 1.4 Test Suite Baseline
- `pnpm --filter @empire/game-core test`: 19 test files, 275 tests passed (all green).
- `pnpm --filter @empire/api exec vitest run src/arcade`: 2 test files, 22 tests passed (all green).
- Existing test `packages/game-core/src/missions.test.ts` (Line 86) explicitly asserts:
  `it('cycles back to day 1 after day 7 on consecutive day', () => { ... expect(result.nextStreak).toBe(1); });`

---

## 2. Logic Chain

### 2.1 Free-Range Stake Validation ($10 \le \text{stake} \le \text{userBalance}$)
1. **Observation**: Currently, users are constrained by fixed chip buttons in the UI (+10, +50, +100, MAKS), while API checks `minStakeCash (10)` and `p.cash < stake`.
2. **Requirement**: Allow typing any custom stake with immediate mathematical bounds checking.
3. **Deduction**:
   - The stake input must satisfy three invariant boundaries:
     1. Integer check: `Number.isInteger(stake) && stake > 0`.
     2. Minimum bound: $\text{stake} \ge 10$ Cash. If $< 10$, return `INVALID_STAKE`.
     3. Maximum bound: $\text{stake} \le \text{userBalance}$. If $\text{stake} > \text{userBalance}$, return `INSUFFICIENT_CASH`.
   - Clamping logic for UI helpers:
     $$\text{clampedStake} = \min(\text{userBalance}, \max(10, \lfloor\text{input}\rfloor))$$
   - Zero/Low balance handling: If $\text{userBalance} < 10$, user cannot bet; UI must disable the action button with "Yetersiz Bakiye".

### 2.2 Adaptive Crash Algorithm & Baiting Math Engine
1. **Observation**: Small bets at baseline 97% RTP yield a $64.65\%$ win rate above $1.50\times$. If a player builds a win streak or establishes a low baseline (e.g. 50 Cash) and suddenly bets 2,000 Cash (>40x average) targeting $1.20\times$, the house faces high bleed risk.
2. **State Tracking Structure**:
   To detect stake spikes and winning runs without unbounded memory growth, we track:
   - `recentStakes`: Rolling window array of the last $N = 10$ completed stakes.
   - `averageStake`: Arithmetic mean $\bar{S} = \frac{1}{|\mathcal{H}|}\sum_{s \in \mathcal{H}} s$. If $|\mathcal{H}| = 0$, $\bar{S} = S$.
   - `consecutiveWins`: Continuous count $W \ge 0$ of successive rounds where the player cashed out profitably. Reset to 0 upon crash.
3. **Mathematical Formulation of Risk Severity ($k_{\text{risk}}$)**:
   Let $\lambda = S / \bar{S}$ be the stake jump ratio.
   - Baseline normal bets: $\lambda \le 1.5$ and $W \le 1 \implies k_{\text{risk}} = 0$.
   - Sudden spike bets: $\lambda > 2.5$ triggers pure stake protection.
   - Win streak escalation: $W \ge 2$ and $\lambda > 1.5$ triggers martingale protection.
   $$k_{\text{risk}} = \text{clamp}\left(0, 1, \; 0.8 \cdot \max\left(0, \frac{\lambda - 1.5}{2.0}\right) + 0.3 \cdot \max(0, W - 1) \cdot \max\left(0, \frac{\lambda - 1.0}{1.5}\right)\right)$$
4. **Probability Distribution Shift (Dual-CDF Mixture Transformation)**:
   We want the probability of early crash ($1.00\times \le M < 1.50\times$) to escalate from the baseline $35.35\%$ up to $75\% - 80\%$ when $k_{\text{risk}} \to 1.0$.
   - Using the HMAC-SHA256 hash commitment:
     - Slice 1 ($h_1$, bits 0–51): Uniform random float $U = h_1 / 2^{52} \in [0, 1)$.
     - Slice 2 ($h_2$, bits 52–103): Decision float $V = h_2 / 2^{52} \in [0, 1)$.
   - Define bias probability $P_{\text{bias}} = 0.65 \cdot k_{\text{risk}}$.
   - If $V < P_{\text{bias}}$ (Biased Early Dump Triggered):
     Generate a low multiplier strictly in $[1.01\times, 1.48\times]$:
     $$M_{\text{dump}} = \left\lfloor\left(1.01 + 0.44 \cdot U\right) \times 100\right\rfloor / 100$$
   - Else (Standard Provably Fair Pareto CDF):
     If $h_1 \pmod{33} == 0 \implies 1.00\times$ (Instant Crash).
     Else $M_{\text{pareto}} = \max(1.00, \min(1000.0, \lfloor(1.0 / (1 - U)) \times 100\rfloor / 100))$.
   - Total low-crash probability:
     $$P(M < 1.50) = P_{\text{bias}} \cdot 1.0 + (1 - P_{\text{bias}}) \cdot 0.3535 = 0.3535 + 0.6465 \cdot (0.65 \cdot k_{\text{risk}})$$
     - At $k_{\text{risk}} = 0$ (normal bets): $P(M < 1.50) = 35.35\%$ (high win rate preserved).
     - At $k_{\text{risk}} = 0.5$ (2.5x spike): $P(M < 1.50) \approx 56.36\%$.
     - At $k_{\text{risk}} = 1.0$ (extreme spike / hot streak jump): $P(M < 1.50) \approx 77.37\%$.
   - **Provable Fairness Invariant**:
     Because $h_1$ and $h_2$ are derived from `HMAC-SHA256(serverSeed, clientSeed:nonce)` and the player's snapshot `adaptiveContext` is stored in the round record, any player or auditor can verify the calculation deterministically.

### 2.3 Extended Streak Milestone Architecture (7d, 30d, 90d, 180d, 365d)
1. **Observation**: Streak was artificially capped at 7 days. To reward long-term retention over 1 year, we need compounding milestones.
2. **Milestone Escalation Table**:

| Milestone | Days | SRU Multiplier | Cash Reward | Special Badge |
|---|---|---|---|---|
| Regular Day | $D$ | $0.25\times$ | $0$ | None |
| Weekly Cycle | $D \pmod 7 = 0$ | $1.0\times$ | $0$ | None |
| **Milestone 1** | **7 Days** | **$1.0\times$** | **$500$** | `streak_7d` |
| **Milestone 2** | **30 Days (1 Ay)** | **$2.5\times$** | **$5,000$** | `streak_30d` |
| **Milestone 3** | **90 Days (3 Ay)** | **$5.0\times$** | **$25,000$** | `streak_90d` |
| **Milestone 4** | **180 Days (6 Ay)** | **$10.0\times$** | **$100,000$** | `streak_180d` |
| **Milestone 5** | **365 Days (1 Yıl)** | **$25.0\times$** | **$500,000$** | `imperial_veteran` ("İmparatorluk Kıdemlisi") |

3. **Progression Modification**:
   - In `evaluateStreak`: Replace `const nextStreak = currentStreak >= 7 ? 1 : currentStreak + 1` with:
     `const nextStreak = currentStreak + 1;`
   - When a user misses a day (`diffDays > 1`), streak cleanly resets to 1 (`wasReset: true`).

---

## 3. Caveats

1. **Test Update for `evaluateStreak`**:
   In `packages/game-core/src/missions.test.ts` (Line 86), the test expecting Day 7 to cycle to Day 1 must be updated to expect Day 8 to reflect the new 365-day milestone progression.
2. **Backward Compatibility of `generateCrashMultiplier`**:
   Existing tests in `packages/game-core/src/crypto-crash.test.ts` (50,000 Monte Carlo RTP proof) and `challenger-stream1.test.ts` call `generateCrashMultiplier` without an adaptive context. By making the `context` parameter optional, all existing tests will continue to pass with 0 regressions.
3. **Database Migration Isolation**:
   `apps/api/src/arcade/` uses in-memory store (`MemoryArcadeStore`), which is already in use by both the app and test suite. The new streak Cash reward in API endpoints should be credited via `player_balances` or returned in the DTO.

---

## 4. Conclusion & Architectural Blueprint

### 4.1 Target Code Specifications

#### Blueprint 1: `packages/game-core/src/crypto-crash.ts`
```ts
export interface PlayerCrashAdaptiveContext {
  readonly recentStakes: readonly number[];
  readonly averageStake: number;
  readonly consecutiveWins: number;
  readonly currentStake: number;
}

export interface AdaptiveCrashResult extends CrashMultiplierResult {
  readonly isAdaptiveBiased: boolean;
  readonly riskScore: number;
  readonly stakeRatio: number;
}

/**
 * Evaluates stake spike ratio and consecutive wins to produce risk severity score k_risk in [0, 1].
 */
export function calculateCrashRiskScore(
  currentStake: number,
  averageStake: number,
  consecutiveWins: number,
): { riskScore: number; stakeRatio: number } {
  const avg = averageStake > 0 ? averageStake : currentStake;
  const stakeRatio = currentStake / avg;

  const stakePenalty = 0.8 * Math.max(0, (stakeRatio - 1.5) / 2.0);
  const streakPenalty =
    0.3 * Math.max(0, consecutiveWins - 1) * Math.max(0, (stakeRatio - 1.0) / 1.5);

  const rawRisk = stakePenalty + streakPenalty;
  const riskScore = Math.max(0, Math.min(1.0, rawRisk));

  return { riskScore, stakeRatio };
}

/**
 * Validates free-range stake: 10 <= stake <= userBalance.
 */
export function validateCrashStake(
  stake: unknown,
  userBalance: number,
  config?: Partial<CryptoCrashConfig>,
): {
  valid: boolean;
  error?: 'INVALID_STAKE' | 'INSUFFICIENT_CASH';
  sanitizedStake?: number;
  message?: string;
} {
  if (typeof stake !== 'number' || !Number.isFinite(stake) || Number.isNaN(stake)) {
    return { valid: false, error: 'INVALID_STAKE', message: 'Geçersiz yatırım tutarı' };
  }
  const minStake = config?.minStakeCash ?? DEFAULT_CRASH_CONFIG.minStakeCash;
  const maxStake = config?.maxStakeCash ?? DEFAULT_CRASH_CONFIG.maxStakeCash;
  const integerStake = Math.floor(stake);

  if (integerStake < minStake) {
    return { valid: false, error: 'INVALID_STAKE', message: `Minimum yatırım ${minStake} Nakit olmalıdır` };
  }
  if (integerStake > maxStake) {
    return { valid: false, error: 'INVALID_STAKE', message: `Maksimum yatırım ${maxStake} Nakit sınırını aşıyor` };
  }
  if (integerStake > userBalance) {
    return { valid: false, error: 'INSUFFICIENT_CASH', message: 'Yetersiz bakiye' };
  }

  return { valid: true, sanitizedStake: integerStake };
}

/**
 * Provably fair adaptive crash multiplier generator.
 */
export function generateAdaptiveCrashMultiplier(
  serverSeed: string,
  clientSeed: string,
  nonce: number | string,
  context?: PlayerCrashAdaptiveContext,
  config: CryptoCrashConfig = DEFAULT_CRASH_CONFIG,
): AdaptiveCrashResult {
  const hash = createHmac('sha256', serverSeed)
    .update(`${clientSeed}:${nonce}`)
    .digest('hex');

  // Slice 1: Uniform float U for magnitude
  const hexPart1 = hash.slice(0, 13);
  const h1 = parseInt(hexPart1, 16);
  const U = h1 / Math.pow(2, 52);

  // Slice 2: Uniform float V for bias decision
  const hexPart2 = hash.slice(13, 26);
  const h2 = parseInt(hexPart2, 16);
  const V = h2 / Math.pow(2, 52);

  // Compute adaptive risk score
  let riskScore = 0;
  let stakeRatio = 1.0;
  if (context) {
    const risk = calculateCrashRiskScore(
      context.currentStake,
      context.averageStake,
      context.consecutiveWins,
    );
    riskScore = risk.riskScore;
    stakeRatio = risk.stakeRatio;
  }

  const biasProbability = 0.65 * riskScore;
  const isAdaptiveBiased = riskScore > 0 && V < biasProbability;

  if (isAdaptiveBiased) {
    // Biased early dump: clamp in [1.01x, 1.48x]
    const rawDump = 1.01 + 0.44 * U;
    const crashMultiplier = Math.floor(rawDump * 100) / 100;
    return {
      crashMultiplier,
      hash,
      isInstantCrash: false,
      rawMultiplier: rawDump,
      isAdaptiveBiased: true,
      riskScore,
      stakeRatio,
    };
  }

  // Standard Pareto CDF path
  const isInstantCrash = h1 % config.instantCrashRateModulo === 0;
  if (isInstantCrash) {
    return {
      crashMultiplier: config.minMultiplier,
      hash,
      isInstantCrash: true,
      rawMultiplier: config.minMultiplier,
      isAdaptiveBiased: false,
      riskScore,
      stakeRatio,
    };
  }

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
    isAdaptiveBiased: false,
    riskScore,
    stakeRatio,
  };
}
```

#### Blueprint 2: `packages/game-core/src/missions.ts`
```ts
export interface StreakMilestone {
  readonly day: number;
  readonly sruMultiplier: number;
  readonly cashReward: number;
  readonly badge?: string;
  readonly titleTr: string;
  readonly descriptionTr: string;
}

export const STREAK_MILESTONES: readonly StreakMilestone[] = [
  {
    day: 7,
    sruMultiplier: 1.0,
    cashReward: 500,
    titleTr: '7 Günlük Seri',
    descriptionTr: 'Bir haftalık kesintisiz imparatorluk disiplini.',
  },
  {
    day: 30,
    sruMultiplier: 2.5,
    cashReward: 5_000,
    titleTr: '1 Aylık Sadakat',
    descriptionTr: '30 günlük kararlı büyüme ve azim.',
  },
  {
    day: 90,
    sruMultiplier: 5.0,
    cashReward: 25_000,
    titleTr: '3 Aylık Çeyrek Ustalığı',
    descriptionTr: 'Üç aylık kesintisiz pazar hakimiyeti.',
  },
  {
    day: 180,
    sruMultiplier: 10.0,
    cashReward: 100_000,
    titleTr: '6 Aylık Yarım Yıl Hanedanı',
    descriptionTr: 'Altı aylık stratejik imparatorluk yükselişi.',
  },
  {
    day: 365,
    sruMultiplier: 25.0,
    cashReward: 500_000,
    badge: 'imperial_veteran',
    titleTr: '1 Yıllık İmparatorluk Kıdemlisi',
    descriptionTr: 'Tam 365 günlük efsanevi sadakat ve liderlik.',
  },
] as const;

export interface ExtendedStreakReward {
  readonly points: number;
  readonly cash: number;
  readonly sruMultiplier: number;
  readonly isCycleBonus: boolean;
  readonly isMilestone: boolean;
  readonly milestoneDay?: number;
  readonly badge?: string;
  readonly title?: string;
}

export function calculateExtendedStreakReward(
  streakDays: number,
  currentSRU: number,
): ExtendedStreakReward {
  const milestone = STREAK_MILESTONES.find((m) => m.day === streakDays);

  if (milestone) {
    const points = Math.round(milestone.sruMultiplier * currentSRU);
    return {
      points,
      cash: milestone.cashReward,
      sruMultiplier: milestone.sruMultiplier,
      isCycleBonus: true,
      isMilestone: true,
      milestoneDay: milestone.day,
      badge: milestone.badge,
      title: milestone.titleTr,
    };
  }

  // 7-day cyclical bonus check (e.g. Day 14, 21, 28)
  const isCycleBonus = streakDays > 0 && streakDays % 7 === 0;
  const sruMultiplier = isCycleBonus ? 1.0 : STREAK_SRU_MULTIPLIER;
  const points = Math.round(sruMultiplier * currentSRU);

  return {
    points,
    cash: 0,
    sruMultiplier,
    isCycleBonus,
    isMilestone: false,
  };
}
```

#### Blueprint 3: `apps/api/src/arcade/store.ts`
- Extend `PlayerArcadeMemory`:
  ```ts
  crashAdaptive: {
    recentStakes: number[];
    consecutiveWins: number;
  };
  ```
- In `startCrashRound`:
  ```ts
  const validation = validateCrashStake(stake, p.cash);
  if (!validation.valid) {
    return { roundId: '', stake, serverSeedHash: '', startTime: '', error: validation.error };
  }
  const sanitizedStake = validation.sanitizedStake!;
  p.cash -= sanitizedStake;

  const avgStake = p.crashAdaptive.recentStakes.length > 0
    ? p.crashAdaptive.recentStakes.reduce((a, b) => a + b, 0) / p.crashAdaptive.recentStakes.length
    : sanitizedStake;

  p.crashRounds.set(roundId, {
    stake: sanitizedStake,
    serverSeed,
    serverSeedHash,
    clientSeed,
    nonce: p.crashNonce++,
    startTime,
    status: 'active',
    adaptiveContext: {
      recentStakes: [...p.crashAdaptive.recentStakes],
      averageStake: avgStake,
      consecutiveWins: p.crashAdaptive.consecutiveWins,
      currentStake: sanitizedStake,
    },
  });
  ```
- In `cashoutCrashRound`:
  ```ts
  const crashResult = generateAdaptiveCrashMultiplier(
    round.serverSeed,
    round.clientSeed,
    round.nonce,
    round.adaptiveContext,
  );
  // Settle bet
  if (settlement.status === 'won') {
    p.crashAdaptive.consecutiveWins += 1;
    p.cash += settlement.payoutCash;
  } else {
    p.crashAdaptive.consecutiveWins = 0;
  }
  p.crashAdaptive.recentStakes.push(round.stake);
  if (p.crashAdaptive.recentStakes.length > 10) {
    p.crashAdaptive.recentStakes.shift();
  }
  ```

---

## 5. Verification Method

### 5.1 Verification Commands
1. **Core Math Vitest Suite**:
   ```bash
   pnpm --filter @empire/game-core test
   ```
2. **Arcade API Vitest Suite**:
   ```bash
   pnpm --filter @empire/api exec vitest run src/arcade
   ```
3. **Full Monorepo Quality Gate**:
   ```bash
   pnpm check
   ```

### 5.2 Specific Test Cases to Implement & Invalidation Conditions
1. **Adaptive Crash Fuzzing Test** (`packages/game-core/src/crypto-crash.test.ts`):
   - 5,000 rounds of normal stakes ($\lambda = 1.0, W = 0$):
     Verify $P(M < 1.50) \approx 35.35\% \pm 2\%$, confirming high engagement.
   - 5,000 rounds of stake spikes ($\lambda = 3.5, W = 2$):
     Verify $P(M < 1.50) \ge 72\%$, confirming house bleed prevention.
2. **Free-Range Stake Boundary Test**:
   - Verify `validateCrashStake(9, 1000)` returns `INVALID_STAKE`.
   - Verify `validateCrashStake(1001, 1000)` returns `INSUFFICIENT_CASH`.
   - Verify `validateCrashStake(250, 1000)` returns `valid: true`.
3. **Milestone Progression Test** (`packages/game-core/src/missions.test.ts`):
   - Assert rewards for 7, 30, 90, 180, and 365 days match exact SRU multipliers (1.0x, 2.5x, 5.0x, 10.0x, 25.0x) and Cash (500, 5,000, 25,000, 100,000, 500,000).
   - Assert Day 365 returns `badge: 'imperial_veteran'`.
