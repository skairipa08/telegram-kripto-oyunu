# Review Report: Anti-Fraud Database Migration & Admin API

**Reviewer**: Reviewer 2 (Teamwork Reviewer & Adversarial Critic)  
**Date**: 2026-09-15T09:51:00+03:00  
**Scope**:
- `supabase/migrations/202609140008_anti_fraud.sql`
- `packages/shared/src/index.ts`
- `apps/api/src/fraud/store.ts`
- `apps/api/src/fraud/routes.ts`
- `apps/api/src/fraud/test-db.ts`
- `apps/api/src/fraud/routes.test.ts`
- `apps/api/src/index.ts`

**Overall Verdict**: **APPROVE**

---

## 1. Executive Summary

The Anti-Fraud Database Migration and Admin API implementation has been reviewed across all dimensions: Database Schema correctness, Stored Procedure security definer constraints, RBAC isolation, atomic balance crediting, idempotency, audit logging, dual-prefix mounting, and independent test harness isolation.

The code adheres strictly to the architectural specifications defined in `PROJECT.md` and requirements R2 and R3. No integrity violations, facade implementations, or hardcoded shortcuts were detected.

All target test suites and typechecks pass with 100% success:
- `pnpm --filter @empire/api typecheck` -> EXIT 0
- `pnpm vitest run apps/api/src/fraud/routes.test.ts` -> 18/18 PASS
- `pnpm vitest run packages/game-core/src/fraud.test.ts` -> 45/45 PASS

---

## 2. Detailed Findings by Objective

### Objective 1: Database Schema & Stored Procedures (`202609140008_anti_fraud.sql`)
- **Tables Created**:
  - `public.admin_roles`: Strict check constraint on roles (`'admin'`, `'superadmin'`, `'auditor'`), unique composite key `(user_id, role)`, indexed by `user_id` and `role`.
  - `public.fraud_flags`: Check constraints for target types (`user`, `reward`, `transaction`, `referral`, `session`), severity (`low`, `medium`, `high`, `critical`), risk score range `[0, 100]`, non-empty reason codes array, status (`pending`, `investigating`, `resolved`, `dismissed`).
  - `public.frozen_rewards`: Check constraints for reward types (`cash_claim`, `mission_reward`, `referral_bonus`, `streak_bonus`, `airdrop`), status (`frozen`, `approved`, `rejected`), amounts `amount_cash >= 0`, `amount_season_points >= 0`, `amount_cash > 0 or amount_season_points > 0`, and state-review integrity check: `((status = 'frozen' and reviewed_at is null) or (status in ('approved', 'rejected') and reviewed_at is not null))`.
- **Audit Log Constraint Expansion**:
  - Expanded `admin_audit_logs_action_check` to permit 8 new actions: `fraud_flag_created`, `fraud_flag_reviewed`, `fraud_flag_dismissed`, `reward_frozen`, `reward_approved`, `reward_rejected`, `admin_role_assigned`, `admin_role_revoked`.
  - Expanded `admin_audit_logs_target_type_check` to include `fraud_flag`, `frozen_reward`, and `admin_role`.
  - Set `admin_audit_logs_reason_check` to `reason is null or length(reason) <= 1024`.
- **Row-Level Security (RLS)**:
  - Strict RLS enabled on all 3 tables: `admin_roles`, `fraud_flags`, `frozen_rewards`.
  - Explicitly revoked all permissions from `public`, `anon`, and `authenticated`.
  - Granted `select, insert, update, delete` exclusively to `service_role`.
- **8 Security Definer Stored Procedures**:
  1. `public.empire_admin_check_role(uuid, text)`: Correct hierarchical check (`superadmin` > `admin` > `auditor`).
  2. `public.empire_fraud_create_flag(uuid, text, text, integer, text[], text, jsonb)`: Computes severity fallback, updates user risk score via `greatest()`, logs `analytics_events`.
  3. `public.empire_fraud_freeze_reward(uuid, text, bigint, bigint, text, uuid, text, jsonb)`: Validates positive amounts, writes frozen record, emits `reward_frozen` analytics and audit log.
  4. `public.empire_admin_review_reward(uuid, uuid, text, text)`: Performs row-level lock (`FOR UPDATE`), checks status is `'frozen'`, executes atomic balance updates on `player_balances` and `season_scores`, generates 64-hex SHA-256 idempotency key for `reward_ledger`, logs `admin_audit_logs`, and marks linked `fraud_flags` resolved.
  5. `public.empire_admin_review_flag(uuid, uuid, text, text)`: Locks row, updates status, writes audit log.
  6. `public.empire_admin_get_fraud_flags(...)`: Stable query, pagination, returns total count and joins user profile metadata.
  7. `public.empire_admin_get_frozen_rewards(...)`: Stable query, pagination, joins user profile and current balance.
  8. `public.empire_admin_assign_role(uuid, text, uuid)`: Role validation, superadmin authorization guard, writes audit log.
  - All 8 procedures explicitly set `search_path = 'public'` and revoke execute from `public`, `anon`, `authenticated`, granting execute solely to `service_role`.

### Objective 2: Admin API & RBAC
- **Authentication & Authorization**:
  - Missing or invalid cookies return `401 UNAUTHORIZED`.
  - Expired session tokens return `401 UNAUTHORIZED`.
  - Authenticated non-admin users return `403 FORBIDDEN`.
  - Auditors are permitted read access (`GET /admin/fraud/flags`, `GET /admin/fraud/frozen`) returning `200 OK`.
  - Auditors attempting mutations (`POST /admin/fraud/review`) are blocked with `403 FORBIDDEN`.
- **Review Mutation Guardrails**:
  - Validates payload with Zod `adminFraudReviewRequestSchema` (min 1 char reason, strictly typed decision enum).
  - Handles `409 ALREADY_REVIEWED` when trying to review a previously resolved/rejected reward.
  - Handles `404 REWARD_NOT_FOUND` on invalid reward IDs.
  - Generates 64-character hex hash: `encode(sha256(('unfreeze_approval_' || p_frozen_reward_id::text)::bytea), 'hex')` matching `/^[a-f0-9]{64}$/`.
- **Dual-Prefix Mount**:
  - Mounted in `apps/api/src/index.ts` under both `/` and `/api`:
    - `/admin/fraud/flags` & `/api/admin/fraud/flags`
    - `/admin/fraud/frozen` & `/api/admin/fraud/frozen`
    - `/admin/fraud/review` & `/api/admin/fraud/review`
  - Verified identical behavior and responses in automated test suite.

### Objective 3: Independent Test DB Harness (`apps/api/src/fraud/test-db.ts`)
- Implements standalone in-memory PGlite test runner.
- Features defensive migration loading via `existsSync` to prevent test-suite fragility.
- Provides mock fetcher that executes RPCs under local transaction role `service_role`.
- `apps/api/src/auth/test-db.ts` was confirmed to be 100% untouched by any fraud-related code.

---

## 3. Adversarial Analysis & Stress-Testing

| Scenario / Attack Vector | Blast Radius | Mitigation / Defense in Code | Result |
|---|---|---|---|
| **Concurrent double-review attempt** | Double payout or race condition | PostgreSQL row lock `FOR UPDATE` serializes reviews; status check rejects subsequent attempt with `ALREADY_REVIEWED` (HTTP 409). Idempotency key prevents ledger duplication. | **PASS** |
| **Auditor role elevation attack** | Unauthorized reward unfreezing / financial alteration | `empire_admin_review_reward` procedure enforces `empire_admin_check_role(admin_user_id, 'admin')`, denying `auditor` role. Route middleware checks role before RPC execution. | **PASS** |
| **Direct table access bypass via anon/authenticated Supabase client** | Information disclosure or arbitrary unfreezing | Tables have RLS enabled with `REVOKE ALL` from public/anon/authenticated and `GRANT ... TO service_role`. All RPCs are revoked from public/anon/authenticated. | **PASS** |
| **Exceedingly large review note injection** | Database check constraint failure causing 500 error | Both stored procedures employ defensive string truncations (`left(p_notes, 1024)` and `left(p_notes, 1000)`), ensuring compliance with column length constraints. | **PASS** |
| **Replay attack on approved reward unfreezing** | Duplicate balance additions | SHA-256 hash idempotency key recorded in `public.reward_ledger` with `ON CONFLICT (idempotency_key) DO NOTHING`. | **PASS** |

---

## 4. Integrity Violation Check

- **Hardcoded test results**: None. Real SQL execution and Zod validation.
- **Dummy/facade logic**: None. Full transactional database logic with locking, balance updates, and audit logging.
- **Bypassed work / shortcuts**: None. All 8 security definer functions, 3 tables, and router endpoints are fully implemented.
- **Self-certifying work**: Verified independently via live PGlite test harness, TypeScript compiler, and Vitest runner.

**Integrity Status**: **CLEAN (No violations detected)**.

---

## 5. Non-Blocking Context Note for Orchestrator

During whole-repository test runs (`pnpm test`), existing tests in `apps/api/src/auth/routes.test.ts` and related legacy suites fail because another worker added `'202609140007_game_loop_apis.sql'` to `apps/api/src/auth/test-db.ts` while omitting the actual SQL migration file on disk. 

The anti-fraud team properly isolated their work in `apps/api/src/fraud/test-db.ts` with `existsSync` guards, ensuring that anti-fraud builds, typechecks, and tests remain 100% resilient and passing (18/18 passing in `routes.test.ts`, 45/45 passing in `fraud.test.ts`).
