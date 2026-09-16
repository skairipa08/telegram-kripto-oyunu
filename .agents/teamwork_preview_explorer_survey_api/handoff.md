# Comprehensive Handoff Report: API Architecture, Routing, RBAC & Test Harness Survey

**Agent**: API & Auth Explorer (`teamwork_preview_explorer_survey_api`)  
**Mission**: Investigate `apps/api` architecture, routing, authentication, RBAC, and test harness setup for Requirements R3 (Admin Review & Audit APIs) and R4 (Independent Test DB Harness).  
**Status**: Investigation Complete  
**Date**: 2026-09-15  

---

## 1. Observation

### 1.1 `apps/api` Framework, Entry Point & Routing
- **Framework**: Hono (`hono` version `^4.10.0` in `apps/api/package.json:13`), running in a Cloudflare Workers environment managed by Wrangler (`apps/api/package.json:17`, `wrangler.jsonc`).
- **Entry Point**: `apps/api/src/index.ts:33-106`.
  - `createApp(storesOrAuthStore?: AppStoreFactories | ((env: Bindings) => AuthStore), now?: () => number)`
  - Defines `AppStoreFactories` (`apps/api/src/index.ts:24-31`):
    ```typescript
    export interface AppStoreFactories {
      makeAuthStore?: (env: Bindings) => AuthStore;
      makeLeaderboardStore?: (env: Bindings) => LeaderboardStore;
      makeShopStore?: (env: Bindings) => ShopStore;
      makeConfigStore?: (env: Bindings) => ConfigStore;
      makeAnalyticsStore?: (env: Bindings) => AnalyticsStore;
      makeEconomyStore?: (env: Bindings) => EconomyStore;
    }
    ```
  - Routes are dual-mounted at both root `/` and `/api` prefixes:
    ```typescript
    // Example: apps/api/src/index.ts:50-52
    const auth = createAuthRoutes(factories.makeAuthStore, now);
    app.route('/', auth);
    app.route('/api', auth);
    ```
  - Global Middleware in `apps/api/src/index.ts`:
    - `healthHandler` at `/health` and `/api/health` returning `HealthResponse` (`status: 'ok'`, `service: 'empire-api'`).
    - `app.notFound((c) => c.json({ apiVersion: 'v1', error: { code: 'NOT_FOUND' } }, 404));`
  - Per-router middleware (e.g. `apps/api/src/auth/routes.ts:70-82`):
    - Headers: `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`.
    - Body limit: `bodyLimit({ maxSize: 20000, onError: (c) => c.json(error('INVALID_REQUEST'), 413) })`.

### 1.2 Authentication & Session Verification
- **Telegram WebAppData Signature Verification**:
  - `apps/api/src/auth/crypto.ts:55-112` (`validateInitData`): Uses WebCrypto HMAC-SHA256 with key derived from `WebAppData` and `TELEGRAM_BOT_TOKEN`.
  - Validates `auth_date` window: `now - authDate <= 300` and `authDate - now <= 30`.
  - Parses `TelegramUser` schema: `{ id: number, first_name: string, username?: string, language_code?: string }`.
- **Session Tokens & Cookies**:
  - `apps/api/src/auth/crypto.ts:133-176` (`signSession`, `verifySession`):
    - Claims schema: `{ v: 1, aud: 'empire', sid: UUID, iat: number, exp: number }`. Lifetime = 1800s (30 minutes).
    - Signed using HMAC-SHA256 over `empire.session.v1.${payload}` using `SESSION_SECRET`.
    - Transmitted via cookie: `__Host-empire_session` (`apps/api/src/auth/routes.ts:15`).
- **Session Verification Helper**:
  - `apps/api/src/auth/routes.ts:25-49` (`getCurrentUserSession`):
    ```typescript
    export async function getCurrentUserSession(
      header: string | undefined,
      env: Bindings,
      store: AuthStore,
      now: () => number = () => Math.floor(Date.now() / 1000),
    ): Promise<StoredSession | null> { ... }
    ```
  - Verifies signature, validates expiration (`record.expiresAt > now()`), and queries `store.getSession(claims.sid)`.
  - Returns `StoredSession`:
    ```typescript
    {
      sid: string;
      issuedAt: number;
      expiresAt: number;
      user: {
        id: string; // UUID
        telegramId: string;
        firstName: string;
        username: string | null;
        language: string | null;
      }
    }
    ```
  - Unauthenticated requests return HTTP 401 `{ apiVersion: 'v1', error: { code: 'UNAUTHORIZED' } }`.

### 1.3 Admin Verification & RBAC Status
- **Existing Admin Routes**:
  - `apps/api/src/config/routes.ts:48-58` (`POST /admin/config`) and `apps/api/src/leaderboard/routes.ts:103-112` (`POST /admin/seasons/:id/freeze`).
  - **Direct Observation**: Both endpoints call `getCurrentUserSession`, but do **not** check any user role or permissions table. Any authenticated user can currently call them.
  - **No RBAC exists yet**: Neither `admin_roles` table nor API-level role check exists in the current codebase.
- **`admin_audit_logs` Table**:
  - Defined in `supabase/migrations/202609140005_step7_to_11_backend.sql:50-60`:
    ```sql
    create table public.admin_audit_logs (
      id uuid primary key default gen_random_uuid(),
      admin_user_id uuid references public.users(id) on delete set null,
      action text not null check (action in ('update_config', 'set_feature_flag', 'freeze_season', 'ban_user', 'refund_purchase')),
      target_type text not null check (target_type in ('economy_config', 'feature_flag', 'season', 'user', 'purchase')),
      target_key text not null,
      old_value jsonb,
      new_value jsonb not null,
      reason text check (reason is null or length(reason) <= 256),
      created_at timestamptz not null default now()
    );
    ```
  - **Critical Schema Constraint**: The `action` and `target_type` columns have strict `CHECK` constraints that do not permit fraud actions (e.g. `'fraud_review'`, `'approve_reward'`, `'reject_reward'`, target_type `'frozen_reward'`). The DB migration `202609140008_anti_fraud.sql` must modify or expand these constraints.

### 1.4 Test DB Harness Review (`apps/api/src/auth/test-db.ts`)
- **Direct Observation**:
  - `apps/api/src/auth/test-db.ts:1-247` uses `@electric-sql/pglite` (WASM Postgres).
  - Lines 17-25 list migrations to load:
    ```typescript
    const migrations = [
      '202609140001_auth.sql',
      '202609140002_economy.sql',
      '202609140003_seasons_missions.sql',
      '202609140004_referrals.sql',
      '202609140005_step7_to_11_backend.sql',
      '202609140006_economy_starter_and_roi.sql',
      '202609140007_game_loop_apis.sql',
    ];
    ```
  - **Error Observed**: `supabase/migrations/202609140007_game_loop_apis.sql` is missing on disk. Calling `createTestDatabase()` from `apps/api/src/auth/test-db.ts` throws:
    `Error: ENOENT: no such file or directory, open 'C:\Users\Administrator\Desktop\telegram kripto oyunu\supabase\migrations\202609140007_game_loop_apis.sql'`
  - **Constraint Reminder**: `apps/api/src/auth/test-db.ts` is explicitly protected by task instructions ("DO NOT TOUCH Codex/Sol game-loop files... Remember: apps/api/src/auth/test-db.ts must remain untouched!").
  - The anti-fraud test harness must therefore be **completely independent** in `apps/api/src/fraud/test-db.ts`.

### 1.5 Database Dependencies for Anti-Fraud Review
- `public.player_balances` (`supabase/migrations/202609140002_economy.sql:46-51`):
  - `cash bigint not null default 0 check (cash >= 0)`
  - `season_points bigint not null default 0 check (season_points >= 0)`
- `public.reward_ledger` (`supabase/migrations/202609140002_economy.sql:67-76`):
  - `user_id uuid references public.users(id)`
  - `delta_cash bigint`, `delta_season_points bigint`
  - `reason text check (length(reason) between 1 and 64)`
  - `idempotency_key text unique check (idempotency_key ~ '^[a-f0-9]{64}$')`
  - `metadata jsonb`

---

## 2. Logic Chain

### 2.1 RBAC & Admin Verification Architecture
1. **Observation 1.2 & 1.3**: `getCurrentUserSession` successfully establishes player identity (`session.user.id`), but no role checks are performed.
2. **Requirement R3**: Accessing `/admin/fraud/*` must enforce RBAC:
   - Unauthenticated -> 401 `UNAUTHORIZED`.
   - Authenticated without active admin role -> 403 `FORBIDDEN`.
3. **Database Integration**:
   - `admin_roles` table in `202609140008_anti_fraud.sql` will store `(user_id, role, is_active)` where `role IN ('admin', 'superadmin', 'auditor')`.
   - `SupabaseFraudStore` will expose `getAdminRole(userId: string): Promise<AdminRoleRecord | null>`.
   - In `apps/api/src/fraud/routes.ts`, an `adminAuthMiddleware` (or helper `requireAdminRole`) will execute:
     - Step A: `session = await getCurrentUserSession(cookie, env, authStore, now)`. If null -> return 401.
     - Step B: `adminRole = await fraudStore.getAdminRole(session.user.id)`. If null, inactive, or not in allowed roles -> return 403.
     - Step C: Attach `adminUser = { session, role: adminRole }` to request context and proceed.

### 2.2 Independent Test DB Harness Architecture (`apps/api/src/fraud/test-db.ts`)
1. **Observation 1.4**: `apps/api/src/auth/test-db.ts` is protected and cannot be modified. Furthermore, it currently fails if called because migration `0007` is not present on disk.
2. **Requirement R4**: Create `apps/api/src/fraud/test-db.ts` that runs migrations up to `202609140008_anti_fraud.sql` without touching `apps/api/src/auth/test-db.ts`.
3. **Design of `apps/api/src/fraud/test-db.ts`**:
   - Instantiate independent `PGlite` instance.
   - Run role bootstrap: `create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;`.
   - Read and execute verified existing migration files:
     - `202609140001_auth.sql`
     - `202609140002_economy.sql`
     - `202609140003_seasons_missions.sql`
     - `202609140004_referrals.sql`
     - `202609140005_step7_to_11_backend.sql`
     - `202609140006_economy_starter_and_roi.sql`
     - `202609140008_anti_fraud.sql` (loaded as part of R2/R4)
     *(Note: dynamically test if 0007 exists on disk using `existsSync` before loading, avoiding any ENOENT failure).*
   - Provide PostgREST RPC mock `fetcher` routing:
     - Auth RPCs: `empire_auth_login`, `empire_auth_session`, `empire_auth_logout` (enables real session setup in tests).
     - Fraud RPCs:
       - `empire_fraud_get_admin_role(p_user_id)`
       - `empire_fraud_get_flags(p_status, p_user_id, p_risk_level, p_limit, p_offset)`
       - `empire_fraud_get_frozen(p_status, p_user_id, p_limit, p_offset)`
       - `empire_fraud_review(p_admin_user_id, p_reward_id, p_decision, p_reason)`
   - Expose helper utilities:
     - `seedAdminRole(userId: string, role: string, isActive?: boolean)`
     - `seedFrozenReward(params: { userId: string, cashAmount: number, seasonPointsAmount: number, reasonCode: string, metadata?: any })`
     - `seedFraudFlag(params: { userId: string, riskScore: number, reasonCodes: string[], targetType: string, targetId: string })`
   - Return `{ db, authStore, fraudStore }`.

### 2.3 Exact Route Endpoints & Logic
1. **Router Registration in `apps/api/src/index.ts`**:
   - Add `makeFraudStore?: (env: Bindings) => FraudStore` to `AppStoreFactories`.
   - Instantiate `createFraudRoutes(factories.makeFraudStore, factories.makeAuthStore, now)`.
   - Mount router at both `/` and `/api`:
     ```typescript
     const fraud = createFraudRoutes(factories.makeFraudStore, factories.makeAuthStore, now);
     app.route('/', fraud);
     app.route('/api', fraud);
     ```
   - This automatically creates dual-prefix availability for `/admin/fraud/*` and `/api/admin/fraud/*`.

2. **Endpoint 1: `GET /admin/fraud/flags`**:
   - Authentication: 401 if unauthenticated.
   - Authorization: 403 if user not in `admin_roles` or inactive.
   - Query filters: `status` (pending/reviewed/all), `userId` (UUID), `riskLevel` (low/med/high/critical), `limit` (default 50), `offset` (default 0).
   - Response: HTTP 200 `{ apiVersion: 'v1', flags: FraudFlagDto[], total: number }`.

3. **Endpoint 2: `GET /admin/fraud/frozen`**:
   - Authentication: 401 if unauthenticated.
   - Authorization: 403 if user not in `admin_roles` or inactive.
   - Query filters: `status` (default `'frozen'`, optional `'approved'`, `'rejected'`, `'all'`), `userId`, `limit`, `offset`.
   - Response: HTTP 200 `{ apiVersion: 'v1', frozenRewards: FrozenRewardDto[], total: number }`.

4. **Endpoint 3: `POST /admin/fraud/review`**:
   - Authentication: 401 if unauthenticated.
   - Authorization: 403 if user not in `admin_roles` (or if role is `auditor` when mutation requires `admin` or `superadmin`).
   - Request Body Validation (Zod):
     ```typescript
     z.object({
       rewardId: z.string().uuid(),
       decision: z.enum(['approve', 'reject']),
       reason: z.string().min(1).max(256),
     }).strict()
     ```
     Returns 400 `{ apiVersion: 'v1', error: { code: 'INVALID_REQUEST' } }` on invalid body.
   - Execution:
     - On `approve`:
       - Update `frozen_rewards`: set `status = 'approved'`, `reviewed_by = admin_user_id`, `reviewed_at = now()`, `review_notes = reason`.
       - Atomically credit `public.player_balances`: `cash = cash + cash_amount, season_points = season_points + season_points_amount`.
       - Record `public.reward_ledger`: `delta_cash`, `delta_season_points`, `reason = 'fraud_review_approved'`, `idempotency_key = <hash>`.
       - Record `public.admin_audit_logs`: `action = 'approve_reward'`, `target_type = 'frozen_reward'`, `target_key = rewardId`, `old_value = { status: 'frozen' }`, `new_value = { status: 'approved', decision: 'approve' }`, `reason = reason`.
     - On `reject`:
       - Update `frozen_rewards`: set `status = 'rejected'`, `reviewed_by = admin_user_id`, `reviewed_at = now()`, `review_notes = reason`.
       - No balance credit.
       - Record `public.admin_audit_logs`: `action = 'reject_reward'`, `target_type = 'frozen_reward'`, `target_key = rewardId`, `old_value = { status: 'frozen' }`, `new_value = { status: 'rejected', decision: 'reject' }`, `reason = reason`.
   - Response: HTTP 200 `{ apiVersion: 'v1', success: true, rewardId: string, decision: 'approve' | 'reject', reviewedBy: string, reviewedAt: string, auditLogId: string }`.

---

## 3. Caveats

1. **Missing Migration `202609140007_game_loop_apis.sql`**:
   - As observed in Section 1.4, `apps/api/src/auth/test-db.ts` contains a reference to `202609140007_game_loop_apis.sql`, but the file is absent from `supabase/migrations/`.
   - Because `apps/api/src/auth/test-db.ts` is strictly marked DO NOT TOUCH, our anti-fraud tests must strictly use `apps/api/src/fraud/test-db.ts`.
   - Note for orchestrator: If global `pnpm test` is run, tests importing `apps/api/src/auth/test-db.ts` will fail unless the orchestrator coordinates creating/restoring `202609140007_game_loop_apis.sql` or removing the broken reference.
2. **`admin_audit_logs` Check Constraint**:
   - In migration 0005, `admin_audit_logs` has check constraints on `action` and `target_type`.
   - Migration `202609140008_anti_fraud.sql` must execute:
     ```sql
     alter table public.admin_audit_logs drop constraint if exists admin_audit_logs_action_check;
     alter table public.admin_audit_logs drop constraint if exists admin_audit_logs_target_type_check;
     ```
     or add the new actions (`'approve_reward'`, `'reject_reward'`, `'fraud_flag'`) and target types (`'frozen_reward'`, `'fraud_flag'`) to the allowed check list.
3. **Auditor Permission Scope**:
   - Auditors should have read access (`GET /admin/fraud/flags`, `GET /admin/fraud/frozen`) but cannot approve/reject rewards. If an auditor attempts `POST /admin/fraud/review`, HTTP 403 `FORBIDDEN` should be returned.

---

## 4. Conclusion & Implementation Plan

### 4.1 Recommended File Structure for R3 & R4
```
apps/api/src/fraud/
├── routes.ts           # Hono router for /admin/fraud/flags, /admin/fraud/frozen, /admin/fraud/review + RBAC
├── routes.test.ts      # Comprehensive integration tests covering 401, 403, approve, reject, audit logs
├── store.ts            # FraudStore interface and SupabaseFraudStore implementation
└── test-db.ts          # Standalone PGlite test harness loading 0001-0006 + 0008 migrations with mock RPCs
```

### 4.2 Shared DTOs to Add to `packages/shared/src/index.ts`
1. `adminFraudFlagDtoSchema` & `adminFraudFlagsResponseSchema`
2. `adminFrozenRewardDtoSchema` & `adminFrozenRewardsResponseSchema`
3. `adminFraudReviewRequestSchema` & `adminFraudReviewResponseSchema`

### 4.3 Integration in `apps/api/src/index.ts`
1. Import `createFraudRoutes` and `FraudStore`.
2. Add `makeFraudStore?: (env: Bindings) => FraudStore` to `AppStoreFactories`.
3. Mount `createFraudRoutes(factories.makeFraudStore, factories.makeAuthStore, now)` at `/` and `/api`.

---

## 5. Verification Method

### 5.1 Verification Commands for Implementation
1. **Typecheck API**:
   ```bash
   pnpm --filter @empire/api typecheck
   ```
   *Expected*: Code 0, no type errors.
2. **Run Independent Anti-Fraud Integration Test Suite**:
   ```bash
   pnpm vitest run apps/api/src/fraud/routes.test.ts
   ```
   *Expected*: All tests pass (covering 401 UNAUTHORIZED, 403 FORBIDDEN, GET flags, GET frozen, POST review approve, POST review reject, audit log creation).
3. **Run Unit Tests across Packages**:
   ```bash
   pnpm vitest run packages/game-core
   ```
   *Expected*: All 136 existing tests continue to pass.

### 5.2 Verification Checklist for Implementer
- [ ] `apps/api/src/auth/test-db.ts` remains 100% untouched.
- [ ] Non-admin user calling `/admin/fraud/flags`, `/admin/fraud/frozen`, or `/admin/fraud/review` receives HTTP 403 `FORBIDDEN`.
- [ ] Unauthenticated user receives HTTP 401 `UNAUTHORIZED`.
- [ ] Approving a frozen reward credits `player_balances` atomically, sets status to `'approved'`, and inserts an audit log into `admin_audit_logs`.
- [ ] Rejecting a frozen reward marks status `'rejected'`, leaves balances unchanged, and inserts an audit log.
- [ ] Both `/admin/fraud/*` and `/api/admin/fraud/*` URL prefixes function identically.
