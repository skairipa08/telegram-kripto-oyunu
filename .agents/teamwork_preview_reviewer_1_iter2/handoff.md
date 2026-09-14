# Handoff Report — Architecture & API Reviewer (Iter 2)

- **Agent**: `teamwork_preview_reviewer_1_iter2` (Architecture & API Reviewer / Adversarial Critic)
- **Recipient**: `parent` (`04028db6-7efd-42ee-9199-6f4ea5547fc5`)
- **Date**: 2026-09-14
- **Working Directory**: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_reviewer_1_iter2`
- **Scope**: Review of Onboarding Starter Balance Flow, Economy Mathematical Balance, ROI DTO Schemas, Simulation Harness, API Endpoints, Database Migration 0006, and Quality Gates.

---

## 1. Observation

1. **Deadlock Elimination & Starter Balances (R1)**:
   - In `packages/game-core/src/starter.ts`: `getStarterEconomyState(false)` returns `{ cash: 100, totalProductionPerSecond: 0, businesses: [...] }` with 6 canonical businesses at level 0. `getStarterEconomyState(true)` returns 600 Cash (100 base + 500 referral boost).
   - In `supabase/migrations/202609140006_economy_starter_and_roi.sql`:
     - Sets default cash in `public.player_balances` to 100.
     - Adds trigger `trigger_new_user_starter_economy` on `public.users` firing after insert, creating `player_balances` (cash 100), `player_businesses` (all 6 at level 0), and an audit entry in `public.reward_ledger` (`reason = 'starter_grant'`).
     - Defines RPCs `empire_init_player_economy` and `empire_economy_get_player_state` with `SECURITY DEFINER` and `set search_path = ''`.
   - In `packages/game-core/src/config.ts`: Street Stand has `baseCost: 100` and `baseIncome: 1`. Thus, a user with 100 starter Cash can immediately unlock Level 1 (1 Cash/s), earning 30 Cash in the first 30 seconds. All 21 tests in `starter-economy-stress.test.ts` pass cleanly.
2. **DTO Schemas & JSON Serialization Flaw (R4)**:
   - In `packages/shared/src/index.ts`:
     - Line 27: `playerBusinessSchema` defines `paybackPeriodSeconds: z.number().nonnegative().or(z.literal(Infinity)).optional()`.
     - Line 42: `optimalUpgradeRecommendationSchema` defines `paybackPeriodSeconds: z.number().nonnegative().or(z.literal(Infinity))`.
   - Direct execution test:
     ```typescript
     const schema = z.object({ payback: z.number().nonnegative().or(z.literal(Infinity)) });
     const json = JSON.stringify({ payback: Infinity }); // produces '{"payback":null}'
     schema.parse(JSON.parse(json)); // THROWS: "Invalid input: expected number, received null"
     ```
   - In ECMA-262 / RFC 8259, `JSON.stringify(Infinity)` serializes to `null`. Over HTTP REST routes (`GET /economy/roi`), when `paybackPeriodSeconds` is `Infinity` (e.g. when delta production $\le 0$), the API sends `null`. Client-side Zod validation against `optimalUpgradeRecommendationSchema` crashes because it does not accept `null` (requires `.nullable()`).
3. **Floating-Point Tie-Breaking Bug in Upgrade Recommendation (R2)**:
   - In `packages/game-core/src/formulas.ts` line 284:
     ```typescript
     if (a.paybackPeriodSeconds !== b.paybackPeriodSeconds) {
       if (!Number.isFinite(a.paybackPeriodSeconds)) return 1;
       if (!Number.isFinite(b.paybackPeriodSeconds)) return -1;
       return a.paybackPeriodSeconds - b.paybackPeriodSeconds;
     }
     ```
   - When evaluating proportional businesses with identical theoretical payback (e.g. `z_biz` with baseCost 200 / baseIncome 2 vs `0_biz` with baseCost 150 / baseIncome 1.5):
     - `z_biz` payback evaluates to `103.50877192982455`.
     - `0_biz` payback evaluates to `103.50877192982456`.
     - The difference is $1.42 \times 10^{-14}$. Because `!==` is an exact float comparison without epsilon tolerance, `a.paybackPeriodSeconds - b.paybackPeriodSeconds` evaluates to non-zero, putting `z_biz` first and completely bypassing secondary tie-breakers (`upgradeCost ASC` and `slug ASC`).
4. **Sub-Epsilon Production Delta in `calculatePaybackPeriodSeconds` (R2)**:
   - In `packages/game-core/src/formulas.ts` line 170:
     ```typescript
     const deltaProduction = nextProduction - currentProduction;
     if (deltaProduction <= 1e-9) {
       return Number.POSITIVE_INFINITY;
     }
     ```
   - For `currentProduction = 10` and `nextProduction = 10 + 1e-9`:
     In IEEE 754 arithmetic, `(10 + 1e-9) - 10` evaluates to `1.000000082740371e-9`, which is strictly greater than `1e-9`. Thus `deltaProduction <= 1e-9` is false, and the function returns `99999991725.96` instead of `Infinity`.
5. **Quality Gates & Test Results**:
   - `pnpm lint`: FAILED with exit code 1 due to unused variables and parsing errors in untracked files (`scripts/stress-math-simulation.ts`, `packages/game-core/src/math-simulation-stress.test.ts`, `.agents/teamwork_preview_reviewer_2_iter2/verify_math.ts`).
   - `pnpm test`: FAILED with exit code 1 (3 failed tests in `math-simulation-stress.test.ts`, 219 passed).
   - Core worker tests: `starter.test.ts` (4/4 passed), `formulas.test.ts` (36/36 passed), `simulation.test.ts` (6/6 passed), `economy/routes.test.ts` (8/8 passed).
6. **Integrity & R5 Boundary Check**:
   - Integrity violation scan: NO hardcoded test mocks, NO fake or dummy implementations found. Game logic is genuinely computed.
   - Domain boundary: `apps/web` has ZERO changes (confirmed via `git status`). Anti-cheat/anti-fraud algorithms have ZERO modifications. R5 boundary is 100% preserved.

---

## 2. Logic Chain

1. **Deadlock Elimination Validation**:
   - The user requested that new players never encounter a 0-cash 0-income deadlock.
   - Worker established both database triggers and pure factory state (`getStarterEconomyState`) ensuring default cash is 100 (+500 for referral).
   - Street Stand unlock costs exactly 100 Cash and provides 1 Cash/s. Therefore, a user can immediately unlock within 30 seconds and generate income. This requirement is mathematically and empirically satisfied.
2. **JSON Wire Incompatibility**:
   - The DTO contract uses `z.literal(Infinity)` in TypeScript schemas.
   - HTTP transport uses standard JSON which has no native representation for `Infinity`. Standard JSON serializes `Infinity` to `null`.
   - When client parses the response, Zod expects `number` or `Infinity`, but receives `null`, resulting in a validation rejection.
   - Mitigation required: In `packages/shared/src/index.ts`, `paybackPeriodSeconds` must accept `null` (e.g. `z.number().nonnegative().or(z.literal(Infinity)).nullable()`) or the API layer must serialize infinite payback as `null` or a sentinel.
3. **Sorting Determinism**:
   - Upgrade candidates sort by payback ASC, then cost ASC, then slug ASC.
   - Due to floating-point rounding errors in floating-point division, identical payback periods differ by machine epsilon.
   - Mitigation required: Use an epsilon tolerance (e.g. `Math.abs(a.paybackPeriodSeconds - b.paybackPeriodSeconds) < 1e-6`) before deciding they are unequal, or round payback to fixed decimal precision (e.g. 4 decimals) during sorting.
4. **Sub-Epsilon Guarding**:
   - Checking `(next - current) <= 1e-9` fails when base numbers are moderate (e.g. 10) due to loss of precision in `10 + 1e-9`.
   - Mitigation required: Use relative epsilon or relax threshold to `1e-7`.
5. **Quality Gate Requirement**:
   - The project acceptance criteria explicitly mandate: `pnpm check executes with exit code 0` and all tests pass.
   - Since `pnpm lint` and `pnpm test` currently fail, the work product cannot be approved until clean.

---

## 3. Caveats

1. **Concurrent Agent Workspace Activity**: Untracked files (`scripts/stress-math-simulation.ts`, `packages/game-core/src/math-simulation-stress.test.ts`, `.agents/teamwork_preview_reviewer_2_iter2/verify_math.ts`) were introduced during iteration 2 by peer agents, causing lint and vitest failures.
2. **Review-Only Constraint**: As a reviewer, I am strictly prohibited from modifying implementation code to fix these issues. These must be resolved by the backend worker.

---

## 4. Conclusion & Verdict

**Verdict**: **REQUEST_CHANGES**

### Summary of Required Fixes:
1. **[Major] Schema Nullability on JSON Wire**:
   In `packages/shared/src/index.ts`, update `playerBusinessSchema` and `optimalUpgradeRecommendationSchema` so that `paybackPeriodSeconds` accepts `null` (`.nullable().optional()` or `.or(z.null())`), because `JSON.stringify(Infinity)` converts to `null` over HTTP.
2. **[Major] Deterministic Multi-Key Tie-Breaking**:
   In `packages/game-core/src/formulas.ts` (`calculateOptimalNextUpgrade`), introduce an epsilon comparison (e.g. `Math.abs(a.paybackPeriodSeconds - b.paybackPeriodSeconds) > 1e-6`) so that floating-point variance does not bypass secondary sorting keys (`cost ASC`, `slug ASC`).
3. **[Minor] Sub-Epsilon Precision in Payback Calculation**:
   In `packages/game-core/src/formulas.ts` (`calculatePaybackPeriodSeconds`), account for IEEE 754 precision loss when `currentProduction` is added to `1e-9`.
4. **[Major] Workspace Quality Gate**:
   Clean up lint/syntax issues in `scripts/stress-math-simulation.ts`, `packages/game-core/src/math-simulation-stress.test.ts`, and test files so that `pnpm check` and `pnpm test` pass with 0 errors across the workspace.

---

## 5. Verification Method

1. **Test JSON Wire Deserialization**:
   ```bash
   npx tsx -e "import { optimalUpgradeRecommendationSchema } from './packages/shared/src/index.ts'; const raw = JSON.stringify({ slug: 'test', name: 'Test', currentLevel: 0, upgradeCost: 100, paybackPeriodSeconds: Infinity, marginalRoi: 0, isAffordable: true }); console.log(optimalUpgradeRecommendationSchema.safeParse(JSON.parse(raw)).success);"
   ```
   *Expected result*: `true` (currently `false` because `Infinity` turns into `null`).
2. **Verify Multi-Key Tie-Breaking**:
   ```bash
   pnpm vitest run packages/game-core/src/math-simulation-stress.test.ts
   ```
   *Expected result*: All tie-breaking and sub-epsilon assertion tests pass.
3. **Run Full Quality Gate**:
   ```powershell
   pnpm check
   ```
   *Expected result*: Exit code 0 (ESLint, Prettier, TypeScript, Vitest, Vite build, Wrangler dry-run).
4. **Verify Zero Deadlock**:
   ```powershell
   pnpm vitest run apps/api/src/economy/starter-economy-stress.test.ts
   ```
   *Expected result*: All 21 onboarding starter tests pass.
