# Handoff Report: Codebase Exploration & Mapping

## 1. Observation

Direct code observations from the workspace:

### 1.1 `packages/game-core`
- **File**: `packages/game-core/src/config.ts`
  - Lines 9–46: `DEFAULT_BUSINESSES` configures 6 businesses:
    - `street_stand`: `baseCost: 100`, `baseIncome: 1`, `order: 1`
    - `cafe`: `baseCost: 2500`, `baseIncome: 12`, `order: 2`
    - `delivery_hub`: `baseCost: 25000`, `baseIncome: 90`, `order: 3`
    - `factory`: `baseCost: 250000`, `baseIncome: 600`, `order: 4`
    - `tech_company`: `baseCost: 3000000`, `baseIncome: 5000`, `order: 5`
    - `global_holding`: `baseCost: 50000000`, `baseIncome: 60000`, `order: 6`
  - Lines 72–94: `DEFAULT_ECONOMY_CONFIG` establishes `upgradeCostGrowth: 1.18`, `productionLevelGrowth: 1.07`, `offlineCapFreeSec: 14400`, `offlineCapPassSec: 43200`.
- **File**: `packages/game-core/src/formulas.ts`
  - Line 11: `calculateUpgradeCost(baseCost: number, currentLevel: number, growthRate = 1.18)`
  - Line 33: `calculateMilestoneMultiplier(level: number)` (2x at 10, 25, 50, 100; +50 levels x1.5)
  - Line 54: `calculateProductionPerSecond(baseIncome: number, level: number, growthRate = 1.07)`
  - Line 68: `calculateTotalProduction(businesses)`
  - Line 86: `calculateOfflineEarnings(productionPerSecond, secondsSinceLastClaim, capSeconds = 14400)`
  - Line 112: `calculateSRU(qap, ...)`
  - Line 130: `calculateReferralWhaleFactor(qualifiedCount, ...)`
- **File**: `packages/game-core/src/referral.ts`
  - Line 48: `export const REFERRAL_STARTER_CASH_BOOST = 500;`
- **Missing functions required by R1, R2, R3**:
  - `getStarterEconomyState()` does not exist in `game-core`.
  - `calculatePaybackPeriodSeconds()`, `calculateOptimalNextUpgrade()`, and `formatCompactNumber()` do not exist.
  - `simulateProgression()` does not exist.

### 1.2 `packages/shared`
- **File**: `packages/shared/src/index.ts`
  - Lines 18–28: `playerBusinessSchema`:
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
    ```
    Currently lacks ROI and payback period fields (`paybackPeriodSeconds`, `marginalRoi`, `nextProductionPerSecond`).
  - Lines 30–37: `playerEconomyStateSchema` references `businesses: z.array(playerBusinessSchema)`.
  - Lines 39–58: `playerStateSchema` contains `game: z.union([z.object({ status: z.literal('not_initialized') }), z.object({ status: z.literal('active'), economy: playerEconomyStateSchema })])`.
  - Lacks DTO schemas for `GET /economy/simulation` or `GET /economy/roi`.

### 1.3 `apps/api`
- **File**: `apps/api/src/index.ts`
  - Mounts 5 route factories: `auth`, `leaderboard`, `shop`, `config`, `analytics`.
  - Zero economy routes (`/economy` or `/business`) are mounted.
- **File**: `apps/api/src/auth/routes.ts`
  - Lines 51–58: `state()` hardcodes `game: { status: 'not_initialized' }`.
- **File**: `apps/api/src/auth/test-db.ts`
  - Lines 16–22: Applies migrations `202609140001` through `202609140005` in PGlite.
  - Intercepts `/rest/v1/rpc/<name>` calls and runs them against PGlite.

### 1.4 `supabase/migrations`
- **File**: `supabase/migrations/202609140002_economy.sql`
  - Line 46: `create table public.player_balances ( user_id uuid primary key references public.users(id) on delete cascade, cash bigint not null default 0 check (cash >= 0), ... )`
  - Line 54: `create table public.player_businesses ( ... level integer not null default 0, ... )`
- **File**: `supabase/migrations/202609140001_auth.sql`
  - Line 68: `insert into public.users ... returning * into v_user;`
  - Neither `202609140001_auth.sql` nor `202609140002_economy.sql` contains a trigger or RPC call to insert into `player_balances` or `player_businesses` on user registration.
  - New users have no `player_balances` record and 0 cash. Unlocking `street_stand` costs 100 Cash (`DEFAULT_BUSINESSES[0].baseCost = 100`), causing an onboarding deadlock if not granted starter Cash.

### 1.5 Test Suites
- Running `pnpm test` executes Vitest v3.2.7 and yields:
  - 17 test files, 137 passed tests, 0 failures (duration ~5.8s).
- Running `pnpm check` executes lint, format:check, typecheck, test, and build with exit code 0.

---

## 2. Logic Chain

1. **Onboarding Deadlock**:
   - `DEFAULT_BUSINESSES[0]` defines `street_stand` with `baseCost = 100`.
   - `player_balances.cash` defaults to `0` and is not populated on user creation in `empire_auth_login`.
   - A newly created user has 0 Cash and 0 businesses, meaning income is 0 Cash/s. Without an external grant, they cannot afford the 100 Cash needed for Street Stand Level 1.
   - Therefore, Requirement R1's instruction to provide 100 starter Cash (or 600 if referred) via `getStarterEconomyState()` in `game-core` and database trigger/RPC initialization directly resolves this progression deadlock.

2. **Payback & ROI Analytics**:
   - Upgrading a business from level $L$ to $L+1$ costs $C = \text{calculateUpgradeCost}(\text{baseCost}, L + 1)$.
   - Current production is $P_{\text{current}} = \text{calculateProductionPerSecond}(\text{baseIncome}, L)$ and next production is $P_{\text{next}} = \text{calculateProductionPerSecond}(\text{baseIncome}, L + 1)$.
   - The marginal production increase is $\Delta P = P_{\text{next}} - P_{\text{current}}$.
   - Payback period is $C / \Delta P$ seconds.
   - `calculateOptimalNextUpgrade` can deterministically compare all 6 businesses and select the minimum payback period (or highest marginal ROI $\Delta P / C$), allowing pure financial recommendations without modifying UI.

3. **Compact Big-Number Formatting**:
   - Idle games quickly exceed standard integer displays.
   - Requirement R2 requires formatting values up to $10^{15}$ (quadrillions: K, M, B, T) cleanly without float rounding anomalies or scientific notation (`1e+15`).

4. **Simulation Harness**:
   - Requirement R3 requires headless deterministic simulations over 1h, 24h, 7d, and 30d with 4h vs 12h offline caps.
   - By implementing pure function `simulateProgression(strategy, durationSeconds, config)`, the pacing curves can be validated automatically in test suites and CLI scripts without side effects.

5. **DTO & Route Integration**:
   - Expanding `playerBusinessSchema` to include ROI metrics satisfies R4.
   - Adding `/economy/roi` and `/economy/simulation` routes to `apps/api` with an `EconomyStore` provides the backend inspection endpoints needed for health analysis.

---

## 3. Caveats

- **Astra 6.0 Boundaries Preserved**: UI/UX components in `apps/web` (React screens, CSS styling) and anti-cheat/anti-fraud algorithms (graph Sybil clustering, bot filtering) must NOT be modified.
- **Backwards Compatibility**: Existing 137 tests must remain passing. Specifically, `apps/api/src/auth/routes.test.ts` expects `/me/state` to return a valid `PlayerState`. If `/me/state` is enriched with active economy state, the schema union in `playerStateSchema` (`not_initialized` vs `active`) must be respected so existing tests are not broken.
- **Migration Numbering**: The next migration should be `202609140006_economy_starter_and_roi.sql` and must be registered in `apps/api/src/auth/test-db.ts` to ensure PGlite loads it during test execution.

---

## 4. Conclusion

The codebase is clean, well-tested, and modular. The 5 areas have been thoroughly surveyed:
1. `packages/game-core`: Core formulas exist, but starter state factory, payback period, optimal upgrade recommendation, compact number formatter, and simulation harness must be added.
2. `packages/shared`: Existing schemas support basic business and economy state, but need ROI fields in `playerBusinessSchema` and DTOs for economy inspection.
3. `apps/api`: Currently lacks an economy route module. Needs `apps/api/src/economy/` (`routes.ts`, `store.ts`) mounted in `index.ts`.
4. `supabase/migrations`: Lacks player starter grant trigger/RPC. A new migration (`202609140006`) is required to guarantee 100 starter Cash (or 600 if referred).
5. Tests: 137 tests are completely green. New unit tests and simulation tests can be added cleanly without breaking existing suites.

All findings and blueprints are documented in:
`c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_codebase_2\analysis.md`.

---

## 5. Verification Method

Independent verification steps:
1. **Run full check suite**:
   ```powershell
   pnpm check
   ```
   Must pass with 0 errors across lint, format:check, typecheck (4 packages), test (137 tests), and build.
2. **Inspect Codebase Mapping Report**:
   Inspect `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_codebase_2\analysis.md`.
3. **Invalidation Conditions**:
   - Any failure or divergence in the 137 existing tests.
   - Any dependency or code modification in `apps/web` or anti-cheat domains (violating Astra 6.0 boundary).
