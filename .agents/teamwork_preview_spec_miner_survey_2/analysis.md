# Project Empire — Economy Balancing, Onboarding, ROI Metrics & Simulation Specification Report

**Survey Milestone**: Survey 2 — Economy Balancing & Onboarding Spec Mining  
**Agent**: `teamwork_preview_spec_miner_survey_2`  
**Date**: 2026-09-14  
**Authoritative Sources**:
1. `ORIGINAL_REQUEST.md` (Section `## 2026-09-14T12:46:12Z` Requirements R1–R5)
2. `Project_Empire_Master_Blueprint_v1.0.docx` (Blueprint Sections 3, 5, 6, 7, 10, 11, 14, 18)
3. Existing Codebase:
   - `packages/game-core/src/formulas.ts` & `config.ts` & `referral.ts`
   - `packages/shared/src/index.ts`
   - `supabase/migrations/202609140001_auth.sql` to `202609140005_step7_to_11_backend.sql`
   - `apps/api/src/index.ts` & `apps/api/src/auth/`

---

## Executive Summary

This specification mining report covers the mathematical foundations, contract schemas, database triggers/RPCs, simulation harness, and domain boundaries required for **Project Empire's Economy Balancing, Onboarding Starter Grants, ROI Payback Models, and Simulation Tooling** (Requirements R1 through R5).

Key architectural insights discovered:
1. **Zero-Income Deadlock Elimination (R1)**: A brand new player initialized with $0$ Cash and $0$ production cannot interact with the game. Providing **100 Cash base starter grant** allows instant unlock of Street Stand (Level 1, 1 Cash/s) within 30 seconds. Binding a referral grants **+500 Cash** additively (600 Cash total), allowing instant acceleration to Street Stand Level 4.
2. **Deterministic Financial Analytics (R2)**: Pure formulas `calculatePaybackPeriodSeconds`, `calculateOptimalNextUpgrade`, and `formatCompactNumber` enable exact ROI calculations and scale-safe big number formatting up to $10^{15}$ (quadrillions) with zero precision loss.
3. **Pacing & Anti-Inflation Equilibrium (R3)**: Upgrade cost growth ($1.18^{L-1}$) outpaces production growth ($1.07^{L-1} \times L$) by a factor of $\approx 1.1028$ per level, preventing infinite exponential runaway and keeping progression smooth across 1-hour, 24-hour, 7-day, and 30-day horizons.
4. **API & Shared Contracts (R4)**: `PlayerBusiness` DTO upgrades to carry `paybackPeriodSeconds`, `marginalRoi`, and `nextLevelProductionPerSecond`. New authenticated endpoint `GET /economy/roi` exposes live recommendations and multiplier stats.
5. **Astra 6.0 Domain Isolation (R5)**: Zero UI/CSS modifications in `apps/web`; zero modifications to anti-cheat/anti-fraud algorithms.

---

## Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | R1: Onboarding | Base Starter Balance Grant | Grants 100 Cash on first player creation so player can immediately unlock Street Stand Level 1 | `userId: UUID` | Initialized player balance row with `cash = 100`, `season_points = 0` | Idempotent; duplicate creation attempts ignored | ORIGINAL_REQUEST R1, Blueprint Sec 3 & 10 |
| 2 | R1: Onboarding | Referral Starter Boost Grant | Additive +500 Cash grant (total 600 Cash) awarded when a player binds a referral link | `userId: UUID`, `referralCode: string` | Updated `cash = 600` (or `cash += 500`), recorded in `reward_ledger` | Fails if referral window expired (>30m) or self-referral | ORIGINAL_REQUEST R1, Blueprint Sec 6 & 18 |
| 3 | R1: Onboarding | Pure Starter Economy State Factory | `getStarterEconomyState()` returns side-effect-free initial economy state with 100/600 Cash | `isReferred?: boolean`, `config?: Partial<EconomyConfig>` | `PlayerEconomyState` (cash: 100/600, seasonPoints: 0, 6 businesses at level 0) | Returns default 100 cash if `isReferred` omitted | ORIGINAL_REQUEST R1, Acceptance Criteria |
| 4 | R1: Onboarding | DB New User Economy Trigger / RPC | Database trigger and RPC function `empire_init_player_economy` ensuring users never start with 0 cash and 0 production | `p_user_id: UUID`, `p_is_referred: boolean` | `{ success: true, cash: 100 \| 600, businesses_created: 6 }` | Idempotent on conflict; throws if user does not exist | ORIGINAL_REQUEST R1, Acceptance Criteria |
| 5 | R2: ROI Metrics | Payback Period Calculation | `calculatePaybackPeriodSeconds` calculates break-even duration in seconds for business upgrade | `upgradeCost: number`, `currentProduction: number`, `nextProduction: number` | `number` (seconds until marginal income pays off cost) | Returns `Infinity` if $\Delta P \le 0$; returns `0` if cost $\le 0$ | ORIGINAL_REQUEST R2, Acceptance Criteria |
| 6 | R2: ROI Metrics | Optimal Next Upgrade Recommendation | `calculateOptimalNextUpgrade` identifies upgrade yielding shortest payback period or highest marginal ROI | `businesses: BusinessCandidate[]`, `playerCash?: number`, `options?: { affordableOnly?: boolean }` | `OptimalUpgradeResult \| null` (slug, cost, payback, ROI, canAfford) | Returns `null` if business list empty or all maxed | ORIGINAL_REQUEST R2, Acceptance Criteria |
| 7 | R2: Formatting | Safe Big-Number Compact Formatter | `formatCompactNumber` cleanly formats numbers from 0 up to $10^{15}$ (1.2K, 3.5M, 12.8B, 4.5T, 1.0Q) | `value: number \| bigint \| string`, `options?: { decimals?: number }` | `string` (compact formatted string) | Throws `TypeError` or returns `'NaN'` on invalid numeric input | ORIGINAL_REQUEST R2, Acceptance Criteria |
| 8 | R3: Simulation | Deterministic Economy Simulation Harness | `simulateProgression` executes headless simulation across 1h, 24h, 7d, and 30d timeframes | `strategy: SimulationStrategy`, `durationSeconds: number`, `config?: Partial<EconomyConfig>` | `SimulationResult` (total cash, levels, unlock times, offline waste) | Throws `RangeError` if duration $\le 0$ or $> 2,592,000$ | ORIGINAL_REQUEST R3, Blueprint Sec 14 |
| 9 | R3: Simulation | Multi-Strategy Simulation Runner | Evaluates different player playstyles (`optimal_roi`, `cheapest`, `balanced`, `offline_casual`) | `strategy: string`, `options: SimulationOptions` | `SimulationResult` tailored to strategy rules | Falls back to `optimal_roi` on unknown strategy | ORIGINAL_REQUEST R3 |
| 10 | R3: Simulation | Convenience Pass Impact Metric | Calculates delta in total cash and unlock velocity between Free (4h offline cap) and Pass (12h cap) | `durationSeconds: number`, `checkInIntervalSeconds: number` | `{ freeRun: SimulationResult, passRun: SimulationResult, cashMultiplier: number }` | Div-by-zero protected if check-in $< 4$ hours | ORIGINAL_REQUEST R3, Blueprint Sec 7 |
| 11 | R3: Simulation | Anti-Inflation Pacing Validator | Validates that progression to Factory, Tech Co, and Global Holding follows a challenging, non-exponential curve | `levels: Record<string, number>`, `durationSeconds: number` | `{ passesPacing: boolean, ratioCostToProduction: number, maxCash: number }` | Fails assertions if cash exceeds safe integer range | ORIGINAL_REQUEST R3, Acceptance Criteria |
| 12 | R4: DTOs & API | Upgraded PlayerBusiness DTO | Adds `paybackPeriodSeconds`, `marginalRoi`, and `nextLevelProductionPerSecond` to `playerBusinessSchema` | Schema definition | Validated `PlayerBusiness` object with ROI metrics | Fails Zod parsing on missing or negative numeric values | ORIGINAL_REQUEST R4, shared/src/index.ts |
| 13 | R4: DTOs & API | Economy ROI API Endpoint | `GET /economy/roi` returns current total production, player cash, business ROI metrics, and next best upgrade | User session cookie / bearer token | `EconomyRoiResponse` (200 OK) | 401 Unauthorized if unauthenticated session | ORIGINAL_REQUEST R4 |
| 14 | R4: DTOs & API | Economy Simulation Forecast API | `GET /economy/simulation` returns headless projection data and 4h vs 12h cap metrics | `durationSeconds?: number`, `strategy?: string` | `EconomySimulationResponse` (200 OK) | 400 Bad Request on invalid query params | ORIGINAL_REQUEST R4 |
| 15 | R5: Governance | Astra 6.0 Strict Domain Boundaries | Preserves UI/UX (apps/web) and anti-cheat/anti-fraud isolation for Astra 6.0 | Build & test assertions | Zero modified files in `apps/web/src/components` and anti-fraud modules | Quality gate fails if boundary violated | ORIGINAL_REQUEST R5, Acceptance Criteria |

---

## Edge Cases

| # | Feature | Input | Observed / Expected Behavior |
|---|---------|-------|------------------------------|
| 1 | Onboarding Starter Grant | New player inserted into database without referral | `player_balances.cash` initialized to exactly `100`, Street Stand at level `0`; player has enough cash to immediately buy Level 1 |
| 2 | Onboarding Starter Grant | New player inserted with valid referral binding | `player_balances.cash` initialized to `600` (100 base + 500 referral boost); player can buy Street Stand and immediately upgrade to Level 4 |
| 3 | Onboarding Starter Grant | Existing player profile queried or initialized a second time | Trigger/RPC utilizes `ON CONFLICT (user_id) DO NOTHING`; existing balances are never overwritten or reset |
| 4 | `calculatePaybackPeriodSeconds` | `upgradeCost = 0` (free upgrade) | Returns `0` (instant payback) |
| 5 | `calculatePaybackPeriodSeconds` | `nextProduction <= currentProduction` ($\Delta P \le 0$) | Returns `Infinity` (`Number.POSITIVE_INFINITY`); upgrade provides zero marginal return |
| 6 | `calculatePaybackPeriodSeconds` | `currentProduction = 0` (business unlock from Level 0 to Level 1) | $\Delta P = \text{baseIncome} \times 1$; returns $\text{baseCost} / \text{baseIncome}$ (e.g. $100 / 1 = 100$s for Street Stand) |
| 7 | `calculatePaybackPeriodSeconds` | Milestone level upgrade (e.g. Street Stand Level 9 $\to$ 10) | $\Delta P$ increases sharply due to $2\times$ milestone bonus; payback period drops from $\approx 104$s to $\approx 20.8$s |
| 8 | `calculateOptimalNextUpgrade` | Empty business array `[]` | Returns `null` safely without exception |
| 9 | `calculateOptimalNextUpgrade` | `playerCash = 0` with `affordableOnly = true` | Returns `null` because no upgrade costs 0 Cash |
| 10 | `calculateOptimalNextUpgrade` | `playerCash = 0` with `affordableOnly = false` | Returns the global best upgrade candidate (Street Stand Level 0 $\to$ 1, cost 100, payback 100s) with `canAfford: false` |
| 11 | `calculateOptimalNextUpgrade` | Two businesses have identical payback periods | Deterministic tie-breaker: selects candidate with lower `upgradeCost`; if costs identical, selects lower `order` / alphabetical `slug` |
| 12 | `formatCompactNumber` | `value = 0` | Returns `'0'` cleanly |
| 13 | `formatCompactNumber` | `value = 999` | Returns `'999'` (no suffix applied under 1,000) |
| 14 | `formatCompactNumber` | `value = 1000` | Returns `'1K'` (or `'1.0K'` depending on trailing zero configuration) |
| 15 | `formatCompactNumber` | `value = 999999` (rounds to 1,000K) | Properly rolls over to `'1M'` rather than producing `'1000K'` |
| 16 | `formatCompactNumber` | `value = 10^15` ($1,000,000,000,000,000$) | Returns `'1Q'` (or `'1.0Q'` / `'1Qa'`); no floating point exponent leak like `1e+15` |
| 17 | `formatCompactNumber` | BigInt input `1000000000000000n` ($10^{15}$) | Processes safely with zero precision loss from IEEE 754 float limits |
| 18 | `formatCompactNumber` | Negative value `-2500` | Returns `'-2.5K'` preserving the sign |
| 19 | `simulateProgression` | `durationSeconds = 3600` (1 hour) | Active loop unlocks Street Stand at second 0, reaches levels 5–10; total cash earned ranges $500–$2,000 |
| 20 | `simulateProgression` | `durationSeconds = 86400` (24 hours) with 12h check-ins and 4h cap | Exactly 8 hours of income claimed, 16 hours lost to cap; illustrates Free tier penalty |
| 21 | `simulateProgression` | `durationSeconds = 86400` with 12h check-ins and 12h cap | Full 24 hours of income claimed; total cash is $\approx 3\times$ higher than Free tier |
| 22 | `simulateProgression` | `durationSeconds = 2592000` (30 days) | Smooth pacing: Factory unlocked around day 3–5, Tech Co around day 10–15, Global Holding around day 22–28; max cash remains $< 10^{14}$ |
| 23 | `GET /economy/roi` | Unauthenticated user | Returns HTTP 401 with `{ apiVersion: 'v1', error: { code: 'UNAUTHORIZED' } }` |
| 24 | `GET /economy/roi` | User with 0 businesses unlocked | Returns all 6 businesses with level 0, Street Stand recommended as optimal upgrade (cost 100, payback 100s) |

---

## Detailed Architectural & Mathematical Specifications

### 1. Requirement R1: Onboarding Starter Grants & Core Loop Calibration

#### 1.1 Problem Statement & Invariant
- **The Zero-Income Deadlock**:
  In Project Empire's idle economy, income is generated strictly by business production:
  $$\text{Income}(t) = \sum_{i=1}^6 \text{calculateProductionPerSecond}(\text{baseIncome}_i, \text{level}_i) \times t$$
  If a user starts with $\text{level}_i = 0$ for all $i \in \{1..6\}$ and $\text{cash} = 0$:
  $$\text{Income}(t) = 0 \quad \forall t \ge 0$$
  The player has no Cash to purchase Street Stand ($\text{baseCost} = 100$), generates zero passive income, and is trapped permanently.
- **The Core Invariant**:
  $$\forall u \in \text{Users}: \quad \text{player\_balances}(u).\text{cash} \ge 100 \lor \sum \text{level}_i > 0$$
  A user must **never** be initialized with $0$ cash and $0$ production.

#### 1.2 Starter Balances Specification
- **Base Grant**: `100 Cash`.
  - Enables immediate purchase of **Street Stand** (Level 1, cost 100, production 1 Cash/s).
  - Time to first unlock: $< 5$ seconds from registration.
  - Core loop activated: within 30 seconds, player earns $> 25$ Cash.
- **Referral Additive Boost**: `+500 Cash`.
  - If registered via deep-link `ref_<code>` or bound within the 30-minute window:
    $$\text{StarterCash}_{\text{referred}} = 100 + 500 = 600 \text{ Cash}$$
  - Enables immediate progression:
    - Level 0 $\to$ 1: 100 Cash (Remaining: 500 Cash, Prod: 1 Cash/s)
    - Level 1 $\to$ 2: 118 Cash (Remaining: 382 Cash, Prod: 2.14 Cash/s)
    - Level 2 $\to$ 3: 139 Cash (Remaining: 243 Cash, Prod: 3.43 Cash/s)
    - Level 3 $\to$ 4: 164 Cash (Remaining: 79 Cash, Prod: 4.90 Cash/s)
    - Total cost to reach Level 4: $100 + 118 + 139 + 164 = 521 \le 600$ Cash.

#### 1.3 Pure Function Contract: `getStarterEconomyState`
Located in `packages/game-core/src/starter.ts` (or `formulas.ts`):
```typescript
export interface StarterEconomyOptions {
  readonly isReferred?: boolean;
  readonly starterCashBase?: number; // default 100
  readonly starterCashReferralBoost?: number; // default 500
  readonly businesses?: readonly BusinessConfig[]; // default DEFAULT_BUSINESSES
  readonly offlineCapSeconds?: number; // default 14400
}

export function getStarterEconomyState(
  options?: StarterEconomyOptions,
): PlayerEconomyState {
  const isReferred = options?.isReferred ?? false;
  const baseCash = options?.starterCashBase ?? 100;
  const referralBoost = options?.starterCashReferralBoost ?? 500;
  const initialCash = isReferred ? baseCash + referralBoost : baseCash;
  const businessDefs = options?.businesses ?? DEFAULT_BUSINESSES;
  const offlineCap = options?.offlineCapSeconds ?? 14400;

  const nowIso = new Date().toISOString();

  const businesses: PlayerBusiness[] = businessDefs.map((b) => {
    const upgradeCost = calculateUpgradeCost(b.baseCost, 1);
    const nextProduction = calculateProductionPerSecond(b.baseIncome, 1);
    const payback = calculatePaybackPeriodSeconds(upgradeCost, 0, nextProduction);
    const marginalRoi = upgradeCost > 0 ? nextProduction / upgradeCost : 0;

    return {
      slug: b.id,
      name: b.name,
      level: 0,
      baseCost: b.baseCost,
      baseIncome: b.baseIncome,
      upgradeCost,
      productionPerSecond: 0,
      lastClaimAt: nowIso,
      paybackPeriodSeconds: payback,
      marginalRoi,
      nextLevelProductionPerSecond: nextProduction,
    };
  });

  return {
    cash: initialCash,
    seasonPoints: 0,
    totalProductionPerSecond: 0,
    offlineCapSeconds: offlineCap,
    businesses,
  };
}
```

#### 1.4 Database Schema & Trigger Specification
In `supabase/migrations/202609140006_starter_economy.sql`:
1. Modify `public.player_balances`:
   ```sql
   ALTER TABLE public.player_balances
     ALTER COLUMN cash SET DEFAULT 100;
   ```
2. Trigger on `public.users` after insert:
   ```sql
   CREATE OR REPLACE FUNCTION public.empire_handle_new_user_starter_economy()
   RETURNS TRIGGER
   LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = ''
   AS $$
   BEGIN
     -- 1. Initialize player balances with 100 starter cash
     INSERT INTO public.player_balances (user_id, cash, season_points)
     VALUES (NEW.id, 100, 0)
     ON CONFLICT (user_id) DO NOTHING;

     -- 2. Initialize player businesses for all canonical businesses at level 0
     INSERT INTO public.player_businesses (user_id, business_id, level, last_claim_at)
     SELECT NEW.id, b.id, 0, now()
     FROM public.businesses b
     ON CONFLICT (user_id, business_id) DO NOTHING;

     -- 3. Log to reward ledger
     INSERT INTO public.reward_ledger (user_id, delta_cash, delta_season_points, reason, metadata)
     VALUES (NEW.id, 100, 0, 'starter_grant', '{"type":"base_onboarding"}'::jsonb);

     RETURN NEW;
   END;
   $$;

   DROP TRIGGER IF EXISTS trigger_new_user_starter_economy ON public.users;
   CREATE TRIGGER trigger_new_user_starter_economy
     AFTER INSERT ON public.users
     FOR EACH ROW
     EXECUTE FUNCTION public.empire_handle_new_user_starter_economy();
   ```
3. RPC function `empire_init_player_economy`:
   ```sql
   CREATE OR REPLACE FUNCTION public.empire_init_player_economy(
     p_user_id uuid,
     p_is_referred boolean DEFAULT false
   )
   RETURNS jsonb
   LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = ''
   AS $$
   DECLARE
     v_cash bigint := 100;
     v_bonus bigint := 0;
   BEGIN
     IF p_is_referred THEN
       v_bonus := 500;
       v_cash := v_cash + v_bonus;
     END IF;

     INSERT INTO public.player_balances (user_id, cash, season_points)
     VALUES (p_user_id, v_cash, 0)
     ON CONFLICT (user_id) DO UPDATE SET
       cash = CASE WHEN p_is_referred AND public.player_balances.cash < 600
                   THEN public.player_balances.cash + 500
                   ELSE public.player_balances.cash END;

     INSERT INTO public.player_businesses (user_id, business_id, level, last_claim_at)
     SELECT p_user_id, b.id, 0, now()
     FROM public.businesses b
     ON CONFLICT (user_id, business_id) DO NOTHING;

     RETURN jsonb_build_object('success', true, 'cash', v_cash);
   END;
   $$;
   ```

---

### 2. Requirement R2: Economy Mathematical Balance & ROI Metrics

#### 2.1 `calculatePaybackPeriodSeconds` Specification
- **Mathematical Definition**:
  Let $C$ be the upgrade cost in Cash.
  Let $P_0$ be the current production rate in Cash/second.
  Let $P_1$ be the new production rate in Cash/second after upgrading.
  The marginal production increase is:
  $$\Delta P = P_1 - P_0$$
  The payback period (break-even time) $T_{\text{payback}}$ in seconds is:
  $$T_{\text{payback}}(C, P_0, P_1) = \begin{cases} 0 & \text{if } C \le 0 \\ \infty & \text{if } \Delta P \le 0 \\ \frac{C}{\Delta P} & \text{if } C > 0 \land \Delta P > 0 \end{cases}$$
- **Canonical Payback Table Across All 6 Businesses**:
  | Business | Level 0 $\to$ 1 Cost | Level 0 $\to$ 1 $\Delta P$ | Unlock Payback ($T$) | Level 9 $\to$ 10 Cost | Level 9 $\to$ 10 $\Delta P$ | Milestone 10 Payback ($T$) |
  |---|---|---|---|---|---|---|
  | **Street Stand** | 100 | 1.0 Cash/s | **100.00s** ($\approx 1.7$m) | 444 | 21.31 Cash/s | **20.84s** |
  | **Cafe** | 2,500 | 12.0 Cash/s | **208.33s** ($\approx 3.5$m) | 11,089 | 255.67 Cash/s | **43.37s** |
  | **Delivery Hub** | 25,000 | 90.0 Cash/s | **277.78s** ($\approx 4.6$m) | 110,886 | 1,917.50 Cash/s | **57.83s** |
  | **Factory** | 250,000 | 600.0 Cash/s | **416.67s** ($\approx 6.9$m) | 1,108,862 | 12,783.33 Cash/s | **86.74s** |
  | **Tech Company** | 3,000,000 | 5,000.0 Cash/s | **600.00s** ($10.0$m) | 13,306,346 | 106,527.75 Cash/s | **124.91s** |
  | **Global Holding** | 50,000,000 | 60,000.0 Cash/s | **833.33s** ($\approx 13.9$m) | 221,772,429 | 1,278,333.00 Cash/s | **173.49s** |

*Insight*: Notice how unlock paybacks scale up from 100s to 833s, while milestone breakthroughs at Level 10 accelerate payback to between 20.8s and 173.5s!

#### 2.2 `calculateOptimalNextUpgrade` Specification
- **Algorithm & Signature**:
  ```typescript
  export interface BusinessCandidate {
    readonly slug: string;
    readonly name: string;
    readonly level: number;
    readonly baseCost: number;
    readonly baseIncome: number;
    readonly upgradeCostGrowth?: number;
    readonly productionLevelGrowth?: number;
  }

  export interface OptimalUpgradeResult {
    readonly slug: string;
    readonly name: string;
    readonly currentLevel: number;
    readonly nextLevel: number;
    readonly upgradeCost: number;
    readonly currentProduction: number;
    readonly nextProduction: number;
    readonly deltaProduction: number;
    readonly paybackPeriodSeconds: number;
    readonly marginalRoi: number; // deltaProduction / upgradeCost
    readonly canAfford: boolean;
  }

  export function calculateOptimalNextUpgrade(
    businesses: ReadonlyArray<BusinessCandidate>,
    playerCash = 0,
    options?: { readonly affordableOnly?: boolean },
  ): OptimalUpgradeResult | null
  ```
- **Sorting & Tie-Breaking Rules**:
  1. Calculate candidate metrics for each business ($L \to L + 1$).
  2. If `affordableOnly: true`, filter out candidates where $\text{upgradeCost} > \text{playerCash}$.
  3. Sort candidates:
     - **Primary Criterion**: `paybackPeriodSeconds ASC` (or equivalently `marginalRoi DESC`).
     - **Secondary Tie-Breaker**: `upgradeCost ASC` (lower upfront cost preferred if break-even time is tied).
     - **Tertiary Tie-Breaker**: `slug ASC` (alphabetical stability).
  4. Return highest-ranked candidate or `null` if empty.

#### 2.3 `formatCompactNumber` Specification
- **Requirements & Range**:
  - Validated from $0$ up to $10^{15}$ (1 Quadrillion) without precision loss.
  - Suffix mapping:
    - $[0, 10^3)$: raw integer or float (e.g. `0`, `450`, `999`)
    - $[10^3, 10^6)$: `'K'` (Thousands)
    - $[10^6, 10^9)$: `'M'` (Millions)
    - $[10^9, 10^{12})$: `'B'` (Billions)
    - $[10^{12}, 10^{15})$: `'T'` (Trillions)
    - $[10^{15}, 10^{18})$: `'Q'` or `'Qa'` (Quadrillions)
- **Formatting Rules**:
  - Number of decimals: default 1 decimal place (e.g. `1.2K`, `3.5M`, `12.8B`, `4.5T`).
  - Trailing zero trimming: trim `.0` when whole (e.g. `1K` instead of `1.0K` if specified, or consistent 1 decimal).
  - Rollover protection: if `999,999` rounds to `1000.0K`, escalate tier cleanly to `1.0M`.
  - Type support: `number | bigint | string`. BigInt avoids IEEE 754 precision degradation at $10^{15}$.

---

### 3. Requirement R3: Deterministic Economy Simulation Harness

#### 3.1 Pacing Mathematics & Inflation Control
- **Cost Escalation**:
  $$C(L) = \text{round}(C_0 \times 1.18^{L-1})$$
- **Production Escalation**:
  $$P(L) = P_0 \times L \times 1.07^{L-1} \times M(L)$$
- **Growth Ratio**:
  $$\frac{C(L+1) / C(L)}{P(L+1) / P(L)} \approx \frac{1.18}{1.07 \times \frac{L+1}{L}} \approx \frac{1.18}{1.07} \approx 1.1028$$
  Except at discrete milestone levels (10, 25, 50, 100), upgrade costs grow $\approx 10.3\%$ faster than production per level!
  This mathematical property ensures:
  1. Exponential runaway is impossible.
  2. Numbers naturally decelerate and stay within $[0, 10^{15}]$ across a full 30-day season.
  3. Milestone breakthroughs act as exciting progression spikes without destabilizing the global economy.

#### 3.2 Simulation Engine Architecture (`simulateProgression`)
```typescript
export type SimulationStrategy =
  | 'optimal_roi'     // Always buy highest marginal ROI / shortest payback
  | 'cheapest'        // Always buy cheapest available upgrade
  | 'balanced'        // Keep all business levels roughly equal
  | 'offline_casual'; // Check in every 4h or 12h, claim & reinvest

export interface SimulationOptions {
  readonly strategy: SimulationStrategy;
  readonly durationSeconds: number; // 3600, 86400, 604800, 2592000
  readonly starterCash?: number; // 100 or 600
  readonly hasConveniencePass?: boolean; // false = 14400s (4h), true = 43200s (12h)
  readonly checkInIntervalSeconds?: number; // default 14400 (4h)
  readonly config?: Partial<EconomyConfig>;
}

export interface BusinessProgressionSnapshot {
  readonly slug: string;
  readonly finalLevel: number;
  readonly unlockedAtSecond: number | null;
  readonly totalSpentOnUpgrades: number;
}

export interface SimulationResult {
  readonly durationSeconds: number;
  readonly strategy: SimulationStrategy;
  readonly hasConveniencePass: boolean;
  readonly finalCashBalance: number;
  readonly totalCashGenerated: number;
  readonly finalProductionPerSecond: number;
  readonly totalUpgradesPurchased: number;
  readonly businesses: Record<string, BusinessProgressionSnapshot>;
  readonly timeToUnlockSeconds: {
    readonly street_stand: number | null;
    readonly cafe: number | null;
    readonly delivery_hub: number | null;
    readonly factory: number | null;
    readonly tech_company: number | null;
    readonly global_holding: number | null;
  };
  readonly offlineWaste: {
    readonly wastedSeconds: number;
    readonly wastedCash: number;
  };
}
```

#### 3.3 Benchmark Time Horizons & Acceptance Targets
| Horizon | Duration | Free Tier (4h Cap) Projection | Convenience Pass (12h Cap) Projection | Pacing Verification Target |
|---|---|---|---|---|
| **1 Hour** | 3,600s | Street Stand Lvl 6–9, Cafe unlock in reach ($\approx 2.5$K Cash) | Street Stand Lvl 6–9, Cafe unlock in reach | Immediate active engagement; zero deadlock |
| **24 Hours** | 86,400s | Street Stand Lvl 25+, Cafe Lvl 10+, Delivery Hub unlocked ($\approx 25$K) | Delivery Hub Lvl 10+, $\approx 2.5\times$ more cash earned if check-in $\ge 8$h | Delivery Hub accessible to active/retained D1 users |
| **7 Days** | 604,800s | Delivery Hub Lvl 25+, Factory unlocked ($\approx 250$K) | Factory Lvl 15+, Tech Co approached ($\approx 1.5$M Cash) | Mid-game transition; Factory milestone reached |
| **30 Days** | 2,592,000s | Factory Lvl 25+, Tech Co unlocked ($\approx 3$M), Global Holding approached | Tech Co Lvl 25+, Global Holding unlocked ($\approx 50$M), prestige tier | Late-game aspirational goals achieved without inflation |

#### 3.4 Convenience Pass Multiplier Analysis (4h vs 12h Cap)
For a player checking in every 12 hours (e.g. morning and evening):
- **Free Player (4h cap)**:
  - Active earning time: $4 \text{h} \times 2 = 8 \text{h}$ per day.
  - Wasted offline time: $8 \text{h} \times 2 = 16 \text{h}$ per day (66.7% income lost).
- **Pass Holder (12h cap)**:
  - Active earning time: $12 \text{h} \times 2 = 24 \text{h}$ per day.
  - Wasted offline time: $0 \text{h}$ (0% income lost).
- **Ratio**: Pass provides $24 / 8 = 3.0\times$ effective daily income for this player archetype, strictly through offline convenience without touching base production formulas ($1.0\times$ SRU, anti-P2W compliant).

---

### 4. Requirement R4: API & Shared DTO Upgrades

#### 4.1 Upgraded `PlayerBusiness` DTO
In `packages/shared/src/index.ts`:
```typescript
export const playerBusinessSchema = z.object({
  slug: z.string(),
  name: z.string(),
  level: z.number().int().nonnegative(),
  baseCost: z.number().positive(),
  baseIncome: z.number().positive(),
  upgradeCost: z.number().int().positive(),
  productionPerSecond: z.number().nonnegative(),
  lastClaimAt: z.iso.datetime(),
  // Upgraded ROI & Financial Analytics Fields:
  paybackPeriodSeconds: z.number().nonnegative().or(z.literal(Infinity)).nullable(),
  marginalRoi: z.number().nonnegative(),
  nextLevelProductionPerSecond: z.number().nonnegative(),
});
export type PlayerBusiness = z.infer<typeof playerBusinessSchema>;
```

#### 4.2 Economy Recommendation Schema & API Contract
```typescript
export const optimalUpgradeRecommendationSchema = z.object({
  businessSlug: z.string(),
  businessName: z.string(),
  currentLevel: z.number().int().nonnegative(),
  nextLevel: z.number().int().positive(),
  upgradeCost: z.number().int().positive(),
  currentProductionPerSecond: z.number().nonnegative(),
  nextProductionPerSecond: z.number().nonnegative(),
  deltaProductionPerSecond: z.number().nonnegative(),
  paybackPeriodSeconds: z.number().nonnegative().or(z.literal(Infinity)),
  marginalRoi: z.number().nonnegative(),
  canAfford: z.boolean(),
});
export type OptimalUpgradeRecommendation = z.infer<
  typeof optimalUpgradeRecommendationSchema
>;

export const economyRoiResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  currentTotalProductionPerSecond: z.number().nonnegative(),
  playerCash: z.number().int().nonnegative(),
  recommendedUpgrade: optimalUpgradeRecommendationSchema.nullable(),
  businesses: z.array(playerBusinessSchema),
  multipliers: z.object({
    offlineCapSeconds: z.number().int().positive(),
    upgradeCostGrowth: z.number().positive(),
    productionLevelGrowth: z.number().positive(),
    hasConveniencePass: z.boolean(),
  }),
});
export type EconomyRoiResponse = z.infer<typeof economyRoiResponseSchema>;
```

#### 4.3 Endpoint Specifications
1. **`GET /economy/roi` (and `/api/economy/roi`)**:
   - Headers: `Cookie: sid=<session_id>` or `Authorization: Bearer <session_id>`
   - Status: 200 OK
   - Response Body: `EconomyRoiResponse`
   - Errors:
     - 401 Unauthorized: Session missing or expired
     - 403 Forbidden: Account banned or suspended
2. **`GET /economy/simulation` (and `/api/economy/simulation`)**:
   - Query Params:
     - `durationSeconds`: optional number (default 86400, max 2592000)
     - `strategy`: optional string enum (default `optimal_roi`)
   - Status: 200 OK
   - Response Body: Returns deterministic simulation metrics comparing Free vs Pass tiers.

---

### 5. Requirement R5: Strict Domain Boundaries (Astra 6.0)

| Workspace Domain | Restriction Level | Allowed Activities | Prohibited Activities |
|---|---|---|---|
| `apps/web/` | **STRICTLY OFF-LIMITS** | None | No React screens, no CSS styles, no UI components, no HTML modification |
| Anti-Cheat / Anti-Fraud | **STRICTLY OFF-LIMITS** | Read-only inspection of schemas | No alteration of risk scoring, Sybil clustering, bot heuristics, or penetration tests |
| `packages/game-core/` | **UNRESTRICTED** | Add `starter.ts`, `roi.ts`, `simulation.ts`, unit tests | Do not introduce side-effects, network calls, or non-deterministic Math.random |
| `packages/shared/` | **UNRESTRICTED** | Extend `playerBusinessSchema`, add `economyRoiResponseSchema` | Do not break existing backward compatibility for health or auth endpoints |
| `supabase/migrations/` | **UNRESTRICTED** | Add migration for starter balance default, trigger, and RPC | Do not alter existing table structures without `IF NOT EXISTS` |
| `apps/api/` | **UNRESTRICTED** | Add `src/economy/routes.ts`, `store.ts`, register in `src/index.ts` | Do not modify auth crypto validation or rate limiting logic |

---

## Verification & Quality Gates

To independently verify implementation of these specifications:
1. **Unit Test Suite**:
   `pnpm test`
   - Assert all 137 existing tests remain 100% green.
   - Assert new formula tests cover:
     - `calculatePaybackPeriodSeconds`: unlock values, zero cost, non-positive delta, milestone jump.
     - `calculateOptimalNextUpgrade`: tie-breaking, affordable filtering, empty lists.
     - `formatCompactNumber`: bounds from $0$ to $10^{15}$, suffix transitions, BigInt values.
     - `simulateProgression`: 1h, 24h, 7d, 30d deterministic assertions; 4h vs 12h pass comparison.
2. **Database Integration Tests**:
   - PGlite in-memory test asserting new user creation automatically creates `player_balances` with `cash = 100` and all 6 businesses at level 0.
   - Assert referral binding awards +500 Cash additively.
3. **Full Quality Gate Command**:
   `pnpm check`
   - Executes ESLint, Prettier, TypeScript across 4 packages, Vitest test suite, Vite build, and Wrangler deploy dry-run. Exit code must be 0.
