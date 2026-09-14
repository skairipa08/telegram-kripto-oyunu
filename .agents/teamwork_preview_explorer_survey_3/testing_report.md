# Testing and Validation Infrastructure Survey Report
**Project Empire Monorepo**  
**Date:** 2026-09-14  
**Author:** teamwork_preview_explorer_survey_3  
**Status:** Complete  

---

## 1. Executive Summary

This report delivers a thorough investigation into the testing, validation, and build infrastructure of the Project Empire monorepo. It details all `package.json` scripts across the root and workspace packages, deconstructs the `pnpm check` pipeline command-by-command, catalogs existing Vitest test files and mocking patterns (including the in-process `@electric-sql/pglite` database engine), and establishes the exact criteria needed to ensure 100% clean passes on all quality gates during the upcoming implementation of Steps 7, 8, 9, and 11 (Leaderboards, Monetization, Remote Config, and Analytics).

### Key Takeaways:
- **Baseline Health:** 7 test suites containing 83 tests currently pass in ~3.0s (`vitest run`). Full TypeScript compilation passes across all 4 workspace packages with strict flags. API Wrangler dry-run deployment and Web Vite production build both succeed cleanly.
- **Prettier Catch:** `pnpm format:check` currently flags untracked metadata files in `.agents/` and root `ORIGINAL_REQUEST.md` because `.prettierignore` lacks `.agents` and `ORIGINAL_REQUEST.md`. All tracked production and test code is 100% Prettier compliant.
- **Database Testing Engine:** API tests utilize an in-memory `@electric-sql/pglite` PostgreSQL WASM instance that runs real Supabase SQL migrations and PostgREST RPC mocks without external database dependencies.
- **Strict TypeScript Regime:** `tsconfig.base.json` enforces `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, and `strict: true`. Every array access or dictionary lookup is typed `T | undefined`.

---

## 2. Monorepo Package Inventory & `package.json` Scripts

The repository uses **pnpm 9.1.0** workspace mode under **Node.js >= 24.0.0**, configured via `pnpm-workspace.yaml`:
```yaml
packages:
  - apps/*
  - packages/*
```

### 2.1. Root Workspace (`/package.json`)
- **Name:** `project-empire` (private root)
- **Module type:** `"type": "module"` (ESM across whole monorepo)
- **Engines:** `"node": ">=24.0.0"`
- **DevDependencies:**
  - `@electric-sql/pglite`: `^0.5.8` (in-memory Postgres WASM engine for testing)
  - `@eslint/js`: `^10.0.1`
  - `@types/node`: `^24`
  - `eslint`: `^10.10.0`
  - `globals`: `^16.5.0`
  - `prettier`: `^3.6.2`
  - `typescript`: `^5.9.3`
  - `typescript-eslint`: `^8.46.0`
  - `vitest`: `^3.2.4` (currently resolved to `3.2.7`)

| Script | Command | Purpose |
|---|---|---|
| `dev` | `pnpm --parallel --filter @empire/web --filter @empire/api dev` | Runs Vite frontend (`5173`) and Wrangler API (`8787`) concurrently |
| `lint` | `eslint .` | Runs ESLint flat config across entire repository |
| `format` | `prettier --write .` | Formats all files matching Prettier patterns |
| `format:check` | `prettier --check .` | Verifies code formatting without writing |
| `typecheck` | `pnpm -r typecheck` | Executes recursive TypeScript check across all workspace packages |
| `test` | `vitest run` | Runs all Vitest test suites once (non-watch mode) |
| `build` | `pnpm -r build` | Runs recursive build in packages declaring `build` (`apps/api`, `apps/web`) |
| `check` | `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build` | Master CI gate chaining all 5 validation steps |

---

### 2.2. API Application (`apps/api/package.json`)
- **Package Name:** `@empire/api`
- **Dependencies:**
  - `@empire/shared`: `"workspace:*"`
  - `hono`: `^4.10.0` (Cloudflare Workers native HTTP router)
  - `zod`: `^4.1.12`
- **DevDependencies:**
  - `wrangler`: `^4.131.2` (Cloudflare Workers CLI/bundler)

| Script | Command | Purpose |
|---|---|---|
| `dev` | `wrangler dev --ip 127.0.0.1 --port 8787` | Starts local Cloudflare Worker development environment |
| `typecheck` | `tsc -p tsconfig.json` | Typechecks API source files against Worker & ES2022 libs |
| `build` | `wrangler deploy --dry-run --outdir dist` | Bundles worker entrypoint `src/index.ts`, validates bindings, checks size |

*Note:* `@empire/api` currently imports `@empire/shared`. If API handlers directly invoke pure math formulas from `@empire/game-core`, `@empire/game-core: "workspace:*"` must be added to `apps/api/package.json` dependencies.

---

### 2.3. Web Frontend (`apps/web/package.json`)
- **Package Name:** `@empire/web`
- **Dependencies:**
  - `@empire/shared`: `"workspace:*"`
  - `@tanstack/react-query`: `^5.90.0`
  - `react`: `^19.2.0`
  - `react-dom`: `^19.2.0`
- **DevDependencies:**
  - `@tailwindcss/vite`: `^4.1.0`
  - `@types/react`: `^19.2.0`
  - `@types/react-dom`: `^19.2.0`
  - `@vitejs/plugin-react`: `^5.1.0`
  - `tailwindcss`: `^4.1.0`
  - `vite`: `^7.2.0` (currently resolved to `7.3.6`)

| Script | Command | Purpose |
|---|---|---|
| `dev` | `vite --host 127.0.0.1 --port 5173 --strictPort` | Runs Vite dev server with `/api` proxying to `http://127.0.0.1:8787` |
| `typecheck` | `tsc -p tsconfig.json` | Typechecks web source files and `vite.config.ts` |
| `build` | `vite build` | Compiles React/Tailwind frontend bundle into `dist/` |

---

### 2.4. Game Core Domain Package (`packages/game-core/package.json`)
- **Package Name:** `@empire/game-core`
- **Exports:** `"./src/index.ts"` (direct TypeScript ESM source, no build step)
- **Dependencies:** None (Pure domain mathematics / zero runtime or DB dependencies per ADR-001)

| Script | Command | Purpose |
|---|---|---|
| `typecheck` | `tsc -p tsconfig.json` | Typechecks all formulas, missions, and referral code |

---

### 2.5. Shared Contracts & DTOs Package (`packages/shared/package.json`)
- **Package Name:** `@empire/shared`
- **Exports:** `"./src/index.ts"` (direct TypeScript ESM source, no build step)
- **Dependencies:**
  - `zod`: `^4.1.12`

| Script | Command | Purpose |
|---|---|---|
| `typecheck` | `tsc -p tsconfig.json` | Typechecks Zod schemas, DTO types, and shared contracts |

---

## 3. Anatomy of the `pnpm check` Validation Pipeline

The CI workflow (`.github/workflows/ci.yml`) executes a single command on `push` and `pull_request`:
```bash
pnpm check
```
`pnpm check` is an `&&` chained sequential execution:
```
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build
```
Any non-zero exit code halts the pipeline immediately.

```
       ┌─────────────┐
       │  pnpm lint  │ (eslint .)
       └──────┬──────┘
              ▼ [exit 0]
       ┌──────────────────┐
       │ pnpm format:check│ (prettier --check .)
       └──────┬───────────┘
              ▼ [exit 0]
       ┌──────────────────┐
       │  pnpm typecheck  │ (pnpm -r typecheck -> tsc -p in 4 packages)
       └──────┬───────────┘
              ▼ [exit 0]
       ┌─────────────┐
       │  pnpm test  │ (vitest run -> 7 suites, 83 tests)
       └──────┬──────┘
              ▼ [exit 0]
       ┌─────────────┐
       │ pnpm build  │ (pnpm -r build -> wrangler dry-run + vite build)
       └─────────────┘
```

---

### 3.1. Step 1: ESLint (`pnpm lint`)
- **Command:** `eslint .`
- **Configuration:** `eslint.config.js` (ESLint 10 Flat Config)
  ```javascript
  import js from '@eslint/js';
  import tseslint from 'typescript-eslint';
  import globals from 'globals';

  export default tseslint.config(
    { ignores: ['**/dist/**', '**/.wrangler/**', '**/node_modules/**'] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  );
  ```
- **Execution Scope:** All `.js`, `.ts`, `.tsx`, `.jsonc` files not in ignores.
- **Rules Enforced:**
  - Standard JS syntax correctness (`js.configs.recommended`)
  - TypeScript-eslint recommended rules (`@typescript-eslint/no-unused-vars`, explicit typing, strict import rules)
  - Browser and Node global identifiers recognized without errors

---

### 3.2. Step 2: Prettier (`pnpm format:check`)
- **Command:** `prettier --check .`
- **Configuration:** `.prettierrc.json`
  ```json
  { "singleQuote": true, "trailingComma": "all" }
  ```
- **Ignore File:** `.prettierignore`
  ```
  pnpm-lock.yaml
  node_modules
  dist
  .wrangler
  *.docx
  ```
- **CRITICAL FINDING — Prettier Warning Root Cause:**
  When `prettier --check .` runs, it scans all files in the current directory tree that are not in `.prettierignore`. Currently, `.agents/` and `ORIGINAL_REQUEST.md` are not listed in `.prettierignore`.
  - When subagents create files in `.agents/*`, Prettier checks Markdown formatting (trailing whitespaces, line wrapping, list indentation) in `.agents/**/*.md`.
  - **Status of Tracked Source Code:** All 60+ tracked files in `apps/`, `packages/`, `supabase/`, `docs/` have 100% Prettier compliance ("All matched files use Prettier code style!").
  - **Remedy for CI / Developers:** Add `.agents` and `ORIGINAL_REQUEST.md` to `.prettierignore`, or format those files using `npx prettier --write .agents ORIGINAL_REQUEST.md`.

---

### 3.3. Step 3: TypeScript (`pnpm typecheck`)
- **Command:** `pnpm -r typecheck`
- **Underlying Commands:**
  - `packages/game-core`: `tsc -p tsconfig.json`
  - `packages/shared`: `tsc -p tsconfig.json`
  - `apps/api`: `tsc -p tsconfig.json`
  - `apps/web`: `tsc -p tsconfig.json`
- **Compiler Configuration (`tsconfig.base.json`):**
  ```json
  {
    "compilerOptions": {
      "target": "ES2022",
      "lib": ["ES2022"],
      "module": "ESNext",
      "moduleResolution": "Bundler",
      "strict": true,
      "noUncheckedIndexedAccess": true,
      "exactOptionalPropertyTypes": true,
      "noEmit": true,
      "skipLibCheck": true,
      "verbatimModuleSyntax": true,
      "esModuleInterop": true,
      "forceConsistentCasingInFileNames": true
    }
  }
  ```
- **Crucial Strictness Constraints for Developers:**
  1. `noUncheckedIndexedAccess: true`:
     - Accessing `array[0]` or `dict[key]` produces `T | undefined`.
     - Code *cannot* do `const x: string = list[0];`. It must do `const x = list[0]; if (!x) throw ...` or `list[0] ?? ''`.
  2. `exactOptionalPropertyTypes: true`:
     - If an interface defines `{ foo?: string }`, you *cannot* assign `{ foo: undefined }`. It must either be omitted or explicitly declared as `{ foo?: string | undefined }`.
  3. `verbatimModuleSyntax: true`:
     - Type imports MUST use the `type` keyword: `import type { PlayerState } from '@empire/shared';`. Failure to do so throws a TypeScript compilation error.
  4. `noEmit: true`:
     - TSC only typechecks; it emits no `.js` or `.d.ts` files. Bundling is handled exclusively by Vite and Wrangler.

---

### 3.4. Step 4: Vitest Test Suite (`pnpm test`)
- **Command:** `vitest run`
- **Execution Mode:** Runs once (single-pass, non-interactive) at monorepo root.
- **Config:** Defaults (no root `vitest.config.ts` needed; Vitest automatically matches `**/*.test.ts`).
- **Speed:** ~3.0 seconds for all 7 suites and 83 tests.
- **Results:**
  ```
  ✓ packages/game-core/src/missions.test.ts (11 tests) 6ms
  ✓ packages/game-core/src/referral.test.ts (15 tests) 11ms
  ✓ apps/web/src/auth/auth-policy.test.ts (16 tests) 6ms
  ✓ packages/game-core/src/formulas.test.ts (17 tests) 10ms
  ✓ apps/api/src/auth/crypto.test.ts (8 tests) 36ms
  ✓ apps/api/src/index.test.ts (2 tests) 12ms
  ✓ apps/api/src/auth/routes.test.ts (14 tests) 1941ms

  Test Files  7 passed (7)
       Tests  83 passed (83)
  ```

---

### 3.5. Step 5: Production and Dry-Run Builds (`pnpm build`)
- **Command:** `pnpm -r build`
- **Executed In:**
  1. `apps/api`: `wrangler deploy --dry-run --outdir dist`
     - Uses Cloudflare Wrangler 4.131.2.
     - Entrypoint: `apps/api/src/index.ts`.
     - Validates Cloudflare worker bindings (`AUTH_RATE_LIMIT`: simple 30 req/60s).
     - Validates compatibility date (`2026-09-14`).
     - Checks total upload size: ~857.83 KiB raw / ~140.89 KiB gzip.
     - **Constraint:** Worker code cannot import Node.js-only builtins (`node:fs`, `node:child_process`). Tests can import Node builtins, but anything in `apps/api/src/index.ts` or routes must be Cloudflare Workers compatible.
  2. `apps/web`: `vite build`
     - Uses Vite 7.3.6 + `@vitejs/plugin-react` + `@tailwindcss/vite`.
     - Output: `apps/web/dist` (HTML, JS chunk ~362 KiB / 110 KiB gzip, CSS ~5.7 KiB).

---

## 4. Deep Dive into Vitest Test Infrastructure & Suites

### 4.1. Inventory of All Existing Test Suites

| Test File | Test Count | Domain / Target | Key Methods & Patterns |
|---|---|---|---|
| `packages/game-core/src/formulas.test.ts` | 17 | Core idle economy formulas | `calculateUpgradeCost`, `calculateMilestoneMultiplier`, `calculateProductionPerSecond`, `calculateTotalProduction`, `calculateOfflineEarnings`, `calculateSRU`, `calculateReferralWhaleFactor`, `DEFAULT_BUSINESSES` |
| `packages/game-core/src/missions.test.ts` | 11 | Daily/weekly missions & streaks | `calculateMissionReward`, `calculateStreakReward`, `evaluateStreak`, `isMissionCompleted`, `DEFAULT_MISSIONS` |
| `packages/game-core/src/referral.test.ts` | 15 | Referral engine & deep links | `parseReferralCodeFromStartParam`, `generateReferralDeepLink`, `isWithinReferralBindWindow`, `isSelfReferral`, `calculateReferralReward`, `evaluateInviteeMilestones`, `getUnlockedReferralBadges` |
| `apps/web/src/auth/auth-policy.test.ts` | 16 | Frontend auth policies | `validateBotUsername`, `isSessionExpired`, `getAuthRecovery`, parameterized `it.each` |
| `apps/api/src/auth/crypto.test.ts` | 8 | Telegram HMAC crypto boundary | `validateInitData`, `signSession`, `verifySession`, custom fixture generator, 300s TTL verification |
| `apps/api/src/index.test.ts` | 2 | API routing & liveness | `/health` schema parsing, 404 structured response format |
| `apps/api/src/auth/routes.test.ts` | 14 | API HTTP + PGlite integration | In-memory Postgres, session cookies (`__Host-`), rate limiting, CSRF origin checks, ban rejection, SQL transaction RLS security |

---

### 4.2. In-Memory Database Testing Pattern (`apps/api/src/auth/test-db.ts`)

The API integration tests do not require a live Supabase server. Instead, they use `@electric-sql/pglite`, an in-memory PostgreSQL engine written in C/WASM compiled for Node.

```typescript
// apps/api/src/auth/test-db.ts
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { SupabaseAuthStore } from './store';

export async function createTestDatabase() {
  const db = new PGlite();

  // 1. Establish Supabase security roles
  await db.exec(
    'create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;',
  );

  // 2. Load and execute actual Supabase SQL migration
  await db.exec(
    await readFile(
      new URL('../../../../supabase/migrations/202609140001_auth.sql', import.meta.url),
      'utf8',
    ),
  );

  // 3. Mock Supabase PostgREST RPC fetcher over PGlite
  const fetcher: typeof fetch = async (input, init) => {
    const name = new URL(String(input)).pathname.split('/').at(-1);
    const p = JSON.parse(String(init?.body));
    // maps RPC names to SQL queries and executes within service_role transaction
    ...
  };

  return {
    db,
    store: new SupabaseAuthStore('https://test.supabase.co', 'test-service-key', fetcher),
  };
}
```

#### Why this pattern is exemplary:
1. **Real Postgres SQL Engine:** Migration DDL, table constraints, triggers, and SQL syntax errors are caught during unit tests.
2. **Zero Network Latency:** In-memory execution completes 14 full HTTP-to-DB integration tests in under 2 seconds.
3. **Hermetic Isolation:** Each test suite or run gets a fresh in-memory database; tests cannot pollute each other's data.
4. **Role & RLS Verification:** Tests can explicitly run `await tx.exec('set local role anon')` to verify that unprivileged roles cannot read or mutate restricted tables.

---

### 4.3. Test Design Patterns Observed Across Workspace

1. **Pure Function Testing (`packages/game-core`):**
   - Inputs are pure primitives or plain objects.
   - Outputs are compared with exact equality (`expect(...).toBe(...)`) or precision matching (`expect(...).toBeCloseTo(...)`).
   - Boundary tests for negative numbers, zeroes, cap limits, and edge timestamps.
2. **Parameterized Testing (`apps/web`):**
   - `it.each([...])('description with %s', (value) => { ... })` for error code tables, status transitions, and regex whitelisting.
3. **Independent Cryptographic Fixtures (`apps/api`):**
   - Test suites generate valid HMAC signatures using Node's `node:crypto` rather than using the application's internal signing logic, ensuring genuine black-box verification.
4. **Integration App Instantiation:**
   - Tests construct the Hono app via factory functions: `app = createApp(() => database.store, () => now)`.
   - Injected time provider `() => now` prevents flakiness from system clock drift.
   - Injected mock rate limiter: `{ limit: async () => ({ success: true }) }`.
5. **Contract Validation:**
   - Tests validate responses directly against Zod schemas: `healthResponseSchema.parse(await response.json())`.

---

## 5. Migration & Database Landscape (`supabase/migrations/`)

Four migrations currently exist in `supabase/migrations/`:

1. `202609140001_auth.sql`:
   - `public.users`: Telegram user records (`telegram_user_id`, `status` in `active`, `suspended`, `banned`).
   - `public.auth_sessions`: Server-side sessions (`sid`, `expires_at`, `revoked_at`).
   - Security functions: `empire_auth_login`, `empire_auth_session`, `empire_auth_logout`.
2. `202609140002_economy.sql`:
   - `public.economy_config`: Key-value JSONB remote configuration table (`economy.offline_cap_free_sec`, `economy.offline_cap_pass_sec`, `feature.token`, `feature.stars_payments`, etc.).
   - `public.businesses`: Canonical definitions (6 businesses).
   - `public.player_balances`: `cash`, `season_points`.
   - `public.player_businesses`: Player levels, `last_claim_at`.
   - `public.reward_ledger`: Immutable ledger with unique 64-char hex `idempotency_key`.
3. `202609140003_seasons_missions.sql`:
   - `public.seasons`: Season lifecycle (`upcoming`, `active`, `frozen`, `ended`), `sru_snapshot`.
   - `public.season_scores`: Composite primary key `(season_id, user_id)`, `points`, `mission_points`, `referral_points`.
   - `public.season_scores_leaderboard_idx`: Index on `(season_id, points desc)`.
   - `public.missions` & `public.mission_instances`: Mission instances and statuses.
   - `public.player_streaks`: 7-day streak tracker.
4. `202609140004_referrals.sql`:
   - `users.referral_code`: Unique player referral code.
   - `public.referrals`: Invitee-referrer link, `check (invitee_user_id <> referrer_user_id)`.
   - `public.referral_events`: Milestone rewards (`activation`, `retained_d2`, `retained_d7`, `progression`).

---

## 6. Exact Requirements to Pass All Quality Gates Cleanly (Steps 7, 8, 9, 11)

When implementing the upcoming modules (R1 Leaderboards, R2 Monetization, R3 Remote Config, R4 Analytics), the implementer must adhere to the following requirements to satisfy every quality gate:

### 6.1. Gate 1: ESLint (`pnpm lint`)
- **No Unused Identifiers:** Do not leave unused variables or imports. Prefix intentionally unused arguments with `_` (e.g., `_req`).
- **Use `node:` Prefix in Tests:** Node built-in imports in tests must use the protocol: `import { readFile } from 'node:fs/promises'`.
- **No Direct `any`:** Avoid `any`. Use `unknown` with type narrowing or Zod schemas.
- **Type Imports:** Always write `import type { ... } from '...'` for type references.

### 6.2. Gate 2: Prettier (`pnpm format:check`)
- **Update `.prettierignore`:** Add `.agents` and `ORIGINAL_REQUEST.md` to `.prettierignore` so local agent scratchpads do not trigger warnings.
- **Code Style:** 
  - Single quotes (`'`)
  - Trailing commas everywhere (`"trailingComma": "all"`)
  - 2-space indentation
  - Strict JSON formatting in config files

### 6.3. Gate 3: TypeScript (`pnpm typecheck`)
- **Handling `noUncheckedIndexedAccess`:**
  - Array indexing (e.g. `scores[0]`, `rows[0]`) is typed `T | undefined`.
  - Always guard with `rows[0]?.points ?? 0` or an explicit `if (!row) throw ...`.
- **Handling `exactOptionalPropertyTypes`:**
  - Do not pass `{ username: undefined }` if the property is `username?: string`. Either omit the property or type it `username?: string | undefined`.
- **Shared Contracts:**
  - Define all new DTOs in `packages/shared/src/index.ts` using Zod schemas (`z.object({...}).strict()`, `z.uuid()`, `z.iso.datetime()`).
  - Export both the Zod schema and the inferred TypeScript type (`export type FooDto = z.infer<typeof fooSchema>`).
- **Dependencies:**
  - If `apps/api` uses formulas from `packages/game-core`, add `"@empire/game-core": "workspace:*"` to `apps/api/package.json`.

### 6.4. Gate 4: Vitest (`pnpm test`)
- **100% Logic Coverage in `packages/game-core`:**
  - **Leaderboard pure logic:** Deterministic tie-breaking (e.g. Points DESC -> Timestamp ASC -> UserID ASC), rank pagination (page, pageSize, boundary limits), user rank pinning calculations.
  - **Convenience Pass entitlement:** 12h (43,200s) offline cap vs 4h (14,400s) free cap, verifying base production multipliers remain unchanged (anti-P2W guardrail).
  - **Remote config loader / fallbacks:** Fallbacks to default values when DB config keys are missing.
  - **Feature flag evaluator:** Verify `feature.token` defaults to `false` and requires explicit enablement.
  - **Analytics retention models:** Cohort retention calculations for D1, D2, D7 from simulated activity logs.
- **Integration Tests in `apps/api`:**
  - Expand `createTestDatabase()` or create a dedicated test helper to load subsequent migrations (`0002_economy.sql`, `0003_seasons_missions.sql`, `0004_referrals.sql`, and new migrations).
  - Test idempotency on payment fulfillment (duplicate request returns existing record, rejected re-credit).
  - Test Stars payment cannot purchase Season Points.
  - Mock external dependencies (e.g. Telegram Stars API) hermetically.

### 6.5. Gate 5: Production and Dry-Run Builds (`pnpm build`)
- **Cloudflare Worker Safety in `apps/api`:**
  - Do NOT import Node native libraries (`fs`, `path`, `os`, `net`) inside `apps/api/src/index.ts` or routes. Use Web APIs (`crypto.subtle`, `fetch`, `Response`).
  - Declare any new Cloudflare bindings in `apps/api/wrangler.jsonc` and type them in `apps/api/src/auth/env.ts`.
  - Ensure Wrangler dry-run bundle builds with exit code 0.
- **Frontend Safety in `apps/web`:**
  - Ensure React 19 JSX and Tailwind v4 compile without Rollup errors during `vite build`.

---

## 7. Pre-Flight Verification Checklist for Implementers

Before submitting any work for Steps 7, 8, 9, or 11, execute this verification sequence:

```bash
# 1. Check linting
pnpm lint

# 2. Check code formatting
pnpm format:check

# 3. Check TypeScript compilation across all packages
pnpm typecheck

# 4. Run full Vitest suite
pnpm test

# 5. Run dry-run build for Worker & production build for Vite
pnpm build

# 6. Run master check
pnpm check
```

When all six commands exit with code 0, the codebase is fully compliant with monorepo quality standards.
