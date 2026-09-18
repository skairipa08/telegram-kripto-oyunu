# Original User Request

## 2026-09-14T12:03:51Z

Implement the backend, data engineering, and game logic modules for Project Empire (Steps 7, 8, 9, and 11) within the existing monorepo, while strictly keeping all UI design and anti-fraud/exploit security isolated for Astra 6.0.

Working directory: c:\Users\Administrator\Desktop\telegram kripto oyunu
Integrity mode: demo

## Requirements

### R1. Leaderboards Engine & Season Freeze (Blueprint R6)
Implement the data models, indexing, and logic for global and friend leaderboards.
- Support high-volume ranking queries with deterministic tie-breaking and rank pagination.
- Provide user rank pinning (retrieving the current player's exact rank and score).
- Implement season freeze and score archiving routines when a season ends.

### R2. Stars Monetization & Pass Entitlement Backend (Blueprint R7)
Implement the business logic and transaction contracts for Telegram Stars and Convenience Pass.
- Define invoice creation and idempotent payment fulfillment contracts (ensuring a transaction cannot be double-fulfilled).
- Manage Convenience Pass entitlement state (expanding offline cap from 4h to 12h, upgrade queue slots).
- Strictly enforce zero Season Points multipliers and zero competitive advantages for money (anti-P2W guardrail).

### R3. Admin Remote Config & Feature Flags (Blueprint R8)
Implement dynamic configuration and feature flag mechanisms that do not require redeploying code.
- Remote config loader for economy constants (costs, production rates, SRU baseline, referral thresholds).
- Feature flag engine to toggle experimental features (e.g., token module OFF by default).
- Audit logging schema for recording configuration changes.

### R4. Analytics Event Pipeline & Cohort Models (Blueprint R10)
Implement the data models and tracking abstractions for player analytics.
- Structured event taxonomy adhering to Blueprint Section 18 (app_open, cash_claim, business_upgrade, mission_claim, referral_bound, etc.).
- Calculation models for activation, D1/D2/D7 retention cohorts, and payment conversion.

### R5. Strict Domain Boundary (No UI, No Anti-Cheat/Exploit Modifications)
- Do NOT create or modify UI/UX visual components or CSS styles (reserved for Astra 6.0).
- Do NOT alter anti-cheat/anti-fraud algorithms, exploit testing, or external auth penetration hardening (reserved for Astra 6.0).
- Implement only pure formulas in packages/game-core, DTO schemas in packages/shared, SQL migrations in supabase/migrations/, and backend routes in apps/api.

## Acceptance Criteria

### Leaderboard Verification
- [ ] Database migration includes optimized composite indexes on season_scores(season_id, points desc).
- [ ] Pure sorting, ranking, and pagination functions in packages/game-core or API handle ties and edge cases with 100% test coverage.
- [ ] Season freeze and archival functions correctly preserve past season final ranks.

### Monetization & Entitlement Verification
- [ ] Payment fulfillment functions enforce idempotency (duplicate fulfillment attempts are rejected).
- [ ] Convenience Pass entitlement calculation correctly applies 12h (43,200s) offline cap without altering base production or SRU multipliers.
- [ ] Contract tests verify that Stars cannot purchase Season Points or competitive rank boosts.

### Remote Config & Feature Flags Verification
- [ ] Remote config getters fall back safely to defaults if database overrides are absent.
- [ ] Feature flag evaluator defaults feature.token to false and requires explicit enablement.
- [ ] All configuration mutations produce an audit trail entry.

### Analytics Pipeline Verification
- [ ] Event schemas validate against all event names defined in Blueprint Section 18.
- [ ] Retention calculation functions correctly identify D1, D2, and D7 qualifying players from session logs.

### Workspace Integrity & Quality Gates
- [ ] pnpm check (ESLint, Prettier, TypeScript across all packages, Vitest test suite, Vite build, and Wrangler dry-run) executes with exit code 0.
- [ ] All new logic and formulas have comprehensive automated tests.
- [ ] All changes are documented in HANDOFF.md with step-by-step progress.

## 2026-09-14T12:46:12Z

Audit, optimize, and refine the economy mathematics, onboarding starter balances, ROI payback models, and simulation tooling for Project Empire, strictly preserving UI/UX and anti-cheat boundaries for Astra 6.0.

Working directory: c:\Users\Administrator\Desktop\telegram kripto oyunu
Integrity mode: demo

## Requirements

### R1. Onboarding Starter Grants & Core Loop Calibration
Calibrate the initial player onboarding balance and unlock flow so that a new user never gets stuck:
- Provide a default starter balance (100 Cash) on first player creation so the player can immediately unlock Street Stand (Level 1, 1 Cash/s) and activate their core idle loop within 30 seconds.
- Support additive starter referral boost (+500 Cash) if the player bound a referral link.
- Expose a pure getStarterEconomyState() function and database trigger/RPC initialization ensuring new users are never initialized with 0 cash and 0 production.

### R2. Economy Mathematical Balance & ROI Metrics
Implement pure financial and progression analytics in packages/game-core:
- calculatePaybackPeriodSeconds(upgradeCost, currentProduction, nextProduction): Deterministic calculation of break-even time (ROI) in seconds for any business upgrade.
- calculateOptimalNextUpgrade(businesses, playerCash): Pure recommendation function identifying the business upgrade that yields the shortest payback period or highest marginal ROI.
- Safe big-number formatting helper: formatCompactNumber(value) (1.2K, 3.5M, 12.8B, 4.5T) ensuring zero precision loss and protection against numeric overflows.

### R3. Deterministic Economy Simulation Harness
Create an offline economy simulation runner in packages/game-core (and scripts/):
- Pure simulation function simulateProgression(strategy, durationSeconds, config) that models player growth over 1 hour, 24 hours, 7 days, and 30 days.
- Output metrics: total Cash generated, levels achieved per business, time-to-unlock for each of the 6 businesses, and impact of Convenience Pass (4h vs 12h offline cap).
- Verify that economic progression remains challenging yet achievable without exponential infinite-growth breakdown.

### R4. API & Shared DTO Upgrades for Economy Health
- Expose ROI and payback metrics in PlayerBusiness DTO within packages/shared.
- Add an API endpoint GET /economy/simulation or GET /economy/roi for inspecting current economic multipliers and next best upgrade recommendations.

### R5. Strict Domain Boundary (Preserved for Astra 6.0)
- Do NOT alter or create UI/UX visual elements, React screens, or CSS styling in apps/web (reserved for Astra 6.0).
- Do NOT alter anti-cheat/anti-fraud algorithms, Sybil clustering, or penetration tests (reserved for Astra 6.0).

## Acceptance Criteria

### Starter Balance & Onboarding Verification
- [ ] New player initialization tests verify that new users receive 100 starter Cash (or 600 if referred) and can immediately unlock Street Stand.
- [ ] First-session activation flow transitions smoothly without zero-income deadlock.

### ROI & Mathematical Balance Verification
- [ ] Payback period and marginal ROI formulas have 100% unit test coverage with mathematical assertions across all 6 business tiers.
- [ ] Compact number formatting cleanly formats values from 0 up to 10^15 (quadrillions).

### Simulation Harness Verification
- [ ] Automated simulation suite runs 1h, 24h, and 7-day headless runs with deterministic outputs.
- [ ] Simulation tests verify that reaching late-game businesses (Factory, Tech Co, Global Holding) follows a smooth pacing curve without runaway inflation.

### Workspace Integrity & Double-Check Quality Gates
- [ ] pnpm check (ESLint, Prettier, TypeScript across 4 packages, Vitest test suite, Vite build, Wrangler dry-run) passes with 0 errors.
- [ ] Existing 137 tests remain 100% green; new tests bring coverage even higher.
- [ ] Full handoff documentation updated in HANDOFF.md.

## 2026-09-14T17:53:29Z

Complete the missing game loop API endpoints for Project Empire — the Telegram idle business game. The SQL migration and store layer are already written; the team must wire up routes, update the test harness, write tests, and verify everything passes `pnpm check`.

Working directory: c:\Users\Administrator\Desktop\telegram kripto oyunu
Integrity mode: demo

## Context — What Already Exists

The monorepo has a complete backend with 226 passing tests across 22 files. The following are **already on disk and must NOT be rewritten**:

- `supabase/migrations/202609140007_game_loop_apis.sql` — 8 new RPC functions: `empire_claim_offline_earnings`, `empire_upgrade_business`, `empire_get_game_state`, `empire_bind_referral`, `empire_get_referral_status`, `empire_get_active_missions`, `empire_claim_mission`, `empire_get_streak`
- `apps/api/src/economy/store.ts` — `EconomyStore` interface and `SupabaseEconomyStore` already extended with all 8 new methods (claim, upgrade, getGameState, bindReferral, getReferralStatus, getActiveMissions, claimMission, getStreak)
- `packages/shared/src/index.ts` — All DTOs already defined: `ClaimCashRequest/Response`, `UpgradeBusinessRequest/Response`, `BindReferralRequest/Response`, `ClaimMissionRequest/Response`, `PlayerMissionInstance`, `PlayerStreakDto`, `PlayerReferralOverview`, `PlayerState`

Existing working endpoints (in `apps/api/src/economy/routes.ts`): `GET /economy/roi`, `GET /economy/simulation`.

## Requirements

### R1. Economy Game Loop Routes
Add `POST /economy/claim` (offline earnings claim) and `POST /economy/upgrade` (business upgrade) to the existing economy routes file (`apps/api/src/economy/routes.ts`). Both must require auth session, validate request bodies with the existing Zod schemas from `@empire/shared`, call the corresponding store methods, and return properly typed responses. Error cases (`INSUFFICIENT_CASH`, `BUSINESS_NOT_FOUND`, etc.) must return appropriate HTTP 4xx codes.

### R2. Game State, Mission, Referral & Streak Routes
Create new route modules or extend existing ones for:
- `GET /game/state` — Full combined player state (auth required)
- `GET /missions/active` — Current day's active missions (auth required)
- `POST /missions/:id/claim` — Claim a completed mission reward (auth required)
- `GET /streak` — Current streak status (auth required)
- `POST /referral/bind` — Bind a referral code (auth required)
- `GET /referral/status` — Referral overview (auth required)

All routes must be mounted in `apps/api/src/index.ts` at both `/` and `/api` prefixes (follow the existing pattern for auth, leaderboard, shop, config, analytics, economy routes).

### R3. Test Database Harness Extension
Update `apps/api/src/auth/test-db.ts` to register the new migration file `202609140007_game_loop_apis.sql` and add RPC dispatch cases for all 8 new functions. Follow the existing pattern exactly (switch/case on RPC name, map parameters, execute SQL via PGlite transaction).

### R4. Workspace Integrity
- Do NOT modify any UI/UX components in `apps/web/` (reserved for Astra 6.0)
- Do NOT modify anti-cheat/anti-fraud algorithms (reserved for Astra 6.0)
- Do NOT rewrite the SQL migration, store methods, or shared DTOs — they are already complete
- Preserve all existing tests and functionality

## Acceptance Criteria

### Game Loop Functionality
- [ ] `POST /economy/claim` returns `ClaimCashResponse` with correct `claimedAmount`, `newBalance`, `claimedAt`, `isCapped` fields
- [ ] `POST /economy/upgrade` with valid `businessSlug` deducts cash and returns updated business state
- [ ] `POST /economy/upgrade` with insufficient cash returns 400 with `INSUFFICIENT_CASH`
- [ ] `POST /economy/upgrade` with invalid slug returns 400 with `BUSINESS_NOT_FOUND`
- [ ] `GET /game/state` returns combined player economy state, businesses, season info
- [ ] `POST /referral/bind` with valid code applies +500 cash referral boost
- [ ] `POST /referral/bind` with self-referral returns error
- [ ] `GET /referral/status` returns referral code, invite counts, badges
- [ ] `GET /missions/active` returns array of today's mission instances
- [ ] `GET /streak` returns current streak data with `canClaimToday` flag
- [ ] All endpoints return 401 for unauthenticated requests

### Quality Gates
- [ ] `pnpm check` (lint, format:check, typecheck, test, build) exits with code 0
- [ ] All new routes have at least one integration test per endpoint using the PGlite test harness
- [ ] No regressions: all 226 existing tests continue to pass
- [ ] All changes documented in `HANDOFF.md`

## 2026-09-14T19:27:24Z

Complete the missing game loop API endpoints for Project Empire — the Telegram idle business game — and wire them up to the newly created game screens in `apps/web`. The SQL migration and store layer are already written on disk; the team must implement the HTTP routes, update the local test database harness, write comprehensive integration tests, connect the frontend actions, and verify everything passes `pnpm check`.

Working directory: c:\Users\Administrator\Desktop\telegram kripto oyunu
Integrity mode: demo

## Requirements

### R1. Economy Game Loop Routes
Implement `POST /economy/claim` (offline earnings claim) and `POST /economy/upgrade` (business upgrade) in `apps/api/src/economy/routes.ts`.
- Require authenticated session cookie.
- Validate request bodies using existing Zod schemas from `@empire/shared`.
- Call store methods (`claimOfflineEarnings`, `upgradeBusiness`).
- Return properly typed HTTP responses with correct status codes (400 for `INSUFFICIENT_CASH` or `BUSINESS_NOT_FOUND`, 401 for unauthorized).

### R2. Game State, Mission, Referral & Streak Routes
Create route modules and mount them in `apps/api/src/index.ts` under both `/` and `/api` prefixes:
- `GET /game/state` — Full combined player economy, businesses, and season state.
- `GET /missions/active` — Current active daily and weekly missions.
- `POST /missions/:id/claim` — Claim a completed mission reward.
- `GET /streak` — Current streak status and claimable flag.
- `POST /referral/bind` — Bind a referral code and apply the +500 Cash bonus.
- `GET /referral/status` — Current user's referral code, count, and tier badges.

### R3. Test Database Harness Extension
Update `apps/api/src/auth/test-db.ts`:
- Register migration `202609140007_game_loop_apis.sql`.
- Add RPC dispatch cases for all 8 new functions (`empire_claim_offline_earnings`, `empire_upgrade_business`, `empire_get_game_state`, `empire_bind_referral`, `empire_get_referral_status`, `empire_get_active_missions`, `empire_claim_mission`, `empire_get_streak`) via PGlite transactions.

### R4. Frontend Live Game Connection
Update `apps/web/src/game/live-game.tsx`:
- Pass `onClaim` and `onUpgrade` handlers to `EmpireScreen` to trigger `POST /economy/claim` and `POST /economy/upgrade`.
- Wire `MissionsScreen` to `GET /api/missions/active` and `POST /api/missions/:id/claim`.
- Wire `FriendsScreen` to `GET /api/referral/status` and `POST /api/referral/bind`.

### R5. Workspace Integrity & Quality Gates
- Preserve all existing 232 passing unit and integration tests.
- Add integration tests for all new endpoints.
- Ensure `pnpm check` (lint, format:check, typecheck, test, build) exits with code 0.
- Document all changes in `HANDOFF.md`.

## Acceptance Criteria

### API Functionality & Verification
- [ ] `POST /economy/claim` successfully claims offline earnings and returns updated balance.
- [ ] `POST /economy/upgrade` upgrades business level and deducts cash; rejects when cash is insufficient with 400 `INSUFFICIENT_CASH`.
- [ ] `GET /game/state` returns full player state.
- [ ] `POST /referral/bind` applies referral boost (+500 Cash) and rejects self-referral.
- [ ] `GET /referral/status` returns referral link data and tier stats.
- [ ] `GET /missions/active` and `POST /missions/:id/claim` return and fulfill missions.
- [ ] `GET /streak` returns current streak day and claimability.
- [ ] All endpoints enforce authentication and return 401 for unauthenticated requests.

### Quality & Build Verification
- [ ] `pnpm check` (eslint, prettier, typecheck, vitest, build) passes with 0 errors.
- [ ] Integration tests verify all new endpoints against the PGlite test harness.
- [ ] `HANDOFF.md` updated with progress and verification results.


## 2026-09-15T06:14:17Z

Design and implement the independent R9 Anti-Fraud and Reward Review System for Project Empire (Telegram crypto idle business game), strictly preserving all Codex/Sol game-loop files, frontend UI screens, and payment modules.

Working directory: c:\Users\Administrator\Desktop\telegram kripto oyunu
Integrity mode: demo

## Boundaries & Constraints (Strict)
- **DO NOT TOUCH** Codex/Sol game-loop files:
  - `supabase/migrations/202609140007_game_loop_apis.sql`
  - `apps/api/src/auth/test-db.ts`
  - `apps/api/src/economy/**`
  - `apps/web/src/game/**`
- **DO NOT TOUCH** visual screens or styling (`apps/web/src/screens/**`, CSS).
- **DO NOT TOUCH** payment/shop system (`apps/api/src/shop/**`).
- Use `supabase/migrations/202609140008_anti_fraud.sql` for database schema migration.
- Keep the test database environment identical to the real migration (do NOT create test-only compatibility columns).
- Do NOT deploy, push, or merge to git remotes.
- Document all modified/added files, test results, known boundaries, and next steps in `HANDOFF.md`.

---

## Requirements

### R1. Fraud Detection Signals & Explainable Risk Scoring Engine
Implement deterministic fraud detection signals and risk scoring in `packages/game-core`:
- Detect suspicious economy velocity (abnormal cash/season point gain rates exceeding physical maximum production).
- Detect replay and burst requests (rapid successive actions violating debounce/rate ceilings).
- Detect multi-account and IP/device clustering anomalies (same IP/fingerprint across multiple accounts).
- Detect referral abuse and sybil rings (chains of accounts self-referring or circular invite trees).
- Calculate normalized risk score (0–100) with explainable reason codes (e.g. `RAPID_BURST_REQUESTS`, `VELOCITY_CAP_EXCEEDED`, `DEVICE_CLUSTER_DETECTED`, `CIRCULAR_REFERRAL_SUSPECT`).

### R2. Database Schema & RLS Migration (`202609140008_anti_fraud.sql`)
Author `supabase/migrations/202609140008_anti_fraud.sql`:
- Create tables:
  - `fraud_flags`: logs detected suspicious events, risk score, reason codes, target entity (user, transaction, reward).
  - `frozen_rewards`: holds pending/frozen reward claims with status (`frozen`, `approved`, `rejected`), amounts, and lock timestamps.
  - `admin_roles`: assigns roles (`admin`, `superadmin`, `auditor`) to authorized user IDs.
- Configure strict Row Level Security (RLS) on all tables; revoke public/anon/authenticated access and grant permissions strictly to `service_role`.
- Create stored procedures/functions for flag creation, reward freezing, admin review, and audit logging with `security definer` / `security invoker` set to public schema.

### R3. Admin Review, Decision & Audit APIs
Implement admin API endpoints in `apps/api/src/fraud` (or mounted under `/admin/fraud` and `/api/admin/fraud`):
- Role-based access control (RBAC): require valid session and verify the authenticated user possesses an active admin role; return 403 `FORBIDDEN` for unauthorized users and 401 for unauthenticated.
- `GET /admin/fraud/flags`: list flagged events with filtering by status, user, risk level, and date.
- `GET /admin/fraud/frozen`: list currently frozen rewards pending review.
- `POST /admin/fraud/review`: submit review decision (`approve` or `reject`) with mandatory admin notes/reasoning.
  - On `approve`: unfreeze reward and credit balance to player balance via atomic ledger entry.
  - On `reject`: permanently cancel frozen reward and record reason.
  - Record audit log entry in `admin_audit_logs` capturing admin ID, target, old/new values, and justification.

### R4. Test Database Harness Extension & Quality Verification
- Create an independent test harness runner for anti-fraud tests (e.g. `apps/api/src/fraud/test-db.ts` or standalone test setup) that executes real migrations including `202609140008_anti_fraud.sql` without modifying `apps/api/src/auth/test-db.ts`.
- Write unit tests in `packages/game-core` for all risk scoring and signal detection algorithms.
- Write comprehensive integration tests in `apps/api` covering flag creation, reward freezing, RBAC authorization, admin approve/reject flows, audit logs, and 401/403 security boundaries.
- Ensure all 252 existing tests continue to pass and `pnpm check` exits with code 0.

---

## Acceptance Criteria

### Security & Fraud Detection
- [ ] Risk scoring function produces deterministic scores (0–100) and structured reason codes for velocity, replay, clustering, and referral abuse.
- [ ] Suspicious rewards are quarantined in `frozen_rewards` with status `frozen` and not immediately credited to player balances.
- [ ] Direct access to fraud tables by unauthenticated, anon, or regular users is blocked by RLS policies.

### Admin Review & RBAC API
- [ ] Non-admin authenticated users attempting to access `/admin/fraud/*` receive HTTP 403 `FORBIDDEN`.
- [ ] Unauthenticated requests to `/admin/fraud/*` receive HTTP 401 `UNAUTHORIZED`.
- [ ] `GET /admin/fraud/flags` returns paginated list of fraud flags with risk scores and reason codes.
- [ ] `GET /admin/fraud/frozen` returns active frozen rewards.
- [ ] `POST /admin/fraud/review` with decision `approve` releases frozen rewards to player balance and logs audit entry.
- [ ] `POST /admin/fraud/review` with decision `reject` cancels frozen reward and logs audit entry.

### Workspace Integrity & Quality Gates
- [ ] No changes made to `supabase/migrations/202609140007_game_loop_apis.sql`, `apps/api/src/auth/test-db.ts`, `apps/api/src/economy/**`, `apps/web/src/game/**`, `apps/web/src/screens/**`, or `apps/api/src/shop/**`.
- [ ] All 252 existing tests continue to pass (0 regressions).
- [ ] All new anti-fraud unit and integration tests pass cleanly.
- [ ] `pnpm check` (lint, format:check, typecheck, test, build) completes with exit code 0.
- [ ] `HANDOFF.md` updated with full documentation of changed files, test results, known boundaries, and next steps.

## 2026-09-15T07:19:14Z

Complete the mission and referral progression lifecycle for Project Empire (daily/weekly mission assignment, real-time action progress, daily streak claiming, qualified referral milestone verification) and establish production launch readiness (real PostgreSQL concurrency & load tests, monitoring telemetry, backup, and rollback runbooks).

Working directory: c:\Users\Administrator\Desktop\telegram kripto oyunu
Integrity mode: demo

## Boundaries & Constraints
- Preserve existing game loop functionality and anti-fraud boundaries.
- Keep all UI/visual components in `apps/web/src/screens/` isolated (do not modify styling or screen layout).
- All new database schema modifications or migrations must use sequential numbering (e.g. `202609140009_missions_and_launch.sql` if a new migration is required, or extend existing test runners cleanly).
- Real PostgreSQL / PGlite tests must verify actual transaction isolation and row locking (`FOR UPDATE`).
- Do not perform git push, release, or remote deployments.
- Document all modified files, test outputs, concurrency benchmarks, and runbooks in `HANDOFF.md`.

---

## Requirements

### R1. Mission Pool Assignment & Real-Time Action Progression
Implement the end-to-end mission lifecycle:
- Automated assignment: assign 3 daily missions (1 easy, 1 normal, 1 hard) and 1 weekly mission to the player upon daily login / state initialization if not already assigned for the current calendar date/week.
- Action progression hooks:
  - Increment mission progress on player game actions (`POST /economy/claim` increments `claim_cash_*` and `claim_offline_4h` when duration criteria met; `POST /economy/upgrade` increments `upgrade_any_*`, `reach_milestone`, `upgrade_factory_tier`).
  - When `progress >= target`, transition mission instance status to `completed`.
- Claiming rewards: `POST /missions/:id/claim` awards Season Points (`round(multiplier * currentSRU)`), transitions status to `claimed`, increments `season_scores.mission_points` and player balance atomically with duplicate prevention.

### R2. Daily Streak Evaluation & Claim Endpoint
Implement complete streak mechanics:
- Endpoint: `POST /streak/claim` (and `/api/streak/claim`).
- Evaluate consecutive days:
  - If last claim was yesterday (UTC date - 1), increment `current_streak` by 1.
  - If Day 7 reached and claimed, award cycle bonus (1.0x SRU) and reset cycle counter cleanly.
  - If a day was missed (> 1 day elapsed), reset `current_streak` to 1.
  - Reject duplicate claims on the same calendar day with 400 `ALREADY_CLAIMED`.
- Update `player_streaks` and credit Season Points atomically to `player_balances.season_points` and active `season_scores`.

### R3. Qualified Referral Progression & Referrer Rewards
Complete the qualified referral lifecycle:
- Trigger milestone evaluations when an invitee progresses:
  - `activation`: invitee completes first business upgrade (highest level >= 1) -> 0.5x SRU.
  - `retained_d2`: invitee logs in across >= 2 distinct calendar days -> 1.0x SRU.
  - `retained_d7`: invitee active on >= 4 distinct days within 7 days -> 2.0x SRU.
  - `progression`: invitee total empire levels >= 10 -> 1.5x SRU.
- Mark `referrals.status = 'qualified'`, update `is_qualified = true` with `qualified_at = now()`.
- Insert `referral_events` rows and provide an endpoint / automated routine to claim pending referral rewards, updating the referrer's Season Points and tier stats.

### R4. Real PostgreSQL Concurrency & Load Stress Harness
Author rigorous concurrency and load test suites under real transaction conditions:
- Test concurrent racing balance updates: multiple parallel requests claiming cash or upgrading simultaneously must preserve invariant balance consistency without double-spend or negative balances.
- Test concurrent streak and mission claim race conditions: simultaneous requests with the same session must execute exactly once (idempotent row locks via `FOR UPDATE`).
- Test concurrent referral bindings: simultaneous binding of referral codes must cleanly handle unique constraints without deadlocks.
- Load benchmark script (`pnpm test:load` or standalone simulation): simulate 100+ virtual concurrent players performing interleaved game loop cycles, verifying database connection pool stability, zero unhandled errors, and throughput latency metrics.

### R5. Production Operations Runbook: Monitoring, Backup & Rollback Plan
Create comprehensive operational documentation in `docs/ops/`:
- `MONITORING.md`: Telemetry architecture, KPI metrics (`dau`, `qap`, `sru`, error rate, p95/p99 latency), health check probes, and anomaly alert thresholds.
- `BACKUP_AND_DISASTER_RECOVERY.md`: Automated snapshot policies, WAL archiving, Point-In-Time-Recovery (PITR) procedures, and recovery time/point objectives (RTO < 15m, RPO < 1m).
- `ROLLBACK_PLAN.md`: Reversible migration scripts for all database migrations (0001 through latest), feature flag kill-switches (`feature.referrals`, `feature.token`, `feature.stars_payments`), and emergency API circuit-breaker procedures.

---

## Acceptance Criteria

### Missions & Streak
- [ ] Players receive 3 daily + 1 weekly mission instances upon first action/state fetch of the calendar day.
- [ ] Upgrading businesses and claiming offline cash automatically advances relevant mission progress and flips status to `completed` upon target completion.
- [ ] `POST /missions/:id/claim` awards Season Points and rejects uncompleted or already claimed missions.
- [ ] `POST /streak/claim` awards daily points (and Day 7 cycle bonus), advances streak counter, and prevents same-day double claims.

### Referral Qualification
- [ ] Invitee progression triggers qualification milestones (`activation`, `retained_d2`, `retained_d7`, `progression`).
- [ ] Referrer correctly receives milestone rewards upon qualification, updating invite counts and unlocking badges.

### Concurrency & Performance
- [ ] Concurrency test suite runs 20+ parallel racing requests against PGlite/Postgres with zero race conditions or double crediting.
- [ ] Load simulation executes 100 concurrent player sessions without deadlocks or unhandled exceptions.

### Operations Runbooks
- [ ] `docs/ops/MONITORING.md`, `docs/ops/BACKUP_AND_DISASTER_RECOVERY.md`, and `docs/ops/ROLLBACK_PLAN.md` created with actionable, production-ready procedures.

### Quality Gates
- [ ] All existing test suites continue to pass with 0 regressions.
- [ ] `pnpm check` (lint, format:check, typecheck, test, build) completes with exit code 0.
- [ ] `HANDOFF.md` updated with progress, test results, benchmarks, and next steps.

## 2026-09-16T06:00:11Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Execute prompt via teamwork_preview multi-agent system
> Requested team: Maximum 4 concurrent agents with strict sub-domain context isolation (each agent only accesses its assigned files and responsibilities)

Implement Step 8 (Telegram Stars payments, pass entitlements, webhook security, pre-checkout verification) and Step 9 (Admin dashboard UI, RBAC governance for @Barandnz and @Mberked, config feature flags, and audit logging) for Project Empire.

Working directory: c:\Users\Administrator\Desktop\telegram kripto oyunu
Integrity mode: demo

## Architecture & Agent Boundary Constraints (Max 4 Concurrent Agents)
To prevent context pollution and token waste, the teamwork execution MUST divide work into at most 4 specialized, strictly isolated streams:

1. **Stream 1 - Payment Backend & Webhook Security Agent**:
   - Scope: `apps/api/src/shop/`, `packages/shared/src/`
   - Only reads and modifies payment routing, invoice creation, Telegram webhook verification, and entitlement store.
2. **Stream 2 - Shop & Stars Mini App UI Agent**:
   - Scope: `apps/web/src/screens/shop-screen.tsx`, `apps/web/src/screens/shop-analytics.css`, `apps/web/src/game/`
   - Only reads and modifies shop view rendering, Telegram `openInvoice` trigger, purchase status feedback, and feature flag gate.
3. **Stream 3 - Admin Backend & Governance Agent**:
   - Scope: `apps/api/src/config/`, `apps/api/src/fraud/`, `apps/api/src/admin/`, `supabase/migrations/`
   - Only reads and modifies admin endpoints, RBAC enforcement (`empire_admin_check_role` for `@Barandnz` and `@Mberked`), feature flag store, and audit logging.
4. **Stream 4 - Admin UI Dashboard Agent**:
   - Scope: `apps/web/src/screens/admin-screen.tsx`, `apps/web/src/admin/`, `apps/web/src/shell/`
   - Only reads and modifies the visual admin management interface (feature flag switches, fraud review queue, system status KPIs).

---

## Requirements

### R1. Telegram Stars (XTR) Payment Backend & Webhook Security (Adım 8)
- Implement invoice generation endpoint (`POST /shop/invoice`) returning a compliant Telegram Stars invoice or link.
- Webhook verification & handler (`POST /shop/webhook` or Telegram updates handler):
  - Validate `X-Telegram-Bot-Api-Secret-Token` header against configured secret.
  - Handle `pre_checkout_query`: validate payload, currency (`XTR`), invoice existence, and return `answerPreCheckoutQuery` with `ok: true` (or explanatory error).
  - Handle `successful_payment`: atomically mark invoice as paid, credit entitlements (Empire Pass, cosmetic badges), record ledger transaction, and ensure idempotent execution (replay-safe).
  - Provide refund / support status lookup endpoint (`GET /shop/invoices/:id`).

### R2. Shop Frontend & Mini App Payment Flow (Adım 8)
- Update `ShopScreen` to support seamless Telegram Stars purchasing:
  - If `feature.stars_payments` is enabled, allow clicking purchase to initiate `Telegram.WebApp.openInvoice`.
  - Listen for invoice status (`paid`, `cancelled`, `failed`, `pending`) and update UI optimistically with clear user feedback.
  - If disabled, display "Yakında" (Coming Soon) badge and prevent transaction submission.
  - Ensure zero layout shift on 320px–390px mobile screens.

### R3. Admin Backend & Feature Flag Governance (Adım 9)
- Enforce strict RBAC on all admin endpoints:
  - Verify caller session belongs to an authorized superadmin (`@Barandnz` or `@Mberked` or role = `superadmin`). Return 403 `FORBIDDEN` for unauthorized users.
- Provide feature flag management API:
  - Dynamic toggles for `feature.stars_payments`, `feature.maintenance_mode`, `feature.referrals`, `economy.multiplier`.
  - Idempotent updates with audit logging (`admin_audit_logs` storing admin username, action, before/after values, and timestamp).
- Provide fraud queue review API:
  - List flagged suspicious accounts with risk scores.
  - Endpoints to approve, reject, or unfreeze flagged accounts.

### R4. Admin Web Dashboard UI (Adım 9)
- Create a dedicated, responsive Admin Panel view in `apps/web`:
  - Accessible only when user has admin privileges (`@Barandnz` or `@Mberked`).
  - **Feature Flags Tab**: visual switches to toggle Stars payments, maintenance mode, referral rewards in real-time.
  - **Fraud Review Tab**: visual table of flagged accounts with quick action buttons (İncele, Onayla, Dondurmayı Kaldır).
  - **Audit Log Tab**: chronological feed of recent administrative changes.
- Seamlessly integrate with existing Astra 6.0 theme (dark/light) without altering player screens.

---

## Acceptance Criteria

### Stars Payments (Step 8)
- [ ] Pre-checkout query validates currency (`XTR`), price, and payload, responding with `ok: true`.
- [ ] Successful payment webhook atomically grants Empire Pass / cosmetic item and records transaction.
- [ ] Duplicate payment webhooks with the same `telegram_payment_charge_id` execute idempotently without double-granting.
- [ ] Shop UI integrates with Telegram Mini App `openInvoice` and respects the `feature.stars_payments` toggle.

### Admin Panel & Governance (Step 9)
- [ ] Admin API endpoints strictly reject non-admin users (403 FORBIDDEN) and allow `@Barandnz` & `@Mberked`.
- [ ] Feature flag updates persist to database and write an immutable record to `admin_audit_logs`.
- [ ] Admin Web UI enables toggling feature flags and viewing/resolving flagged fraud cases.
- [ ] Admin screen is hidden from standard players and cleanly styled for both mobile (360px+) and desktop.

### Quality & Performance Gates
- [ ] Unit & integration test suites cover invoice generation, webhook verification, admin RBAC, and fraud review.
- [ ] Monorepo verification passes with 0 errors: `pnpm check` (lint, format:check, typecheck, test, build).
- [ ] `HANDOFF.md` updated with completed changes, test results, and operational instructions.

## 2026-09-16T11:18:25Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Execute prompt via teamwork_preview multi-agent system
> Requested team: Maximum 2 concurrent agents with strict domain isolation (Core Economy & Math Engine vs. Frontend Interactive Mini-Games UI)

Revamp and expand the Project Empire mini-game arcade suite: overhaul the merge game into a vibrant Catizen-style item progression experience, elevate the Cipher game into a thrilling cyber-hack terminal, build a full-featured Notcoin-style Tap-to-Earn game with Cash & Telegram Stars upgrades and strict economic balance, and create a brand-new Crypto Candlestick "Moon or Doom" Crash game.

Working directory: c:\Users\Administrator\Desktop\telegram kripto oyunu
Integrity mode: demo

## Architecture & Agent Boundary Constraints (Max 2 Concurrent Agents)
To respect the user's strict maximum 2-agent concurrency limit and isolate responsibilities:

1. **Stream 1 - Core Math Models, Simulation & Economy Engine**:
   - Scope: `packages/game-core/src/`, `packages/shared/src/`, `apps/api/src/`
   - Responsibilities:
     - Mathematical formulas for Notcoin Tap economy: energy regeneration curve, tap power scaling (`base * 1.5^lvl`), offline TapBot accumulator formulas, and Telegram Stars purchase SKU bindings.
     - Catizen-style merge progression economy: tier multipliers (Tier 1 to 10+), idle cash generation rates per second, drop parcel spawn probabilities, and auto-merge macro solver.
     - Crypto Candlestick / Crash game math: provably fair random walk / multiplier curve, crash point distribution, risk/reward payout calculation.
     - Exhaustive mathematical unit tests and invariant proofs (preventing hyper-inflation or infinite loops).
2. **Stream 2 - Rich Interactive Frontend Mini-Games & Mini App UI**:
   - Scope: `apps/web/src/components/`, `apps/web/src/screens/`, `apps/web/src/game/`
   - Responsibilities:
     - **Catizen-Style Merge Overhaul**: Visual tier progression with vibrant collectible emblems, smooth drag/drop & click merge, particle burst feedback, periodic mystery box parcel drops, idle DPS coin counters, and intelligent auto-bot toggle.
     - **Dynasty Cipher Terminal Revamp**: Cyberpunk terminal styling, audio/visual decrypt pulse, combo multipliers, time-attack pressure, and satisfying hack progress bar.
     - **Notcoin Tap-to-Earn Game**: Big tactile coin with 3D squish tilt, floating damage/coin digits on click, animated energy bar, and upgrade drawer featuring both In-Game Cash and Telegram Stars (TapBot, Multitap, Energy Max, Offline Time Extender).
     - **Crypto Candlestick "Moon or Doom" Crash Game**: Real-time animated canvas/SVG candlestick line, rising multiplier (1.00x -> 10.00x+), Boğa (Long) / Ayı (Short) or instant cash-out button, and win/crash animations.
     - Zero layout shifts on 320px–390px mobile screens, fully integrated with Astra 6.0 theme.

---

## Requirements

### R1. Catizen-Style Merge Game Overhaul (`CatizenMergeGame`)
- Transform the static grid into a living, responsive merge board (3x3 or 4x3):
  - 10+ distinct thematic tiers (e.g. Bronz Çip -> Gümüş Külçe -> Altın Kasa -> Platin Sunucu -> Kripto Çekirdek -> Kuantum Düğüm vb.).
  - Active idle generation: each item on the board generates passive coins per second (visible floating tickers).
  - Mystery parcel drops: every 15-20s, a gift box drops on an empty slot; clicking unboxes a random tier-1 or tier-2 item.
  - Sound/visual juice: bounce animations on drop, particle burst on merge, level-up splash toast.
  - Intelligent Auto-Bot: toggled or purchased assistant that automatically merges matching lowest-tier items and opens parcels smoothly.

### R2. Dynasty Cipher Terminal Revamp (`DynastyCipherGame`)
- Upgrade the memory game into a high-stakes crypto terminal hacking minigame:
  - Dynamic sequence pacing: faster cadence, visual glitch/decrypt particle effects upon correct inputs.
  - Combo streaks: consecutive perfect rounds build a multiplier (1.5x -> 2.0x -> 3.0x payout).
  - Terminal feedback: audio-visual key clicks, firewall progress gauge, and clear win/loss animations.

### R3. Notcoin Tap-to-Earn Clicker Game (`NotcoinTapGame`)
- Implement the canonical Telegram tap-to-earn mechanic:
  - Central 3D tactile coin/emblem with squish deformation and tilt on touch/click.
  - Floating coin numbers (+1, +5 CRIT!) on tap with trajectory physics.
  - Dynamic energy pool (e.g. 1,000 max), depleting per tap and refilling at steady rate.
  - Dual-currency Upgrade Drawer:
    - **Multitap**: +1 coin per tap (upgradeable with in-game Cash & Telegram Stars).
    - **Energy Capacity**: +500 energy cap per level.
    - **Recharging Speed**: +1 energy/sec recovery per level.
    - **TapBot (Auto-Tapper)**: Auto-taps when idle and collects earnings up to offline time limit.
    - **Offline Safe Extender**: Extends TapBot offline collection time (from 3h to 6h, 12h, 24h via Stars).
  - Rigorous economic balancing in `@empire/game-core` to guarantee sustainable sink/faucet ratios.

### R4. New Game: Crypto Candlestick "Moon or Doom" Crash Game (`CryptoCrashGame`)
- High-intensity crypto market mini-game:
  - Real-time animated green/red candlestick chart with rising profit multiplier (1.00x upwards).
  - Player places stake and chooses "BOĞA (Rally)" with a manual "KÂRI AL" (Cash Out) button before the market dumps/crashes!
  - Thrilling 10-15s rounds with dynamic chart ticks, tension sound/visual feedback, and payout multipliers.

---

## Acceptance Criteria

### Catizen Merge Overhaul
- [ ] Board supports drag/drop and click merge with bounce & particle animations.
- [ ] Items on board produce passive coins/sec, and mystery gift parcels periodically land on open slots.
- [ ] Auto-Merge Bot cleans and merges matching pairs automatically without deadlocks.

### Cipher Terminal
- [ ] Sequence inputs feel snappy with cyber-decrypt visuals and combo streak multipliers.
- [ ] Round difficulty scales progressively with clear visual feedback.

### Notcoin Tap-to-Earn
- [ ] Responsive multi-touch tap target with 3D squish and floating text digits.
- [ ] Energy depletion and regeneration loop functions smoothly and persists state.
- [ ] Upgrade shop supports both In-Game Cash and Telegram Stars purchases with idempotent transaction handling.
- [ ] TapBot calculates and credits offline earnings up to configured cap upon returning to the game.

### Crypto Candlestick Crash Game
- [ ] Candlestick chart animates smoothly at 60fps with clear multiplier readout.
- [ ] Cash-out button instantly secures winnings before the randomized crash point.

### Quality & Performance Gates
- [ ] Monorepo verification passes with 0 errors: `pnpm check` (lint, format:check, typecheck, test, build).
- [ ] All new game models covered by comprehensive unit & stress tests in `packages/game-core`.
- [ ] Mobile responsive layout tested for 320px–390px screens with zero horizontal overflow.
- [ ] `HANDOFF.md` updated with game mechanics, mathematical formulas, and test evidence.

## 2026-09-16T12:42:13Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Execute prompt via teamwork_preview multi-agent system
> Requested team: Maximum 2 concurrent agents with strict domain isolation (Core Math & API vs. Frontend UI Components)

Implement free-text custom stake inputs in the Risk (Crypto Crash) game, integrate a dynamic adaptive house-edge/baiting curve (encouraging small wins but punishing sudden high-roller spikes), and extend daily login streaks with exponential milestone bonuses for 7 days, 30 days, 90 days, 180 days, and 365 days.

Working directory: c:\Users\Administrator\Desktop\telegram kripto oyunu
Integrity mode: demo

## Architecture & Agent Boundary Constraints (Max 2 Concurrent Agents)
To conserve tokens and prevent context pollution:

1. **Stream 1 - Core Math, Adaptive Crash Engine & Streak Milestones**:
   - Scope: `packages/game-core/src/crypto-crash.ts`, `packages/game-core/src/missions.ts`, `apps/api/src/arcade/`
   - Responsibilities:
     - Free-range stake validation (min 10, max user balance).
     - Adaptive crash algorithm: tracks player recent average stake and win streaks; when player bets normal/modest amounts, preserves high win engagement; when player spikes stake (e.g. >2.5x average or large jump after consecutive wins), increases probability of low-multiplier crash (<1.5x) to prevent house bleed and guarantee long-term house advantage.
     - Streak milestone calculator: adds 7-day, 30-day (1 month), 90-day (3 months), 180-day (6 months), and 365-day (1 year) milestones with escalating exponential Cash and Season Point multipliers.
2. **Stream 2 - Frontend Risk Game & Streak Milestone UI**:
   - Scope: `apps/web/src/components/crypto-crash-game.tsx`, `apps/web/src/screens/missions-screen.tsx`, `apps/web/src/components/arcade.css`
   - Responsibilities:
     - Editable numeric input box in Crypto Crash game alongside quick-chip buttons, allowing free typing of any stake amount with instant validation.
     - Extended streak milestone visual track on Missions/Streak screen displaying 7-day, 30-day, 90-day, 180-day, and 365-day claim targets with milestone badge rewards.
     - Responsive mobile styling (320px–390px) without layout overflow.

---

## Requirements

### R1. Risk Game Custom Free Stake Input
- Replace/enhance fixed chip buttons in `CryptoCrashGame` with an interactive number input:
  - Players can type any amount directly (e.g. 250, 1500, 10000) or tap quick chips (+10, +50, +100, MAKS).
  - Validates boundaries in real-time ($10 \le \text{stake} \le \text{playerCash}$).

### R2. Adaptive Crash / Baiting Math Engine
- Update crash point generation to model realistic psychological casino dynamics:
  - Under baseline/modest stakes, maintain high perceived RTP and frequent green runs.
  - When player suddenly increases bet (stake $> 2.5\times$ baseline) or bets high after a win streak, dynamically bias crash distribution toward early dumps ($1.00\times - 1.45\times$), ensuring the house retains long-term profitability.

### R3. Extended Daily Streak Milestones (7d, 30d, 90d, 180d, 365d)
- Expand streak system beyond 7 days with compounding milestone bonuses:
  - Day 7: 1.0x SRU + 500 Cash
  - Day 30 (1 Ay): 2.5x SRU + 5,000 Cash
  - Day 90 (3 Ay): 5.0x SRU + 25,000 Cash
  - Day 180 (6 Ay): 10.0x SRU + 100,000 Cash
  - Day 365 (1 Yıl): 25.0x SRU + 500,000 Cash + "İmparatorluk Kıdemlisi" Badge
- Update streak UI to visually showcase upcoming and unlocked long-term milestones.

---

## Acceptance Criteria

### Risk Game
- [ ] Number input allows typing any custom stake with immediate validation and clamping.
- [ ] Adaptive crash engine fuzzed: small steady stakes yield high win frequency, sudden spike bets trigger house edge correction.

### Streak Milestones
- [ ] Milestone rewards calculated accurately for 7, 30, 90, 180, and 365 days.
- [ ] UI displays milestones progress clearly on mobile (320px–390px).

### Quality Gates
- [ ] `pnpm check` passes with 0 errors (lint, format:check, typecheck, tests, build).
- [ ] `HANDOFF.md` updated with new features and tests.

## 2026-09-17T09:38:35Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Execute prompt via teamwork_preview multi-agent system
> Requested team: Maximum 4 concurrent agents with strict sub-domain context isolation (each agent dedicated to a specific UI/animation domain)

Project Empire Telegram Mini App kapsamındaki tüm kullanıcı arayüzlerini (UI), mikro-etkileşimleri, ekran geçişlerini ve mini oyun deneyimlerini yüksek kaliteli, akıcı (60fps), modern mobil oyun standartlarında animasyonlu, ışıltılı (cyber-luxe neon/gold) ve göz alıcı bir görsel şölene dönüştürme.

Working directory: c:\Users\Administrator\Desktop\telegram kripto oyunu
Integrity mode: demo

## Architecture & Agent Boundary Constraints (Max 4 Concurrent Agents)
Context kirliliğini ve token israfını önlemek için çalışma 4 kesin ayrık görsel uzmanlık alanına bölünmüştür:

1. **Stream 1 - Global Tasarım Sistemi, Micro-Interactions & Navigasyon Animasyonları**:
   - Scope: `apps/web/src/styles.css`, `apps/web/src/game/game-layout.tsx`, `apps/web/src/components/`, `apps/web/src/app.tsx`
   - Sorumluluk:
     - Global CSS animasyon kütüphanesi (parıltı/shimmer, nabız/pulse, 3D tilt, buton basış sönümleme/spring haptics).
     - Sekmeler arası yumuşak slide/fade geçişleri, aktif sekme altı ışık çubuğu/halo efekti.
     - Üst bar (Cash, Season Points, Level) dinamik sayı sayacı (odometer/slot roll efekti) ve para arttıkça altın kıvılcım patlamaları.

2. **Stream 2 - İmparatorluk (Empire) & Şehir/Holding Görsel Deneyimi**:
   - Scope: `apps/web/src/screens/empire-screen.tsx`, `apps/web/src/screens/empire-missions.css`, `apps/web/src/components/city-silhouette.tsx`
   - Sorumluluk:
     - 16 işletme kartının görsel zenginleştirilmesi: Seviye yükseltmede (Upgrade) neon kart çerçevesi patlaması, seviye rozetleri animasyonu.
     - "Tümünü Topla" ve periyodik nakit üretiminde yüzen altın coin yağmuru (`+₺1.4M` floating trajectory).
     - Arka plan canlı şehir silüeti: gece/gündüz veya dinamik hareket eden ışıklar, gökdelen pencereleri nabzı.

3. **Stream 3 - Arcade & Mini Oyunlar "Game Juice" & Parçacık Fırtınası**:
   - Scope: `apps/web/src/components/arcade.css`, `apps/web/src/components/catizen-merge-game.tsx`, `apps/web/src/components/crypto-crash-game.tsx`, `apps/web/src/components/notcoin-tap-game.tsx`, `apps/web/src/components/dynasty-cipher-game.tsx`
   - Sorumluluk:
     - **Notcoin Tap**: 3D dinamik squish deformation, çoklu dokunuşta kritik vuruş (`CRIT! +50`) kıvılcımları, dolan enerji barında neon akış dalgası.
     - **Catizen Merge**: İki kutu birleştiğinde patlayan konfeti/yıldız parçacıkları, kutu açılma sarsıntısı, 100 seviye için ayırt edici renk gradyanları ve parlama efektleri.
     - **Crypto Crash**: Canlı mum grafiğinde yükselen roket/neon çizgi izi, gerilim kalp atışı nabzı, kazanç/patlama anında ekran sarsıntısı (screen shake) ve zafer flaşı.
     - **Dynasty Cipher**: Matrix tarzı veri akışı, hack başarılı olduğunda terminal parazit (glitch) ve deşifre neon ışığı.

4. **Stream 4 - Sosyal, Görevler, Mağaza & Ödül Kutlama Modalları**:
   - Scope: `apps/web/src/screens/friends-screen.tsx`, `apps/web/src/screens/missions-screen.tsx`, `apps/web/src/screens/shop-screen.tsx`, `apps/web/src/screens/clans-screen.tsx`, `apps/web/src/screens/social.css`, `apps/web/src/screens/shop-analytics.css`
   - Sorumluluk:
     - **Streak & Milestones**: 7g, 30g, 90g, 180g, 365g ödül yolunda neon enerji bağı, ödül talep edildiğinde sandık açılma (chest unlock) kutlama animasyonu.
     - **Ortaklık Primi & Davet**: "Kasaya Aktar" butonunda altın ışıma, arkadaş davet kartında parıldayan binde 1 rozetleri.
     - **Karteller / Klanlar**: Klan sıralamasında ilk 3 için altın, gümüş, bronz auralar, klan seviye atlama görseli.
     - **Stars Mağazası**: Empire Pass ve kozmetikler için lüks kart parıltısı ve hologram etkisi.

---

## Requirements

### R1. Global Micro-Interactions & Fluid Tab Transitions
- Her etkileşimli bileşene (buton, kart, çip) dokunsal (tactile) spring animasyonu ve aktif basış hissi (`scale(0.96)`, neon glow) entegre edilmeli.
- Sekmeler arası geçişlerde ekran ani sıçramamalı; yumuşak geçiş efektleriyle yüklenmeli.
- Bakiye artışlarında sayılar anlık zıplamak yerine akıcı bir sayaç interpolasyonu ve yüzen semboller ile kullanıcıya kazancı hissettirmeli.

### R2. Empire Screen Visual Overhaul & Juicy Upgrades
- 16 işletme kartı kartel/siber-holding temasına uygun yüksek kontrastlı cam (glassmorphism), neon kenarlıklar ve seviye ilerleme çubukları ile donatılmalı.
- Seviye atlama (Upgrade) butonuna tıklandığında tatmin edici bir ışık dalgası ve seviye atlama bildirim animasyonu tetiklenmeli.
- Şehir arka planı statik bir resim olmaktan çıkarılıp hafif animasyonlu derinlik/parallax hissi kazandırılmalı.

### R3. Arcade Suite "Juice": Physics Particles, 3D Squish & Dynamic Canvas FX
- Notcoin Tap'te dokunma açısına göre 3D eğilme (tilt), parçacık yayılımı ve haptik titreşim desteği.
- Catizen Merge'de kutuların yerine oturması, birleşme patlaması ve hediye paketi iniş animasyonları kusursuzlaştırılmalı.
- Crypto Crash'te çarpan arttıkça hızlanan arka plan dalgalanması, patlama anında dramatize edilmiş kırmızı sis ve zafer anında konfeti patlaması.

### R4. Reward Celebrations, Level-Up Modals & Social Visuals
- Günlük giriş ödülü, görev tamamlama veya prim kasaya aktarıldığında ekrana gelen "Tebrikler" modalında parçacık fışkırması (confetti canvas).
- Klanlar ve Liderlik tablosunda dereceler parıltılı rozetlerle öne çıkarılmalı.
- Tüm görsel efektler 320px–390px mobil ekranlarda sıfır taşma (zero layout shift / no horizontal scroll) kuralına uymalı ve düşük donanımlı cihazlarda dahi 60fps çalışmalı (GPU hızlandırmalı transform/opacity).

---

## Acceptance Criteria

### Global & Navigasyon
- [ ] Butonlar ve kartlar dokunulduğunda akıcı basış animasyonu ve ışık yansıması sunar.
- [ ] Bakiye ve puan artışlarında dinamik animasyonlu artış göstergeleri çalışır.

### İmparatorluk & İşletmeler
- [ ] 16 işletme kartı cam efekti ve neon parlama ile görsel olarak zenginleştirilmiştir.
- [ ] Seviye yükseltme anında kart seviye atlama animasyonu ve yüzen para efekti oynar.

### Mini Oyunlar (Arcade)
- [ ] Notcoin coin'i 3D squish/tilt ve çoklu dokunuş parçacık efektleriyle tepki verir.
- [ ] Catizen Merge birleşmelerinde parçacık patlaması ve pürüzsüz animasyon vardır.
- [ ] Crypto Crash gerilim nabzı ve patlama/kazanç görsel efektleri eksiksizdir.

### Sosyal & Mağaza
- [ ] Streak yolculuğu ve ödül talep animasyonları kutlama hissi verir.
- [ ] Ortaklık primi (binde 1) ve klan arayüzü modern siber-finans tarzında ışıltılıdır.

### Kalite ve Performans Standartları
- [ ] `pnpm check` (lint, format:check, typecheck, tüm vitest testleri ve build) sıfır hata ile geçer.
- [ ] Tüm animasyonlar CSS `transform` ve `opacity` veya optimize edilmiş Canvas ile çalışır, FPS düşüşüne sebep olmaz.
- [ ] Mobil ekranlarda (320px, 360px, 390px) sıfır taşma garantisi.

## 2026-09-17T10:50:36Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Execute comprehensive testing and quality verification via teamwork_preview multi-agent system
> Requested team: Maximum 2 concurrent agents with strict domain isolation (Core Math & Game Engine Tests vs. Full Integration, API & Monorepo Verification)

Project Empire Telegram Mini App projesindeki yeni mini oyunların (Kripto Mayın Tarlası, Tahmin Piyasası, Çöküş, Catizen Birleştirme, Notcoin Tıklama), binde 1 ciro primi ve referral mantığının, API dev-store şemalarının ve tüm monorepo testlerinin 2 paralel uzman ajanla uçtan uca test edilmesi ve doğrulanması.

Working directory: c:\Users\Administrator\Desktop\telegram kripto oyunu
Integrity mode: development

## Architecture & Agent Boundary Constraints (Max 2 Concurrent Agents)
Token israfını önlemek ve sorumlulukları net ayrıştırmak amacıyla çalışma 2 kesin çalışma alanına bölünmüştür:

1. **Stream 1 - Çekirdek Matematik Modelleri ve Mini Oyun Birim Testleri**:
   - Scope: `packages/game-core/`, `apps/web/src/game/crypto-mines-model.ts`, `apps/web/src/game/crypto-predictions-model.ts`
   - Sorumluluk:
     - **Mayın Tarlası (Mines) Olasılık & Çarpan Testi**: \((1 - \text{edge}) \times \prod \frac{25 - i}{25 - m - i}\) formülünün matematiksel doğruluğu, 1-20 mayın limitleri, kasa avantajı kuralı, geçerli kâr alma ve patlama senaryoları.
     - **Tahmin Piyasası (Predictions) Model Testi**: EVET/HAYIR oran hesaplamaları, kupon kazanç çarpanları, bakiye düşümü ve kâr tahsilatı limit testleri.
     - **Çöküş (Crash) & Adaptif Kasa Algoritması Testi**: Düşük ve yüksek bahislerdeki dinamik risk çarpanı, ani bahis artışı cezalandırma ve patlama noktası doğrulama testleri.
     - **Binde 1 (%0.1) Ciro ve Kademeli Komisyon Hesaplama**: 1M ciroda 1.000 nakit ve %3, %5, %7 komisyon basamaklarının kesin sayısal testleri.

2. **Stream 2 - API Uç Noktaları, Zod Şema Doğrulaması & Monorepo Sağlık Kapısı**:
   - Scope: `apps/api/`, `apps/web/`, `packages/shared/`
   - Sorumluluk:
     - **Görevler (Missions) & Streak API Doğrulaması**: `getActiveMissions` ve `getStreak` uç noktalarının Zod şemalarına (`PlayerMissionInstance`, `PlayerStreakDto`) %100 uyumluluğu, görev ödülü talep (`claim`) akışları.
     - **Referral & Ortaklık Primi Entegrasyonu**: Davet linki üretimi, bakiye güncelleme ve kickback claim akışlarının API seviyesinde doğrulanması.
     - **Monorepo Kalite Kapısı**: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` komutlarının hatasız ve 0 uyarı ile tamamlanması.

---

## Requirements

### R1. Mini Oyunlar & Matematik Motoru Kapsamlı Testleri
- Yeni eklenen Kripto Mayın Tarlası (`crypto-mines-model.ts`) için birim test paketi yazılmalı veya koşturulmalı:
  - Mayın üretimi (Fisher-Yates) tekrarsız ve ızgara (25) sınırları içinde olmalı.
  - İlk hamlede güvenli bölge koruması veya adil olasılık çarpanları doğrulanmalı.
- Tahmin Piyasası (`crypto-predictions-model.ts`) bahis kuponu mantığı, çarpanlar ve sonuçlandırma test edilmeli.
- Günlük giriş serisi (7g, 30g, 90g, 180g, 365g) bonuslarının ve binde 1 ciro primi matematiksel sınırlarının testleri yapılmalı.

### R2. API Şemaları ve Dev-Store Dayanıklılık Testleri
- Görevler sekmesinin çökmesine neden olan Zod şema uyumsuzluklarının giderildiği doğrulanmalı (`id` UUID kontrolü, `difficulty`, `key`, `assignedDate` varlığı).
- API `/api/missions`, `/api/streak`, `/api/referral/status` ve `/api/economy/roi` rotalarının geçerli ve beklenen tipte veri döndürdüğü doğrulanmalı.

### R3. Monorepo Derleme ve Entegrasyon Doğrulaması
- Tüm workspace paketleri (`packages/shared`, `packages/game-core`, `apps/api`, `apps/web`) tip denetiminden (`typecheck`) 0 hata ile geçmeli.
- Mevcut vitest test suitleri koşturulup başarısız olan testler anında onarılmalı.

---

## Acceptance Criteria

### Mini Oyunlar & Matematik
- [ ] Kripto Mayın Tarlası matematik modeli birim testleri (olasılık hesaplama, mayın dağılımı, kâr alma) %100 başarıyla tamamlanır.
- [ ] Tahmin Piyasası bahis hesaplama ve bakiye doğrulama testleri hatasız geçer.
- [ ] Binde 1 ciro primi ve kademeli komisyon hesaplamaları test senaryolarında beklenen değerleri verir.

### API & Entegrasyon
- [ ] Görevler (`/api/missions`) ve Seri (`/api/streak`) endpoint'leri Zod şemalarından 0 validasyon hatasıyla geçer.
- [ ] Mini oyunlar ile web arayüzü arasındaki bakiye güncelleme akışı doğrulanır.

### Kalite ve Süreç
- [ ] `pnpm typecheck` tüm paketlerde 0 hata verir.
- [ ] `pnpm test` (vitest) tüm test paketlerini başarıyla geçer.
- [ ] `HANDOFF.md` güncellenerek test sonuçları ve kanıtları raporlanır.

## 2026-09-17T12:26:55Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Comprehensive read-only audit to identify UX/usage bugs (without modifying code) and produce a detailed findings report
> Requested team: Exactly 1 audit agent (read-only, find bugs only, do not patch)

Project Empire Telegram Mini App projesinde az önce tespit ettiğimiz türden (Telegram WebView başlıkları eksik ham fetch çağrıları, F5 yenilemesinde sıfırlanan arayüz durumları, catch/finally bloklarında sahte başarı gösteren modallar, mutasyon sonrası güncellenmeyen bakiyeler, bağlanmamış handler'lar vb.) tüm kullanım ve akış hatalarını tespit eden salt-okunur (read-only) kapsamlı bir denetim ve hata raporlama görevi.

Working directory: c:\Users\Administrator\Desktop\telegram kripto oyunu
Integrity mode: development

## Requirements

### R1. Frontend Ekran ve İletişim Akışları Denetimi (Read-Only)
- `apps/web/src/screens/` ve `apps/web/src/game/` altındaki tüm sekmeleri ve bileşenleri (`empire-screen.tsx`, `friends-screen.tsx`, `shop-screen.tsx`, `clans-screen.tsx`, `arcade-screen.tsx`, `analytics-screen.tsx`, `admin-screen.tsx` vb.) tara:
  - **Ham `fetch` Çağrıları**: `postGameResource` veya `api/client` yerine doğrudan `fetch()` kullanan ve `Authorization` / `X-Empire-Session` başlıklarını göndermeyen yerleri tespit et.
  - **Kör `finally` / Sahte Başarı**: Hata durumunda bile kullanıcıya başarı modalı veya tebrik gösteren akışları bul.
  - **F5 / Sayfa Yenileme Kalıcılığı**: Sunucudan beslenmeyip sadece geçici React state'inde (`useState`) tutulan ve sayfa yenilendiğinde sıfırlanan kritik durumları tespit et.
  - **Eksik Mutasyon & Query Invalidation**: Başarılı bir eylemden sonra kullanıcı bakiyesini, puanını veya ilgili sorguyu güncellemediği için arayüzde değişmeyen yerleri listele.
  - **Bağlanmamış (Dangling) Handler'lar**: Üst bileşenden prop olarak geçilmeyen veya içi boş bırakılmış buton/aksiyon fonksiyonlarını bul.

### R2. Mini Oyunlar & Arcade Akış Denetimi (Read-Only)
- Tüm mini oyun bileşenlerini (`catizen-merge-game.tsx`, `crypto-crash-game.tsx`, `crypto-mines-game.tsx`, `crypto-predictions-game.tsx`, `dynasty-cipher-game.tsx`, `notcoin-tap-game.tsx`) tara:
  - Oyun sonlandığında, kâr alındığında veya can kaybedildiğinde sunucu API'sine bakiye ve puan kaydının doğru yapılıp yapılmadığını incele.
  - Ağ kopması veya API hatası olduğunda kullanıcının parasının havada kalıp kalmadığını ya da haksız kazanç/kayıp oluşup oluşmadığını tespit et.

### R3. Salt-Okunur Kuralı ve Kapsamlı Raporlama
- **KESİNLİKLE HİÇBİR KAYNAK KODU DEĞİŞTİRME VEYA DÜZELTMEYE ÇALIŞMA.**
- Tespit edilen her hatayı şu formatta detaylı bir markdown raporuna dök:
  1. **Hata Başlığı & Etki Derecesi (Kritik / Yüksek / Orta / Düşük)**
  2. **Etkilenen Dosya & Satır Numarası (`file:///...#Lxx`)**
  3. **Hatanın Mekaniği (Kullanıcı ne yaşar?)**
  4. **Önerilen Kalıcı Çözüm Özeti**

## Acceptance Criteria

### Audit & Bug Raporu
- [ ] Kod tabanındaki hiçbir dosya değiştirilmemiş veya bozulmamıştır (`git status` temiz kalır).
- [ ] Tüm ekranlar ve mini oyunlar taranmış, bulunan tüm kullanım/akış hataları tek bir kapsamlı raporda toplanmıştır.
- [ ] Her hata için dosya yolu, satır referansı, kullanıcıya yansıyan etkisi ve önerilen çözüm açıkça belirtilmiştir.

