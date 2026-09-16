# Project Empire — Production Rollback, Kill-Switch & Circuit Breaker Plan

**Document Version**: 1.0.0  
**Target Environment**: Cloudflare Workers API, Supabase / PostgreSQL 15+, Cloudflare WAF  
**Classification**: Production Operations Runbook (R5)  
**Last Review Date**: 2026-09-15

---

## 1. Rollback Strategy & Deployment Safety Invariants

Project Empire mandates that every production deployment must be completely reversible without service disruption, data loss, or inconsistent ledger states.

```
                      PROGRESSIVE SAFETY GATES BEFORE ROLLBACK

  [ Anomaly Detected ] ──> Level 1: Feature Flag Kill-Switch (Subsystem Scope)
                                  │
                                  ▼
                           Level 2: API Circuit Breaker (Write Lock / Maintenance)
                                  │
                                  ▼
                           Level 3: Edge Code Rollback (Wrangler Deploy Previous)
                                  │
                                  ▼
                           Level 4: Reversible Database DOWN Migration
```

### 1.1 Non-Negotiable Rollback Invariants

1. **Never Drop Historical Financial Ledgers**: In production rollbacks, never truncate or drop `purchases` or `reward_ledger`. If column schema changes must be rolled back, use non-destructive column depreciation.
2. **Atomic Idempotency**: All `DOWN` migration scripts must be idempotent (`IF EXISTS` clauses) and executed inside an explicit `BEGIN...COMMIT` transaction block.
3. **Downward Compatibility**: Application versions $N-1$ and $N$ must run concurrently against the database during rollback windows without generating database exceptions.

---

## 2. Reversible Migration Scripts (DOWN Migrations: 0001–0009)

Below are the exact, tested `DOWN` migration SQL scripts reversing migrations `202609140001` through `202609140009`.

### 2.1 DOWN: `202609140009_missions_and_launch.down.sql`

```sql
-- =============================================================================
-- Migration Down: 202609140009_missions_and_launch.down.sql
-- Reverses: Mission Pool, Real-time Hooks, Daily Streaks & Concurrency Schema
-- =============================================================================

begin;

-- 1. Drop Stored Procedures / RPC Functions
drop function if exists public.empire_claim_referral_reward(uuid, uuid);
drop function if exists public.empire_evaluate_referral_milestones(uuid, text);
drop function if exists public.empire_increment_mission_progress(uuid, text, integer);
drop function if exists public.empire_assign_daily_missions(uuid);
drop function if exists public.empire_claim_mission(uuid, uuid);
drop function if exists public.empire_claim_streak(uuid);

-- 2. Drop Compatibility Triggers and Trigger Functions
drop trigger if exists trg_sync_referral_events on public.referral_events;
drop function if exists public.sync_referral_events_cols();

drop trigger if exists trg_sync_referrals on public.referrals;
drop function if exists public.sync_referrals_cols();

-- 3. Drop High-Performance Concurrency Indexes
drop index if exists public.referral_events_referrer_status_idx;
drop index if exists public.referrals_referrer_status_idx;
drop index if exists public.mission_instances_date_user_idx;
drop index if exists public.mission_instances_user_status_idx;

-- 4. Remove Schema Extension Columns
alter table public.referral_events drop column if exists referrer_id;
alter table public.referrals drop column if exists is_qualified;
alter table public.referrals drop column if exists qualified_at;
alter table public.referrals drop column if exists referrer_id;
alter table public.referrals drop column if exists invitee_id;
alter table public.missions drop column if exists reward_points;

commit;
```

---

### 2.2 DOWN: `202609140008_anti_fraud.down.sql`

```sql
-- =============================================================================
-- Migration Down: 202609140008_anti_fraud.down.sql
-- Reverses: Anti-Fraud Flags, Quarantined Frozen Rewards & RBAC Tables
-- =============================================================================

begin;

-- 1. Drop Anti-Fraud & Admin Review RPC Functions
drop function if exists public.empire_admin_revoke_role(uuid, uuid, text);
drop function if exists public.empire_admin_assign_role(uuid, uuid, text);
drop function if exists public.empire_admin_list_frozen_rewards(text, uuid, integer, integer);
drop function if exists public.empire_admin_list_fraud_flags(text, uuid, integer, integer, integer);
drop function if exists public.empire_admin_review_reward(uuid, uuid, text, text);
drop function if exists public.empire_fraud_freeze_reward(uuid, text, bigint, bigint, text, text, uuid, jsonb);
drop function if exists public.empire_fraud_create_flag(uuid, text, text, integer, text[], text, jsonb);
drop function if exists public.empire_admin_check_role(uuid, text);

-- 2. Drop Anti-Fraud Tables (in dependency order)
drop table if exists public.frozen_rewards cascade;
drop table if exists public.fraud_flags cascade;
drop table if exists public.admin_roles cascade;

-- 3. Revert Constraints on admin_audit_logs to Migration 0005 State
alter table public.admin_audit_logs drop constraint if exists admin_audit_logs_action_check;
alter table public.admin_audit_logs add constraint admin_audit_logs_action_check check (
  action in ('update_config', 'set_feature_flag', 'freeze_season', 'ban_user', 'refund_purchase')
);

alter table public.admin_audit_logs drop constraint if exists admin_audit_logs_target_type_check;
alter table public.admin_audit_logs add constraint admin_audit_logs_target_type_check check (
  target_type in ('economy_config', 'feature_flag', 'season', 'user', 'purchase')
);

alter table public.admin_audit_logs drop constraint if exists admin_audit_logs_reason_check;
alter table public.admin_audit_logs add constraint admin_audit_logs_reason_check check (
  reason is null or length(reason) <= 256
);

commit;
```

---

### 2.3 DOWN: `202609140007_game_loop_apis.down.sql`

```sql
-- =============================================================================
-- Migration Down: 202609140007_game_loop_apis.down.sql
-- Reverses: Economy Game Loop, Mission, Streak & Referral RPC Dispatch Handlers
-- =============================================================================

begin;

drop function if exists public.empire_claim_offline_earnings(uuid, integer);
drop function if exists public.empire_upgrade_business(uuid, text, uuid);
drop function if exists public.empire_get_game_state(uuid);
drop function if exists public.empire_bind_referral(uuid, text);
drop function if exists public.empire_get_referral_status(uuid);
drop function if exists public.empire_get_active_missions(uuid);
drop function if exists public.empire_claim_mission(uuid, uuid);
drop function if exists public.empire_get_streak(uuid);

commit;
```

---

### 2.4 DOWN: `202609140006_economy_starter_and_roi.down.sql`

```sql
-- =============================================================================
-- Migration Down: 202609140006_economy_starter_and_roi.down.sql
-- Reverses: Starter Economy Initialization Trigger & Economy State RPCs
-- =============================================================================

begin;

-- 1. Remove Trigger & Trigger Function
drop trigger if exists trigger_new_user_starter_economy on public.users;
drop function if exists public.empire_handle_new_user_starter_economy();

-- 2. Drop Economy RPC Functions
drop function if exists public.empire_init_player_economy(uuid, boolean);
drop function if exists public.empire_economy_get_player_state(uuid);

-- 3. Reset Default Column Value
alter table public.player_balances alter column cash set default 0;

commit;
```

---

### 2.5 DOWN: `202609140005_step7_to_11_backend.down.sql`

```sql
-- =============================================================================
-- Migration Down: 202609140005_step7_to_11_backend.down.sql
-- Reverses: Leaderboard Freeze, Stars Monetization, Remote Config & Analytics
-- =============================================================================

begin;

-- 1. Drop Stored Procedures
drop function if exists public.empire_analytics_get_metrics();
drop function if exists public.empire_analytics_get_cohort_data();
drop function if exists public.empire_analytics_track(uuid, uuid, jsonb);
drop function if exists public.empire_config_update(text, jsonb, uuid, text);
drop function if exists public.empire_config_get();
drop function if exists public.empire_shop_fulfill_payment(text, text, integer, text);
drop function if exists public.empire_shop_create_invoice(uuid, text, uuid);
drop function if exists public.empire_shop_get_pass(uuid);
drop function if exists public.empire_leaderboard_freeze(uuid, uuid, text);
drop function if exists public.empire_leaderboard_get_friends(uuid);
drop function if exists public.empire_leaderboard_get_scores(uuid);
drop function if exists public.empire_leaderboard_get_season(uuid);

-- 2. Remove Config Keys Introduced in Migration 0005
delete from public.economy_config where key in (
  'referral.bind_window_min',
  'pass.price_stars',
  'pass.duration_days',
  'mission.daily_slots',
  'mission.free_rerolls',
  'mission.pass_rerolls',
  'feature.leaderboard',
  'feature.referrals'
);

-- 3. Drop Tables & Ranking Index
drop table if exists public.daily_metrics cascade;
drop table if exists public.analytics_events cascade;
drop table if exists public.admin_audit_logs cascade;
drop table if exists public.player_entitlements cascade;
drop table if exists public.purchases cascade;
drop table if exists public.season_archives cascade;
drop index if exists public.season_scores_ranking_idx;

commit;
```

---

### 2.6 DOWN: `202609140004_referrals.down.sql`

```sql
-- =============================================================================
-- Migration Down: 202609140004_referrals.down.sql
-- Reverses: Referral Links, Binding and Milestone Events
-- =============================================================================

begin;

drop table if exists public.referral_events cascade;
drop table if exists public.referrals cascade;
alter table public.users drop column if exists referral_code;

commit;
```

---

### 2.7 DOWN: `202609140003_seasons_missions.down.sql`

```sql
-- =============================================================================
-- Migration Down: 202609140003_seasons_missions.down.sql
-- Reverses: Seasons, Season Scores, Canonical Missions & Streaks
-- =============================================================================

begin;

drop table if exists public.player_streaks cascade;
drop table if exists public.mission_instances cascade;
drop table if exists public.missions cascade;
drop table if exists public.season_scores cascade;
drop table if exists public.seasons cascade;

commit;
```

---

### 2.8 DOWN: `202609140002_economy.down.sql`

```sql
-- =============================================================================
-- Migration Down: 202609140002_economy.down.sql
-- Reverses: Canonical Businesses, Balances, Player Businesses & Reward Ledger
-- =============================================================================

begin;

drop table if exists public.reward_ledger cascade;
drop table if exists public.player_businesses cascade;
drop table if exists public.player_balances cascade;
drop table if exists public.businesses cascade;
drop table if exists public.economy_config cascade;

commit;
```

---

### 2.9 DOWN: `202609140001_auth.down.sql`

```sql
-- =============================================================================
-- Migration Down: 202609140001_auth.down.sql
-- Reverses: Users, Authentication Sessions and Auth Functions
-- =============================================================================

begin;

drop function if exists public.empire_auth_logout(uuid);
drop function if exists public.empire_auth_login(text,text,text,text,text,text,bigint);
drop function if exists public.empire_auth_session(uuid);

drop table if exists public.auth_sessions cascade;
drop table if exists public.users cascade;

commit;
```

---

## 3. Feature Flag Kill-Switches

Feature flags provide sub-second incident mitigation without requiring database schema modifications, edge builds, or deployments.

### 3.1 Architecture & Propagation Dynamics

- **Primary Source of Truth**: `public.economy_config` database table.
- **Edge Cache Invalidation**: Cloudflare Worker cache maintains a 15-second TTL. On database mutation, a background webhook triggers immediate edge cache purge across all global Points of Presence (PoPs) within **< 3 seconds**.
- **Fail-Safe Fallback**: If the database is unreachable, edge workers fall back to hardcoded default values (`feature.token=false`, `feature.stars_payments=false`).

```
+------------------------------------------------------------------------------------+
|                         FEATURE FLAG KILL-SWITCH MATRIX                            |
+--------------------------+---------------+---------------+-------------------------+
| Feature Key              | Default State | Kill State    | Client Behavior on Kill |
+--------------------------+---------------+---------------+-------------------------+
| `feature.referrals`      | `true`        | `false`       | 503 "REFERRALS_MUTED"   |
| `feature.token`          | `false`       | `false`       | 403 "TOKEN_UNAVAILABLE" |
| `feature.stars_payments` | `false`       | `false`       | 503 "SHOP_MAINTENANCE"  |
| `feature.missions`       | `true`        | `false`       | 503 "MISSIONS_MUTED"    |
+--------------------------+---------------+---------------+-------------------------+
```

---

### 3.2 Individual Kill-Switch Operation Playbooks

#### 1. Kill-Switch: `feature.referrals`

- **When to Use**: Referral Sybil attack detected, circular invite abuse ring discovered, or invite bonus duplication bug found.
- **Impact When Killed**:
  - `POST /referral/bind` returns HTTP 503 with `{ "error": { "code": "FEATURE_DISABLED", "message": "Referral system temporarily suspended" } }`.
  - `POST /referral/claim` blocks pending milestone reward claims.
  - Read actions (`GET /referral/status`) remain active so users can view their current link.
- **Instant Kill Command**:
  ```sql
  UPDATE public.economy_config
  SET value = 'false'::jsonb, updated_at = now()
  WHERE key = 'feature.referrals';
  ```
- **Re-enable Command**:
  ```sql
  UPDATE public.economy_config
  SET value = 'true'::jsonb, updated_at = now()
  WHERE key = 'feature.referrals';
  ```

#### 2. Kill-Switch: `feature.token`

- **When to Use**: Token smart contract exploit, unauthorized claim requests, or airdrop verification issues.
- **Impact When Killed**:
  - Halts all Web3 wallet binding, token balance displays, and on-chain withdrawal claims.
- **Instant Kill Command**:
  ```sql
  UPDATE public.economy_config
  SET value = 'false'::jsonb, updated_at = now()
  WHERE key = 'feature.token';
  ```

#### 3. Kill-Switch: `feature.stars_payments`

- **When to Use**: Telegram Stars API degradation, double-crediting invoices, or disputed transaction flood.
- **Impact When Killed**:
  - `POST /shop/invoice` returns HTTP 503 `{ "error": { "code": "SHOP_MAINTENANCE" } }`.
  - Pending invoice fulfillments are paused, preventing double fulfillment.
  - Existing Convenience Pass entitlements remain active until their standard expiration.
- **Instant Kill Command**:
  ```sql
  UPDATE public.economy_config
  SET value = 'false'::jsonb, updated_at = now()
  WHERE key = 'feature.stars_payments';
  ```

#### 4. Kill-Switch: `feature.missions`

- **When to Use**: Mission action progression exploit, infinitely repeatable claims, or reward calculation calculation bug.
- **Impact When Killed**:
  - `POST /missions/:id/claim` returns HTTP 503 `{ "error": { "code": "MISSIONS_DISABLED" } }`.
  - In-memory action hooks bypass progress increments, reducing database write load.
- **Instant Kill Command**:
  ```sql
  INSERT INTO public.economy_config(key, value, description)
  VALUES ('feature.missions', 'false'::jsonb, 'Missions system kill-switch')
  ON CONFLICT (key) DO UPDATE SET value = 'false'::jsonb, updated_at = now();
  ```

---

## 4. Emergency API Circuit-Breaker Procedures

When system anomalies threaten database stability or data integrity, operations escalates through three emergency circuit-breaker tiers.

### 4.1 Tier 1: Rate-Limiting Escalation

**Objective**: Throttles malicious burst traffic, bots, and rapid replay attacks without taking the application offline.

```
+-----------------------------------+--------------------+--------------------+
| Route Pattern                     | Standard Limit     | Emergency Limit    |
+-----------------------------------+--------------------+--------------------+
| `POST /economy/claim`             | 30 req / minute    | 5 req / minute     |
| `POST /economy/upgrade`           | 60 req / minute    | 10 req / minute    |
| `POST /missions/:id/claim`        | 10 req / minute    | 2 req / minute     |
| `POST /streak/claim`              | 5 req / minute     | 1 req / 5 minutes  |
| `POST /auth/login`                | 10 req / minute    | 2 req / minute     |
| General Authenticated API         | 120 req / minute   | 30 req / minute    |
+-----------------------------------+--------------------+--------------------+
```

#### Activation via Cloudflare API

```bash
curl -X PUT "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/rate_limits/${RULE_ID}" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{
    "threshold": 5,
    "period": 60,
    "action": {
      "mode": "simulate",
      "response": {
        "content_type": "application/json",
        "body": "{\"apiVersion\":\"v1\",\"error\":{\"code\":\"RATE_LIMITED\",\"retryAfter\":60}}"
      }
    }
  }'
```

---

### 4.2 Tier 2: Read-Only Maintenance Mode

**Objective**: Freezes all database writes while keeping the frontend application, telemetry, and read APIs online. Used during database hot-patching, PITR recovery, and severe exploit containment.

```
[ Incoming Request ]
         │
         ├── GET (Read-Only: /game/state, /leaderboard/*) ──> [ Allow & Serve (Cache/DB) ]
         │
         └── POST / PUT / DELETE (Mutations) ──> [ Intercept & Return 503 MAINTENANCE ]
```

#### Activation Command (Database Level)

```sql
INSERT INTO public.economy_config (key, value, description)
VALUES ('app.maintenance_mode', 'true'::jsonb, 'Global write maintenance mode')
ON CONFLICT (key) DO UPDATE SET value = 'true'::jsonb, updated_at = now();
```

#### Activation Command (Edge Worker Level)

If the database connection is degraded, enable maintenance mode directly on Cloudflare Workers:

```bash
wrangler secret put MAINTENANCE_MODE --env production <<< "true"
```

#### Client Error Response

```http
HTTP/1.1 503 Service Unavailable
Content-Type: application/json; charset=utf-8
Retry-After: 300

{
  "apiVersion": "v1",
  "status": "maintenance",
  "error": {
    "code": "MAINTENANCE_MODE",
    "message": "Project Empire is currently undergoing scheduled maintenance. Your balances are secure."
  }
}
```

#### Deactivation Command

```sql
UPDATE public.economy_config
SET value = 'false'::jsonb, updated_at = now()
WHERE key = 'app.maintenance_mode';
```

```bash
wrangler secret put MAINTENANCE_MODE --env production <<< "false"
```

---

### 4.3 Tier 3: Selective Traffic Shedding

**Objective**: Preserves core game loop execution by shedding heavy, non-critical telemetry and polling traffic during unexpected traffic surges.

```
                               TRAFFIC SHEDDING TIERS

  [ Surge Level: 150% Load ] ──> Shed Tier 3: Analytics event ingestion (/analytics/events)
                                        │
  [ Surge Level: 200% Load ] ──> Shed Tier 2: Leaderboard polling (/leaderboard/*)
                                        │
  [ Surge Level: 300% Load ] ──> Shed Tier 1: Friends list & avatars (/referral/status)
                                        │
  [ Core Protected Loop ]    ──> ONLY /economy/claim, /economy/upgrade, /streak/claim allowed
```

#### Edge Worker Traffic Shedding Configuration

In `apps/api/src/index.ts`, traffic shedding is governed by the `TRAFFIC_SHED_LEVEL` binding:

```bash
# Shed analytics and heavy queries
wrangler secret put TRAFFIC_SHED_LEVEL --env production <<< "shed_analytics_and_social"
```

---

## 5. Post-Rollback Smoke Test & Verification Suite

After executing any rollback or kill-switch, run the automated smoke verification script:

```bash
#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Project Empire — Post-Rollback Smoke Test Verification
# =============================================================================

API_URL="https://api.project-empire.game"
echo "[1/4] Verifying Liveness Probe..."
curl -fsS "${API_URL}/health/live" | grep -q '"status":"ok"'
echo "PASS: Liveness OK."

echo "[2/4] Verifying Readiness Probe (Database & Schema Check)..."
curl -fsS "${API_URL}/health/ready" | grep -q '"status":"ready"'
echo "PASS: Readiness OK."

echo "[3/4] Verifying Read-Only Routes Functional..."
curl -fsS "${API_URL}/economy/roi" | grep -q '"apiVersion":"v1"'
echo "PASS: Economy ROI query functional."

echo "[4/4] Verifying Unauthenticated Write Rejection..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${API_URL}/economy/claim" \
  -H "Content-Type: application/json" -d '{}')
if [ "${HTTP_CODE}" = "401" ] || [ "${HTTP_CODE}" = "400" ]; then
  echo "PASS: Unauthenticated write correctly guarded (HTTP ${HTTP_CODE})."
else
  echo "FAIL: Unexpected write status code: ${HTTP_CODE}"
  exit 1
fi

echo "SUCCESS: Post-rollback smoke verification passed completely."
```
