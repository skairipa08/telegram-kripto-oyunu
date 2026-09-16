# Handoff Report: Survey 4 (API & Economy Store)

## 1. Observation
1. **Migration 202609140007_game_loop_apis.sql**:
   - Location: `supabase/migrations/202609140007_game_loop_apis.sql` (632 lines).
   - Functions defined:
     - Line 9: `public.empire_claim_offline_earnings(p_user_id uuid, p_offline_cap_seconds integer default 14400) returns jsonb`
     - Line 119: `public.empire_upgrade_business(p_user_id uuid, p_business_slug text, p_request_id uuid default null) returns jsonb`
     - Line 237: `public.empire_get_game_state(p_user_id uuid) returns jsonb`
     - Line 339: `public.empire_bind_referral(p_user_id uuid, p_referral_code text) returns jsonb`
     - Line 410: `public.empire_get_referral_status(p_user_id uuid) returns jsonb`
     - Line 452: `public.empire_get_active_missions(p_user_id uuid) returns jsonb`
     - Line 490: `public.empire_claim_mission(p_user_id uuid, p_mission_instance_id uuid) returns jsonb`
     - Line 563: `public.empire_get_streak(p_user_id uuid) returns jsonb`
   - Permissions: Lines 613-630 explicitly revoke execution from `public, anon, authenticated` and grant to `service_role`.

2. **EconomyStore Layer**:
   - Location: `apps/api/src/economy/store.ts` (lines 18-70, 72-295).
   - Interface `EconomyStore` contains all 8 methods: `claimOfflineEarnings`, `upgradeBusiness`, `getGameState`, `bindReferral`, `getReferralStatus`, `getActiveMissions`, `claimMission`, `getStreak`.
   - `SupabaseEconomyStore` implements all 8 methods via PostgREST RPC invocations. `upgradeBusiness` returns `{ error?: string, business?: ..., remainingCash?: number, totalProductionPerSecond?: number }`.

3. **Shared Schemas & DTOs**:
   - Location: `packages/shared/src/index.ts`.
   - `claimCashRequestSchema` (lines 121-125) and `claimCashResponseSchema` (lines 128-134).
   - `upgradeBusinessRequestSchema` (lines 137-142) and `upgradeBusinessResponseSchema` (lines 147-152).
   - `playerMissionInstanceSchema` (lines 183-195), `claimMissionRequestSchema` (lines 208-213), `claimMissionResponseSchema` (lines 216-222).
   - `playerStreakDtoSchema` (lines 198-205).
   - `bindReferralRequestSchema` (lines 262-267), `bindReferralResponseSchema` (lines 270-274), `playerReferralOverviewSchema` (lines 250-257).

4. **Authentication & Routing Conventions**:
   - Location: `apps/api/src/auth/routes.ts` (lines 15-49), `apps/api/src/economy/routes.ts` (lines 23-49), `apps/api/src/index.ts` (lines 33-104).
   - Cookie name: `__Host-empire_session`.
   - Session extraction: `getCurrentUserSession(c.req.header('Cookie'), c.env, authStore, now)`. Returns `StoredSession | null`. Unauthenticated requests receive `{ apiVersion: 'v1', error: { code: 'UNAUTHORIZED' } }` with HTTP 401.
   - Dual-prefix route mounting in `createApp`: `app.route('/', subApp); app.route('/api', subApp);`.

5. **Test Harness & Baseline**:
   - Location: `apps/api/src/auth/test-db.ts` (158 lines).
   - Currently includes migrations 1 through 6 (lines 17-24).
   - Ran `pnpm check`: Exited with code 0 (232 tests passing across 25 test files; wrangler build and vite build passed).

## 2. Logic Chain
1. From Observation 1, the 8 database RPC functions encapsulate the business logic (including atomicity, row locks, offline cap rules, referral windows, streak progression, and ledger entries), returning structured JSON objects with explicit error strings (`BUSINESS_NOT_FOUND`, `INSUFFICIENT_CASH`, `ALREADY_REFERRED`, `SELF_REFERRAL`, etc.).
2. From Observation 2, `EconomyStore` and `SupabaseEconomyStore` are already wired up to invoke these 8 RPCs with correct parameters and map their results.
3. From Observation 3, the DTO schemas in `@empire/shared` match the RPC return payloads and validate incoming request bodies with strict rules (UUID validation, string lengths).
4. From Observation 4, `getCurrentUserSession` extracts the validated user ID from the `__Host-empire_session` cookie header. Mounting routes in Hono at both `/` and `/api` ensures client calls to either `/economy/claim` or `/api/economy/claim` reach the exact same handler.
5. Because `EconomyStore` already contains all 8 methods, adding all 8 endpoints (`POST /economy/claim`, `POST /economy/upgrade`, `GET /game/state`, `GET /missions/active`, `POST /missions/:id/claim`, `GET /streak`, `POST /referral/bind`, `GET /referral/status`) to `apps/api/src/economy/routes.ts` allows immediate mounting at both `/` and `/api` via existing `createEconomyRoutes` without changing `AppStoreFactories` or breaking existing test suites.
6. For testing (Observation 5), adding `202609140007_game_loop_apis.sql` to `createTestDatabase()` and dispatching the 8 RPCs enables integration testing using PGlite.

## 3. Caveats
- No changes were made to source code during this turn (read-only investigation per explorer archetype).
- `GET /missions/active` SQL function returns a JSON array of `PlayerMissionInstance`. To satisfy acceptance criterion "GET /missions/active returns array of today's mission instances", the handler should return `c.json(missions, 200)`. If client wrappers expect an object envelope, `live-game.tsx` or client adapters should handle both formats.

## 4. Conclusion
Requirements R1 and R2 can be implemented cleanly and with zero architectural disruption by:
1. Extending `apps/api/src/economy/routes.ts` with all 8 new endpoint handlers.
2. Handling authentication via `getCurrentUserSession` (401 on null).
3. Validating incoming bodies with `@empire/shared` Zod schemas (400 `INVALID_REQUEST` on parse error).
4. Mapping business errors (`INSUFFICIENT_CASH`, `BUSINESS_NOT_FOUND`, `SELF_REFERRAL`, etc.) directly to HTTP 400.
5. Retaining existing dual-mount `app.route('/', economy); app.route('/api', economy);` in `apps/api/src/index.ts`.
6. Registering migration `202609140007_game_loop_apis.sql` and the 8 RPC cases in `apps/api/src/auth/test-db.ts`.

All detailed code listings, types, and test plans are documented in `apps_api_survey.md`.

## 5. Verification Method
1. Inspect analysis files:
   - `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_survey4_api\apps_api_survey.md`
   - `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_survey4_api\handoff.md`
2. Run baseline quality gate:
   `pnpm check`
   Exit code 0 confirms 0 lint errors, 0 format errors, 0 type errors, 232 passing vitest tests, and valid builds.
3. Invalidation condition: Any change to `packages/shared/src/index.ts` DTO schemas or SQL migration `202609140007_game_loop_apis.sql` that alters property names or types would invalidate the proposed endpoint signatures.
