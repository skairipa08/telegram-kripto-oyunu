# Project: Empire — Mission & Referral Lifecycle and Production Launch Readiness

## Architecture

- **packages/game-core**: Pure, zero-dependency game logic:
  - Missions engine (`src/missions.ts`): canonical pool definitions, pool selector (3 daily: 1 easy, 1 normal, 1 hard + 1 weekly), SRU multipliers, completion check, streak evaluation (`evaluateStreak`).
  - Referral engine (`src/referral.ts`): milestone evaluation (`activation`, `retained_d2`, `retained_d7`, `progression`), SRU multipliers, whale diminishing factor, badge tier calculations.
- **packages/shared**: Shared contracts, Zod schemas, DTOs:
  - `PlayerMissionInstance`, `ClaimMissionRequest`, `ClaimMissionResponse`
  - `PlayerStreakDto`, `ClaimStreakResponse`
  - `ClaimReferralRewardRequest`, `ClaimReferralRewardResponse`, `ReferralEventItem`
- **supabase/migrations/202609140009_missions_and_launch.sql**: Sequential database migration:
  - `missions.reward_points`, `referrals.is_qualified boolean default false`, `referrals.qualified_at timestamptz`
  - Composite concurrency indexes on missions, streaks, referrals, balances
  - Stored procedures with `FOR UPDATE` row locks for atomic operations
- **apps/api**: REST API layer:
  - Automated mission assignment on daily login / state fetch
  - Action hooks in `EconomyStore.claimCash` and `EconomyStore.upgradeBusiness`
  - `POST /missions/:id/claim` (and `/api/missions/:id/claim`)
  - `POST /streak/claim` (and `/api/streak/claim`)
  - `POST /referral/claim` (and `/api/referral/claim`)
  - Referral milestone evaluation on invitee upgrades and logins
- **apps/api/src/launch/test-db.ts & test suite**: Independent PGlite test harness:
  - Executes migrations 0001 through 0009 without modifying `apps/api/src/auth/test-db.ts`
  - Concurrency tests: racing balance updates, racing streak claims, racing mission claims, racing referral bindings
  - `scripts/load-benchmark.ts` / `pnpm test:load`: 100+ virtual concurrent player load simulation
- **docs/ops/**: Production Operations Runbooks:
  - `MONITORING.md`: Telemetry architecture, DAU/QAP/SRU KPIs, health check probes, alert thresholds
  - `BACKUP_AND_DISASTER_RECOVERY.md`: Snapshot policies, WAL archiving, PITR (RTO < 15m, RPO < 1m)
  - `ROLLBACK_PLAN.md`: Reversible migration scripts 0001–0009, feature flags, emergency circuit breakers

## Feature Inventory

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Mission Pool Picker | Deterministically select 3 daily (1 easy, 1 normal, 1 hard) and 1 weekly mission per date | M1 | R1 Spec |
| 2 | Migration 0009 DDL | Add columns, foreign keys, composite indexes, and stored procedures in `202609140009_missions_and_launch.sql` | M1 | R1-R4 Spec |
| 3 | Automated Mission Assignment | Assign daily and weekly mission instances upon daily login / state fetch if not already assigned | M2 | R1 Spec |
| 4 | Action Progression Hooks | Increment mission progress on cash claims (`claim_cash_*`, `claim_offline_4h`) and upgrades (`upgrade_any_*`, `reach_milestone`, `upgrade_factory_tier`), transition to `completed` | M2 | R1 Spec |
| 5 | Mission Claim API | `POST /missions/:id/claim` awards Season Points (`round(multiplier * currentSRU)`), transitions status to `claimed`, increments balances/scores atomically with duplicate prevention | M2 | R1 Spec |
| 6 | Daily Streak Claim API | `POST /streak/claim` evaluates consecutive days, awards daily points and Day 7 cycle bonus (1.0x SRU), resets on missed days, rejects same-day duplicate with 400 `ALREADY_CLAIMED` | M2 | R2 Spec |
| 7 | Invitee Qualification Hooks | Trigger milestone evaluations (`activation`, `retained_d2`, `retained_d7`, `progression`) when invitee upgrades or logs in | M3 | R3 Spec |
| 8 | Referral Qualification & Events | Mark `referrals.status = 'qualified'`, `is_qualified = true`, `qualified_at = now()`, insert `referral_events` rows | M3 | R3 Spec |
| 9 | Referral Reward Claim API | `POST /referral/claim` to claim pending referral rewards, atomically crediting referrer Season Points and updating tier stats | M3 | R3 Spec |
| 10 | Independent Test DB Harness | Standalone PGlite runner executing migrations 0001 through 0009 cleanly without touching `apps/api/src/auth/test-db.ts` | M4 | R4 Spec |
| 11 | Balance Concurrency Test Suite | Test racing balance updates: 20+ parallel requests claiming/upgrading simultaneously preserve invariant balance consistency without double-spend or negative balances | M4 | R4 Spec |
| 12 | Streak & Mission Concurrency Tests | Test racing streak claims and mission claims: simultaneous requests with same session execute exactly once via `FOR UPDATE` row locks | M4 | R4 Spec |
| 13 | Referral Binding Concurrency Tests | Test racing referral bindings: simultaneous binding handles unique constraints without deadlocks | M4 | R4 Spec |
| 14 | 100+ Player Load Benchmark | `scripts/load-benchmark.ts` mapped to `pnpm test:load` simulating 100+ virtual concurrent players performing interleaved game loop cycles with latency/throughput metrics | M4 | R4 Spec |
| 15 | Monitoring & Telemetry Runbook | `docs/ops/MONITORING.md`: Telemetry architecture, KPI metrics (`dau`, `qap`, `sru`, error rate, p95/p99 latency), health probes, anomaly alerts | M5 | R5 Spec |
| 16 | Backup & Disaster Recovery Runbook | `docs/ops/BACKUP_AND_DISASTER_RECOVERY.md`: Automated snapshot policies, WAL archiving, PITR (RTO < 15m, RPO < 1m), failover procedures | M5 | R5 Spec |
| 17 | Rollback & Circuit Breaker Plan | `docs/ops/ROLLBACK_PLAN.md`: Reversible migration scripts (0001–0009), feature flags (`feature.referrals`, `feature.token`, `feature.stars_payments`), emergency circuit-breaker procedures | M5 | R5 Spec |
| 18 | Quality Verification & Gate | 0 regressions, all existing tests pass, new tests pass, `pnpm check` exits 0, Reviewers APPROVE, Challengers APPROVE, Auditor CLEAN | M6 | Acceptance Criteria |

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|--------------|--------|
| M1 | DB Migration & Game Core Utilities | `supabase/migrations/202609140009_missions_and_launch.sql`, `packages/game-core/src/missions.ts` | none | PLANNED |
| M2 | Missions & Daily Streak Lifecycle APIs | `apps/api/src/economy/routes.ts`, `store.ts`, mission assignment, action hooks, claim endpoints | M1 | PLANNED |
| M3 | Qualified Referral Progression & Rewards | `apps/api/src/economy/routes.ts`, `store.ts`, invitee milestone evaluations, referral events, claim endpoint | M1, M2 | PLANNED |
| M4 | PostgreSQL Concurrency & Load Harness | `apps/api/src/launch/test-db.ts`, concurrency test suites, `scripts/load-benchmark.ts`, `package.json` | M1, M2, M3 | PLANNED |
| M5 | Production Operations Runbooks | `docs/ops/MONITORING.md`, `docs/ops/BACKUP_AND_DISASTER_RECOVERY.md`, `docs/ops/ROLLBACK_PLAN.md` | none | PLANNED |
| M6 | Quality Verification & Final Gate | 2 Reviewers, 2 Challengers, 1 Forensic Auditor, `HANDOFF.md` | M1, M2, M3, M4, M5 | PLANNED |

## Interface Contracts

### Missions & Streaks
- `POST /missions/:id/claim` & `POST /api/missions/:id/claim`:
  - Request: `{ requestId: UUID }`
  - Response: `{ apiVersion: 'v1', missionInstanceId: UUID, rewardPoints: number, newSeasonPoints: number, claimedAt: ISOString }`
  - Errors: 400 `ALREADY_CLAIMED`, 400 `NOT_COMPLETED`, 404 `MISSION_NOT_FOUND`
- `POST /streak/claim` & `POST /api/streak/claim`:
  - Request: `{ requestId: UUID }`
  - Response: `{ apiVersion: 'v1', currentStreak: number, rewardPoints: number, isCycleBonus: boolean, newSeasonPoints: number, claimedAt: ISOString }`
  - Errors: 400 `ALREADY_CLAIMED`

### Qualified Referrals
- `POST /referral/claim` & `POST /api/referral/claim`:
  - Request: `{ eventId: UUID, requestId: UUID }`
  - Response: `{ apiVersion: 'v1', eventId: UUID, rewardPoints: number, newSeasonPoints: number, claimedAt: ISOString }`
  - Errors: 400 `ALREADY_CLAIMED`, 404 `EVENT_NOT_FOUND`
- Invitee milestones:
  - `activation`: highestBusinessLevel >= 1 (0.5x SRU)
  - `retained_d2`: distinctActiveDays >= 2 (1.0x SRU)
  - `retained_d7`: distinctActiveDays >= 4 within 7-day window (2.0x SRU)
  - `progression`: totalEmpireLevels >= 10 (1.5x SRU)

## Code Layout

- Implementation files:
  - `supabase/migrations/202609140009_missions_and_launch.sql`
  - `packages/game-core/src/missions.ts`
  - `packages/game-core/src/referral.ts`
  - `packages/shared/src/index.ts`
  - `apps/api/src/economy/routes.ts`
  - `apps/api/src/economy/store.ts`
  - `apps/api/src/launch/test-db.ts`
  - `apps/api/src/launch/concurrency.test.ts`
  - `scripts/load-benchmark.ts`
  - `package.json`
  - `docs/ops/MONITORING.md`
  - `docs/ops/BACKUP_AND_DISASTER_RECOVERY.md`
  - `docs/ops/ROLLBACK_PLAN.md`
- Strictly Preserved / Untouched:
  - `apps/web/src/screens/**` (do not modify styling or screen layout)
  - `apps/api/src/auth/test-db.ts` (preserve legacy test runner untouched)
