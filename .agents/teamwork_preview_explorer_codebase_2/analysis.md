# Detailed Codebase Architecture & Economy Mapping Report

## Executive Summary

This report surveys the Project Empire monorepo to prepare for the implementation of the Economy Mathematics, Onboarding Starter Grants, ROI Payback Models, and Simulation Tooling requested in `ORIGINAL_REQUEST.md` (section `## 2026-09-14T12:46:12Z`).

The monorepo is currently in a 100% green state (`pnpm check` passes with 0 errors across ESLint, Prettier, TypeScript for 4 packages, Vitest 137/137 tests, Vite build, and Wrangler dry-run).

Below is the comprehensive survey across the 5 target domains.

---

## 1. `packages/game-core` Mapping & Gap Analysis

### 1.1 Directory & Module Structure
- **Path**: `packages/game-core/`
- **Package Manifest**: `packages/game-core/package.json` (`@empire/game-core`, pure ES module, zero external npm dependencies, export `./src/index.ts`).
- **Files**:
  - `src/config.ts`: Business configs and default economy parameters.
  - `src/formulas.ts`: Deterministic economy formulas.
  - `src/missions.ts`: 9 canonical missions, streak cycle, daily mission selection.
  - `src/referral.ts`: Referral tiers, milestone qualification, whale factor.
  - `src/leaderboard.ts`: Deterministic tie-breaking, keyset cursor pagination, rank pinning.
  - `src/monetization.ts`: Convenience pass calculations (4h vs 12h offline cap), anti-P2W safety.
  - `src/remote-config.ts`: Safe fallback hierarchy (DB -> memory defaults), feature flag checks.
  - `src/analytics.ts`: Section 18 canonical event validation, cohort retention (D1, D2, D7), activation models.
  - `src/index.ts`: Barrel export.

### 1.2 Existing Business Configurations (`packages/game-core/src/config.ts`)
The 6 canonical businesses are defined in `DEFAULT_BUSINESSES` (lines 9–46):
| Order | Slug (`id`) | Name | Base Cost (`baseCost`) | Base Income (`baseIncome`) | Notes |
|---|---|---|---|---|---|
| 1 | `street_stand` | Street Stand | 100 | 1 | Starter tier. Unlocks at 100 Cash. |
| 2 | `cafe` | Cafe | 2,500 | 12 | Early tier. |
| 3 | `delivery_hub` | Delivery Hub | 25,000 | 90 | Mid tier. |
| 4 | `factory` | Factory | 250,000 | 600 | Mid-late industrial tier. |
| 5 | `tech_company` | Tech Company | 3,000,000 | 5,000 | Advanced tech tier. |
| 6 | `global_holding` | Global Holding | 50,000,000 | 60,000 | Late-game conglomerate tier. |

`DEFAULT_ECONOMY_CONFIG` (lines 72–94) establishes:
- `upgradeCostGrowth`: `1.18` (18% cost increase per level)
- `productionLevelGrowth`: `1.07` (7% compound base production growth per level)
- `offlineCapFreeSec`: `14400` (4 hours = 14,400 seconds)
- `offlineCapPassSec`: `43200` (12 hours = 43,200 seconds)
- `seasonSruBase`: `500`, `seasonSruMin`: `100`, `seasonSruMax`: `500`

### 1.3 Existing Mathematical Formulas (`packages/game-core/src/formulas.ts`)
- **`calculateUpgradeCost(baseCost, currentLevel, growthRate = 1.18)`** (lines 11–18):
  $$\text{cost} = \begin{cases} \text{round}(baseCost) & \text{if } currentLevel \le 0 \\ \text{round}(baseCost \times growthRate^{currentLevel - 1}) & \text{if } currentLevel \ge 1 \end{cases}$$
  *Note*: Level 0 to 1 costs `baseCost`. Upgrading from Level 1 to 2 costs `baseCost * 1.18^0 = baseCost`. Upgrading from Level 2 to 3 costs `baseCost * 1.18^1`.
- **`calculateMilestoneMultiplier(level)`** (lines 33–48):
  - Levels 1..9: 1x
  - Levels 10..24: 2x
  - Levels 25..49: 4x
  - Levels 50..99: 8x
  - Levels 100..149: 16x
  - Levels $\ge 150$: $16 \times 1.5^{\lfloor (level - 100) / 50 \rfloor}$ (e.g. 150..199: 24x; 200..249: 36x; 250..299: 54x).
- **`calculateProductionPerSecond(baseIncome, level, growthRate = 1.07)`** (lines 54–63):
  $$\text{prod} = baseIncome \times level \times 1.07^{level - 1} \times \text{calculateMilestoneMultiplier}(level)$$
  Returns 0 if $level \le 0$.
- **`calculateTotalProduction(businesses)`** (lines 68–80):
  Sums individual production rates across all businesses.
- **`calculateOfflineEarnings(productionPerSecond, secondsSinceLastClaim, capSeconds = 14400)`** (lines 86–105):
  $$\text{effectiveSeconds} = \min(\max(0, \lfloor elapsed \rfloor), capSeconds)$$
  $$\text{earned} = \lfloor productionPerSecond \times effectiveSeconds \rfloor$$
- **`calculateSRU(qap, ...)`** (lines 112–123):
  Emissions scaling with QAP: $\text{round}(500 \times (\max(QAP, 100) / 100)^{-0.10})$, clamped between 100 and 500.
- **`calculateReferralWhaleFactor(qualifiedCount, ...)`** (lines 130–138):
  Whale dampening for referrals over 20: $\max(0.25, \sqrt{20 / Q})$.

### 1.4 Starter State Constants in Code
- In `packages/game-core/src/referral.ts` line 48:
  `export const REFERRAL_STARTER_CASH_BOOST = 500;`
  Currently, this constant exists but is not integrated into an initialization factory or database trigger.
- Street Stand baseCost is 100 Cash.

### 1.5 Existing Test Suites in `packages/game-core`
There are 8 test files in `packages/game-core/src/`:
1. `formulas.test.ts` (17 tests)
2. `leaderboard.test.ts` (9 tests)
3. `leaderboard-stress.test.ts` (6 tests)
4. `missions.test.ts` (11 tests)
5. `referral.test.ts` (15 tests)
6. `monetization.test.ts` (6 tests)
7. `remote-config.test.ts` (6 tests)
8. `analytics.test.ts` (6 tests)
*Total*: 76 tests, all passing.

### 1.6 Gap Analysis against New Requirements (R1, R2, R3)
1. **`getStarterEconomyState()` (R1)**:
   - *Status*: Missing.
   - *Need*: Pure function in `packages/game-core` returning default state:
     - `cash`: 100 (or 600 with `isReferred: true`).
     - `seasonPoints`: 0.
     - `businesses`: List of 6 canonical businesses initialized (either Street Stand unlocked at Level 1 or at Level 0 with 100 cash to unlock). Note: R1 states: *"Provide a default starter balance (100 Cash) on first player creation so the player can immediately unlock Street Stand (Level 1, 1 Cash/s) and activate their core idle loop within 30 seconds."*
     - `offlineCapSeconds`: 14400 (4h).
2. **`calculatePaybackPeriodSeconds(upgradeCost, currentProduction, nextProduction)` (R2)**:
   - *Status*: Missing.
   - *Need*:
     $$\Delta P = nextProduction - currentProduction$$
     $$\text{Payback Period (s)} = \begin{cases} \infty \text{ or safe ceiling} & \text{if } \Delta P \le 0 \\ \frac{upgradeCost}{\Delta P} & \text{if } \Delta P > 0 \end{cases}$$
3. **`calculateOptimalNextUpgrade(businesses, playerCash)` (R2)**:
   - *Status*: Missing.
   - *Need*: Pure recommendation algorithm evaluating all available upgrades across the 6 businesses, filtering by afford-ability or rank-ordering by lowest payback period (or highest marginal ROI $\Delta P / \text{cost}$).
4. **`formatCompactNumber(value)` (R2)**:
   - *Status*: Missing.
   - *Need*: Pure formatting function supporting 0 up to $10^{15}$ (K, M, B, T, etc.) with clean precision (e.g. 1.2K, 3.5M, 12.8B, 4.5T) avoiding floating point precision glitches or scientific notation.
5. **`simulateProgression(strategy, durationSeconds, config)` (R3)**:
   - *Status*: Missing.
   - *Need*: Deterministic offline simulation engine modeling intervals: 1h (3,600s), 24h (86,400s), 7d (604,800s), 30d (2,592,000s).
   - Metrics tracked: total Cash earned, levels per business, time-to-unlock each tier, impact of 4h vs 12h offline cap.

---

## 2. `packages/shared` Mapping & Gap Analysis

### 2.1 File & Module Structure
- **Path**: `packages/shared/`
- **Package Manifest**: `packages/shared/package.json` (`@empire/shared`, depends on `zod: ^4.1.12`, exports `./src/index.ts`).
- **Files**: `src/index.ts` (533 lines).

### 2.2 Existing DTOs and Schemas for Economy & Player
In `packages/shared/src/index.ts`:
- **`playerBusinessSchema`** (lines 18–28):
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
  });
  export type PlayerBusiness = z.infer<typeof playerBusinessSchema>;
  ```
- **`playerEconomyStateSchema`** (lines 30–37):
  ```typescript
  export const playerEconomyStateSchema = z.object({
    cash: z.number().int().nonnegative(),
    seasonPoints: z.number().int().nonnegative(),
    totalProductionPerSecond: z.number().nonnegative(),
    offlineCapSeconds: z.number().int().positive(),
    businesses: z.array(playerBusinessSchema),
  });
  export type PlayerEconomyState = z.infer<typeof playerEconomyStateSchema>;
  ```
- **`playerStateSchema`** (lines 39–58):
  ```typescript
  export const playerStateSchema = z.object({
    apiVersion: z.literal('v1'),
    user: z.object({
      id: z.uuid(),
      telegramId: z.string().regex(/^[1-9][0-9]*$/),
      firstName: z.string(),
      username: z.string().nullable(),
      language: z.string().nullable(),
    }),
    session: z.object({ expiresAt: z.iso.datetime() }),
    game: z.union([
      z.object({ status: z.literal('not_initialized') }),
      z.object({
        status: z.literal('active'),
        economy: playerEconomyStateSchema,
      }),
    ]),
  });
  export type PlayerState = z.infer<typeof playerStateSchema>;
  ```
- **Cash Claim Schemas** (lines 60–74):
  - `claimCashRequestSchema`: `{ requestId: z.uuid() }`
  - `claimCashResponseSchema`: `{ apiVersion: 'v1', claimedAmount, newBalance, claimedAt, isCapped }`
- **Business Upgrade Schemas** (lines 76–94):
  - `upgradeBusinessRequestSchema`: `{ businessSlug, requestId: z.uuid() }`
  - `upgradeBusinessResponseSchema`: `{ apiVersion: 'v1', business: playerBusinessSchema, remainingCash, totalProductionPerSecond }`

### 2.3 Gap Analysis against R4
1. **ROI & Payback Metrics in `PlayerBusiness` DTO**:
   - Currently, `playerBusinessSchema` only contains `upgradeCost` and `productionPerSecond`.
   - *Requirement R4*: Expose ROI / payback metrics in `PlayerBusiness` DTO.
   - Recommended extension:
     ```typescript
     paybackPeriodSeconds: z.number().nullable().optional(),
     marginalRoi: z.number().nullable().optional(),
     nextProductionPerSecond: z.number().optional(),
     ```
2. **Economy Simulation / ROI Inspection DTO**:
   - *Requirement R4*: Add schemas for `GET /economy/simulation` or `GET /economy/roi`.
   - Recommended schema:
     ```typescript
     export const economyRoiRecommendationSchema = z.object({
       businessSlug: z.string(),
       name: z.string(),
       currentLevel: z.number().int().nonnegative(),
       upgradeCost: z.number().int().positive(),
       currentProduction: z.number().nonnegative(),
       nextProduction: z.number().nonnegative(),
       deltaProduction: z.number().nonnegative(),
       paybackPeriodSeconds: z.number(),
       isAffordable: z.boolean(),
     });
     export const economyRoiResponseSchema = z.object({
       apiVersion: z.literal('v1'),
       totalProductionPerSecond: z.number().nonnegative(),
       currentCash: z.number().int().nonnegative(),
       optimalUpgrade: economyRoiRecommendationSchema.nullable(),
       recommendations: z.array(economyRoiRecommendationSchema),
     });
     ```

---

## 3. `apps/api` Mapping & Gap Analysis

### 3.1 Architecture
- **Framework**: Hono running on Cloudflare Workers (Edge runtime).
- **Entry point**: `apps/api/src/index.ts`.
- **Wrangler configuration**: `apps/api/wrangler.jsonc` (Compatibility date: 2026-03-01).

### 3.2 Current Mounted Routes (`apps/api/src/index.ts`)
| Prefix / Route | Controller / Route Factory | Store Dependency | Status |
|---|---|---|---|
| `GET /health`, `GET /api/health` | `healthHandler` | None | Active |
| `POST /auth/telegram`, `GET /me/state`, `POST /auth/logout` | `createAuthRoutes` | `AuthStore` | Active |
| `GET /leaderboard`, `POST /admin/seasons/:id/freeze` | `createLeaderboardRoutes` | `LeaderboardStore` | Active |
| `GET /shop`, `POST /shop/invoice`, `POST /telegram/webhook` | `createShopRoutes` | `ShopStore` | Active |
| `GET /config/public`, `POST /admin/config` | `createConfigRoutes` | `ConfigStore` | Active |
| `POST /analytics/events`, `GET /analytics/metrics` | `createAnalyticsRoutes` | `AnalyticsStore` | Active |

### 3.3 Current Observation on Player / Economy Routes
1. **No Economy Routes exist in `apps/api`**:
   - There is currently no `economy` folder in `apps/api/src/`.
   - `createApp` does not mount any `/economy` or `/business` routes.
2. **`/me/state` returns `game: { status: 'not_initialized' }`**:
   - In `apps/api/src/auth/routes.ts` lines 51–58:
     ```typescript
     function state(session: StoredSession): PlayerState {
       return {
         apiVersion: 'v1',
         user: session.user,
         session: { expiresAt: new Date(session.expiresAt * 1000).toISOString() },
         game: { status: 'not_initialized' },
       };
     }
     ```
   - When a user logs in, their economy state is never loaded or initialized by the API layer.
3. **PGlite Integration in `apps/api/src/auth/test-db.ts`**:
   - Tests execute against an in-memory PostgreSQL instance created with PGlite (`@electric-sql/pglite` v0.5.8).
   - In `createTestDatabase()`, all migration files from `supabase/migrations/` are applied sequentially.
   - The test harness intercepts `fetch` calls to `/rest/v1/rpc/<name>` and translates them to `SELECT public.<name>($...)`.
   - Any new RPC functions or endpoints for economy will need corresponding cases in `test-db.ts`.

---

## 4. `supabase/migrations` Mapping & Gap Analysis

### 4.1 Migration File Inventory
| Migration File | Size | Contents |
|---|---|---|
| `202609140001_auth.sql` | 5.2 KB | `users`, `auth_sessions`, RPCs: `empire_auth_login`, `empire_auth_session`, `empire_auth_logout`. |
| `202609140002_economy.sql` | 4.5 KB | `economy_config` (seeds), `businesses` (6 canonical businesses), `player_balances`, `player_businesses`, `reward_ledger`. |
| `202609140003_seasons_missions.sql` | 5.1 KB | `seasons` (Genesis Season 1), `season_scores`, `missions` (9 missions), `mission_instances`, `player_streaks`. |
| `202609140004_referrals.sql` | 2.2 KB | `users.referral_code`, `referrals`, `referral_events`. |
| `202609140005_step7_to_11_backend.sql` | 20.2 KB | `season_archives`, `purchases`, `player_entitlements`, `admin_audit_logs`, `analytics_events`, `daily_metrics`, and 12 RPC functions. |

### 4.2 Onboarding & Starter Balance State
In `202609140002_economy.sql`:
```sql
create table public.player_balances (
  user_id uuid primary key references public.users(id) on delete cascade,
  cash bigint not null default 0 check (cash >= 0),
  season_points bigint not null default 0 check (season_points >= 0),
  updated_at timestamptz not null default now()
);

create table public.player_businesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id),
  level integer not null default 0 check (level >= 0),
  last_claim_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, business_id)
);
```

### 4.3 Critical Gaps in Database Onboarding (R1)
1. **No Trigger or RPC on User Creation**:
   - Currently, when `empire_auth_login` inserts a new user into `public.users`, **no rows** are inserted into `player_balances`, `player_businesses`, `player_streaks`, or `season_scores`.
   - If a row in `player_balances` is created manually or by default, its `cash` defaults to `0`.
2. **Zero-Income Deadlock**:
   - If a new player has 0 Cash and 0 Businesses, they cannot unlock Street Stand (which costs 100 Cash).
   - Without starter cash, the player is locked in a zero-income deadlock.
3. **Database Requirements from R1**:
   - Default starter balance: 100 Cash on first player creation.
   - Referral starter boost: +500 Cash (total 600 Cash) if referral is bound.
   - Either an automatic database trigger `AFTER INSERT ON public.users` OR an explicit idempotent RPC (e.g. `empire_player_init_economy(p_user_id, p_referral_code)`) ensuring `player_balances` is initialized with 100 (or 600) Cash and `player_businesses` has all 6 business rows initialized (with Street Stand at level 1 or ready to unlock).

---

## 5. Test Suites Across the Monorepo

### 5.1 Test Execution Architecture
- **Root test command**: `pnpm test` -> `vitest run`
- **Config**: Default Vitest runner discovery (`vitest.config` not required; discovers all `*.test.ts` files).
- **Execution Time**: ~5.8 to 6.1 seconds for 137 tests.

### 5.2 Test Breakdown (137 tests across 17 files)
```
✓ packages/game-core/src/formulas.test.ts (17 tests)
✓ packages/game-core/src/referral.test.ts (15 tests)
✓ packages/game-core/src/missions.test.ts (11 tests)
✓ packages/game-core/src/leaderboard.test.ts (9 tests)
✓ packages/game-core/src/monetization.test.ts (6 tests)
✓ packages/game-core/src/remote-config.test.ts (6 tests)
✓ packages/game-core/src/analytics.test.ts (6 tests)
✓ packages/game-core/src/leaderboard-stress.test.ts (6 tests)
    [Subtotal: 8 test files, 76 tests in game-core]

✓ apps/web/src/auth/auth-policy.test.ts (16 tests)
    [Subtotal: 1 test file, 16 tests in web]

✓ apps/api/src/auth/routes.test.ts (14 tests)
✓ apps/api/src/auth/crypto.test.ts (8 tests)
✓ apps/api/src/shop/routes.test.ts (6 tests)
✓ apps/api/src/leaderboard/routes.test.ts (5 tests)
✓ apps/api/src/shop/payment-stress.test.ts (4 tests)
✓ apps/api/src/config/routes.test.ts (3 tests)
✓ apps/api/src/analytics/routes.test.ts (3 tests)
✓ apps/api/src/index.test.ts (2 tests)
    [Subtotal: 8 test files, 45 tests in api]

Total: 17 test files, 137 tests.
```

### 5.3 Monorepo Quality Gate Command (`pnpm check`)
The root `package.json` defines `pnpm check` as:
`pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build`
- `pnpm lint`: ESLint with `@typescript-eslint` across all files.
- `pnpm format:check`: Prettier verification.
- `pnpm typecheck`: `tsc -p tsconfig.json` across 4 packages (`game-core`, `shared`, `api`, `web`).
- `pnpm test`: Vitest running all 137 tests.
- `pnpm build`: Vite build for `apps/web` and Wrangler deploy dry-run for `apps/api`.

---

## 6. Synthesis & Proposed Implementation Blueprint

To satisfy all requirements of `ORIGINAL_REQUEST.md` (## 2026-09-14T12:46:12Z) while strictly honoring the Astra 6.0 boundary (No UI/UX, no anti-cheat modifications):

### Step 1: `packages/game-core`
1. In `packages/game-core/src/formulas.ts`:
   - Add `calculatePaybackPeriodSeconds(upgradeCost: number, currentProduction: number, nextProduction: number): number`
   - Add `calculateOptimalNextUpgrade(businesses, playerCash)`
   - Add `formatCompactNumber(value: number): string`
   - Add `getStarterEconomyState(options?: { isReferred?: boolean })`
2. Create `packages/game-core/src/simulation.ts`:
   - Implement `simulateProgression(strategy, durationSeconds, config)`
   - Model 1h, 24h, 7d, and 30d progression scenarios with 4h vs 12h offline caps.
3. Export new functions in `packages/game-core/src/index.ts`.
4. Add comprehensive unit tests in:
   - `packages/game-core/src/formulas.test.ts` (100% coverage for payback, ROI, compact number formatting).
   - `packages/game-core/src/simulation.test.ts` (deterministic verification of 1h, 24h, 7d simulation runs).

### Step 2: `packages/shared`
1. In `packages/shared/src/index.ts`:
   - Enhance `playerBusinessSchema` to include ROI metrics (`paybackPeriodSeconds`, `marginalRoi`, `nextProductionPerSecond`).
   - Add `economyRoiResponseSchema` and types for the simulation/ROI endpoint.

### Step 3: `supabase/migrations`
1. Create new migration (e.g. `202609140006_economy_starter_and_roi.sql`):
   - Trigger or RPC `empire_init_player_economy` to grant 100 Cash starter balance (or 600 Cash if referred).
   - Initialize `player_balances` and `player_businesses` records on user signup so players start with working economy.
   - Add RPC `empire_economy_get_state(p_user_id uuid)` and `empire_economy_upgrade_business(p_user_id uuid, p_slug text)`.

### Step 4: `apps/api`
1. Create `apps/api/src/economy/`:
   - `store.ts`: `EconomyStore` interface and `SupabaseEconomyStore` implementation.
   - `routes.ts`: `createEconomyRoutes` with `GET /economy/roi`, `GET /economy/simulation`, `POST /economy/claim`, `POST /economy/upgrade`.
2. Update `apps/api/src/index.ts` to mount economy routes.
3. Update `apps/api/src/auth/test-db.ts` to include migration `202609140006` and mock economy RPCs in PGlite.
4. Add integration tests in `apps/api/src/economy/routes.test.ts`.

### Step 5: `scripts/`
1. Add `scripts/simulate-economy.ts` as an executable CLI tool to run headless simulations.
