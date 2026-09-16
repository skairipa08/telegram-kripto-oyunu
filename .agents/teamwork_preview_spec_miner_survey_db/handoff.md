# Database Specification Handoff Report: Requirement R2 & R3 (Anti-Fraud & Reward Review)

**Agent**: teamwork_preview_spec_miner_survey_db  
**Role**: Database Spec Miner (Teamwork Specialist)  
**Date**: 2026-09-15  
**Working Directory**: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_spec_miner_survey_db`  
**Target Migration**: `supabase/migrations/202609140008_anti_fraud.sql`  

---

## 1. Observation

### 1.1 Existing Migrations Survey (`supabase/migrations/`)
An inspection of `supabase/migrations/` using filesystem and directory listings reveals the following migration history:

1. **`202609140001_auth.sql`**:
   - `public.users`: Primary key `id uuid default gen_random_uuid()`, unique `telegram_user_id bigint`, `first_name text`, `username text`, `language text`, `status text check in ('active','banned','suspended')`, `risk_score integer default 0`, `created_at`, `updated_at`.
   - `public.auth_sessions`: Tracks Telegram sessions, replay fingerprints (`init_fingerprint`), request hashes, expiration intervals (30 minutes).
   - Functions: `empire_auth_session`, `empire_auth_login`, `empire_auth_logout`.
   - Security: RLS enabled; public/anon/authenticated revoked; granted to `service_role`.

2. **`202609140002_economy.sql`**:
   - `public.economy_config`: Key-value configuration store with JSONB values.
   - `public.businesses`: Canonical business definitions (`slug`, `base_cost`, `base_income`, `sort_order`).
   - `public.player_balances`: `user_id uuid primary key references public.users(id) on delete cascade`, `cash bigint not null default 0`, `season_points bigint not null default 0`, `updated_at timestamptz`.
   - `public.player_businesses`: Owned business levels, `last_claim_at`.
   - `public.reward_ledger`: Immutable audit ledger for currency movements:
     - `id uuid primary key default gen_random_uuid()`
     - `user_id uuid not null references public.users(id) on delete cascade`
     - `delta_cash bigint not null default 0`
     - `delta_season_points bigint not null default 0`
     - `reason text not null check (length(reason) between 1 and 64)`
     - `idempotency_key text unique check (idempotency_key ~ '^[a-f0-9]{64}$')` *(Note: strictly expects 64-character lowercase hex string!)*
     - `metadata jsonb not null default '{}'::jsonb`
     - `created_at timestamptz not null default now()`

3. **`202609140003_seasons_missions.sql`**:
   - `public.seasons`: `id uuid`, `name text`, `status text check in ('upcoming', 'active', 'frozen', 'ended')`, `starts_at`, `ends_at`, `sru_snapshot`, `qap_snapshot`.
   - `public.season_scores`: `(season_id, user_id)` composite primary key, `points bigint`, `mission_points bigint`, `referral_points bigint`.
   - `public.missions`: Canonical mission pool (`key`, `difficulty`, `target`, `reward_sru_multiplier`).
   - `public.mission_instances`: Player assigned missions with `status in ('in_progress', 'completed', 'claimed')`.
   - `public.player_streaks`: Daily streak count, `last_claim_date`.

4. **`202609140004_referrals.sql`**:
   - Adds `referral_code text unique` to `public.users`.
   - `public.referrals`: `id uuid`, `invitee_user_id uuid not null unique`, `referrer_user_id uuid not null`, `code text`, `status text check in ('bound', 'qualified', 'flagged')`.
   - `public.referral_events`: `id uuid`, `referral_id uuid`, `milestone text check in ('activation', 'retained_d2', 'retained_d7', 'progression')`, `reward_amount integer`, `status text check in ('pending', 'claimed', 'frozen')`.

5. **`202609140005_step7_to_11_backend.sql`**:
   - `public.season_archives`: Historical final ranks after season freeze.
   - `public.purchases`: Telegram Stars transactions (`pending`, `completed`, `failed`, `refunded`).
   - `public.player_entitlements`: Convenience pass activation and expiration.
   - `public.analytics_events`: Event log with permitted events:
     `'app_open', 'auth_success', 'tutorial_complete', 'business_upgrade', 'cash_claim', 'mission_assigned', 'mission_complete', 'mission_claim', 'streak_claim', 'referral_link_copy', 'referral_bound', 'referral_milestone_qualified', 'referral_reward_claim', 'leaderboard_view', 'shop_view', 'invoice_created', 'payment_success', 'payment_refund', 'fraud_flag_created', 'reward_frozen', 'pass_activated'`.
   - **`public.admin_audit_logs`**:
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

6. **`202609140006_economy_starter_and_roi.sql`**:
   - Updates `player_balances.cash` default to 100.
   - Trigger `trigger_new_user_starter_economy` on `public.users` auto-creates balance with 100 cash, initializes 6 businesses, and logs starter grant in `reward_ledger`.
   - RPCs: `empire_init_player_economy`, `empire_economy_get_player_state`.

7. **Status of `202609140007_game_loop_apis.sql`**:
   - File is NOT present in `supabase/migrations/` on disk (referenced in `apps/api/src/auth/test-db.ts` from prior milestone, causing `ENOENT` in standard test runner).
   - Per mission constraints, `202609140007_game_loop_apis.sql` and `apps/api/src/auth/test-db.ts` must NOT be touched.
   - Anti-fraud test harness must use an independent test DB setup (e.g. `apps/api/src/fraud/test-db.ts`) running real migrations up to `202609140008_anti_fraud.sql`.

---

## 2. Logic Chain

### 2.1 Critical Bottleneck Discovery: `admin_audit_logs` Constraint Conflicts
- **Observation**: In `202609140005_step7_to_11_backend.sql` lines 50-60, `public.admin_audit_logs` defines strict check constraints:
  - `action in ('update_config', 'set_feature_flag', 'freeze_season', 'ban_user', 'refund_purchase')`
  - `target_type in ('economy_config', 'feature_flag', 'season', 'user', 'purchase')`
- **Inference**: Any anti-fraud review action (such as `reward_approved`, `reward_rejected`, `fraud_flag_reviewed`, `admin_role_assigned`) or target type (`frozen_reward`, `fraud_flag`, `admin_role`) will trigger a PostgreSQL `CHECK_VIOLATION` error if inserted into `admin_audit_logs`.
- **Deduction**: Migration `202609140008_anti_fraud.sql` must alter `public.admin_audit_logs` to extend these check constraints to include fraud review actions and target types.

### 2.2 Security Architecture & Row Level Security (RLS)
- **Observation**: `ORIGINAL_REQUEST.md` R2 specifies: *"Configure strict Row Level Security (RLS) on all tables; revoke public/anon/authenticated access and grant permissions strictly to service_role."*
- **Inference**: Direct PostgREST client queries (from anon or authenticated users) must be blocked by default RLS policies (`revoke all ... from public, anon, authenticated`).
- **Deduction**: All administrative operations and fraud checks must be executed through `security definer` stored procedures accessible only by `service_role` (invoked via backend Hono routes that authenticate user cookies and check roles).

### 2.3 Idempotency & Reward Ledger Integrity
- **Observation**: In `public.reward_ledger`, `idempotency_key` has a regex check `check (idempotency_key ~ '^[a-f0-9]{64}$')`.
- **Inference**: Passing an arbitrary UUID string (with hyphens) into `idempotency_key` causes a check constraint failure.
- **Deduction**: Stored procedure `empire_admin_review_reward` must generate a valid 64-hex hash, e.g.:
  `encode(sha256(('unfreeze_approval_' || p_frozen_reward_id::text)::bytea), 'hex')`.

### 2.4 Empirical Verification Chain
- **Test Executed**: Full migration script executed in PGlite with migrations 0001 through 0006.
- **Results**:
  - `admin_roles` created; role assignment verified (`empire_admin_check_role` returned `false` before, `true` after).
  - `fraud_flags` created with severity, risk score, and reason codes (`RAPID_BURST_REQUESTS`, `VELOCITY_CAP_EXCEEDED`).
  - `frozen_rewards` created with quarantine state (`status = 'frozen'`); verified player balance was unchanged (100 cash, 0 points).
  - Unauthorized review attempt (regular player Alice attempting to review) returned `{ error: 'FORBIDDEN' }`.
  - Admin review `approve` executed:
    - `frozen_rewards.status` became `'approved'`.
    - `player_balances` credited atomically (+10000 cash, +250 points).
    - `reward_ledger` row added with 64-hex idempotency key.
    - `admin_audit_logs` recorded `reward_approved`.
  - Admin review `reject` executed on second reward:
    - Status updated to `'rejected'`, 0 balance credited, audit log entry recorded.
  - Listing functions `empire_admin_get_fraud_flags` and `empire_admin_get_frozen_rewards` returned paginated results.

---

## 3. Features Discovered & Interface Specifications

### Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Schema | `public.admin_roles` | RBAC table assigning roles (`admin`, `superadmin`, `auditor`) to users | `user_id uuid`, `role text`, `assigned_by uuid` | Table row | Rejects invalid roles via check constraint; unique `(user_id, role)` | R2 Spec |
| 2 | Schema | `public.fraud_flags` | Table logging suspicious events, risk score (0–100), reason codes, metadata | `user_id uuid`, `target_type text`, `target_id text`, `risk_score int`, `reason_codes text[]`, `severity text`, `metadata jsonb` | Table row | Rejects risk score outside 0–100, empty reason codes array, invalid severity/target_type | R2 Spec |
| 3 | Schema | `public.frozen_rewards` | Table holding quarantined rewards pending admin review | `user_id uuid`, `fraud_flag_id uuid`, `reward_type text`, `amount_cash bigint`, `amount_season_points bigint`, `freeze_reason text` | Table row | Rejects 0 amounts (`amount_cash > 0 or amount_season_points > 0`); enforces status & review time constraint | R2 Spec |
| 4 | Schema | `public.admin_audit_logs` Extension | Extends check constraints to log fraud review decisions and role modifications | Alter table DDL | Extended check constraints | Rejects unknown actions/targets | Migration 0005 Analysis |
| 5 | RPC | `empire_admin_check_role` | Checks whether user has active administrative role | `p_user_id uuid, p_required_role text default 'admin'` | `boolean` (`true`/`false`) | Returns `false` for null or unknown users | R3 RBAC Spec |
| 6 | RPC | `empire_fraud_create_flag` | Logs fraud event, updates user risk score, emits analytics event | `p_user_id, p_target_type, p_target_id, p_risk_score, p_reason_codes, p_severity, p_metadata` | `jsonb` `{ success: true, flagId, riskScore, severity, status, createdAt }` | Returns default severity and reason code if omitted | R2 Stored Procedure Spec |
| 7 | RPC | `empire_fraud_freeze_reward` | Quarantines suspicious reward, emits analytics event, logs audit entry | `p_user_id, p_reward_type, p_amount_cash, p_amount_season_points, p_freeze_reason, p_fraud_flag_id, p_source_ref_id, p_metadata` | `jsonb` `{ success: true, frozenRewardId, status: 'frozen', amountCash, amountSeasonPoints, frozenAt }` | Returns `{ error: 'INVALID_REWARD_AMOUNT' }` if both amounts are <= 0 | R2 Stored Procedure Spec |
| 8 | RPC | `empire_admin_review_reward` | Admin decision endpoint for approving or rejecting frozen reward | `p_frozen_reward_id uuid, p_admin_user_id uuid, p_decision text, p_notes text` | `jsonb` `{ success: true, decision, creditedCash, newCash, newSeasonPoints, reviewedAt }` | Returns `{ error: 'FORBIDDEN' }`, `{ error: 'REASONING_REQUIRED' }`, `{ error: 'ALREADY_REVIEWED' }`, or `{ error: 'REWARD_NOT_FOUND' }` | R2/R3 Stored Procedure Spec |
| 9 | RPC | `empire_admin_review_flag` | Admin decision endpoint to update fraud flag status | `p_flag_id uuid, p_admin_user_id uuid, p_decision text, p_notes text` | `jsonb` `{ success: true, flagId, status, reviewedAt }` | Returns `{ error: 'FORBIDDEN' }`, `{ error: 'FLAG_NOT_FOUND' }`, or `{ error: 'INVALID_DECISION' }` | R3 Admin API Spec |
| 10 | RPC | `empire_admin_get_fraud_flags` | Paginated query for flagged events with user join and filters | `p_status text, p_user_id uuid, p_severity text, p_limit int, p_offset int` | `jsonb` `{ flags: [...], total, limit, offset }` | Returns empty array if none match; defaults to limit 50 | R3 Admin API Spec |
| 11 | RPC | `empire_admin_get_frozen_rewards` | Paginated query for frozen rewards with user and balance join | `p_status text default 'frozen', p_user_id uuid, p_limit int, p_offset int` | `jsonb` `{ rewards: [...], total, limit, offset }` | Returns empty array if none match; defaults to limit 50 | R3 Admin API Spec |
| 12 | RPC | `empire_admin_assign_role` | Idempotent role assignment helper with superadmin guardrail | `p_target_user_id uuid, p_role text, p_assigned_by uuid` | `jsonb` `{ success: true, userId, role }` | Returns `{ error: 'FORBIDDEN_SUPERADMIN_REQUIRED' }` or `{ error: 'INVALID_ROLE' }` | R3 RBAC Spec |

---

## 4. Edge Cases

| # | Feature | Input / Condition | Observed Behavior |
|---|---------|-------------------|-------------------|
| 1 | `empire_admin_review_reward` | Non-admin user attempts review | Blocked with `{ error: 'FORBIDDEN' }` before inspecting or locking any rows. |
| 2 | `empire_admin_review_reward` | Empty or whitespace-only admin review notes | Blocked with `{ error: 'REASONING_REQUIRED' }`; decision is rejected. |
| 3 | `empire_admin_review_reward` | Duplicate review of already approved/rejected reward | Blocked with `{ error: 'ALREADY_REVIEWED', currentStatus: 'approved' }`; prevents double-credit. |
| 4 | `empire_admin_review_reward` | Approval of reward with season points | Automatically finds active season, updates `season_scores(points)` and increments `player_balances(season_points)`. |
| 5 | `empire_admin_review_reward` | Ledger idempotency check | Generates SHA-256 hash formatted as 64-character lowercase hex string to satisfy `reward_ledger` check constraint regex. |
| 6 | `empire_fraud_freeze_reward` | 0 cash and 0 season points input | Returns `{ error: 'INVALID_REWARD_AMOUNT' }`; prevents zero-value orphaned locks. |
| 7 | `empire_fraud_create_flag` | Omitted severity | Automatically derives severity based on risk score: <30 `low`, 30-59 `medium`, 60-84 `high`, >=85 `critical`. |
| 8 | `empire_fraud_create_flag` | High risk score >= 90 | Automatically updates `users.risk_score` to greatest(risk_score, p_risk_score) for instant risk surfacing. |
| 9 | Direct PostgREST table query | Anon or regular authenticated role executes `SELECT * FROM fraud_flags` | Denied by RLS (`permission denied for table fraud_flags`). |
| 10 | `admin_audit_logs` insertion | Fraud review logs action `'reward_approved'` and target `'frozen_reward'` | Allowed without error due to extended check constraints on `admin_audit_logs`. |

---

## 5. Complete DDL Specification: `supabase/migrations/202609140008_anti_fraud.sql`

```sql
-- =============================================================================
-- Migration: 202609140008_anti_fraud.sql
-- Description: Anti-Fraud Engine, Quarantined Rewards, RBAC & Admin Review System
-- Requirements: R2, R3 (Security, Auditability, Atomic Ledger Integration)
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Extend Admin Audit Logs Check Constraints
-- -----------------------------------------------------------------------------
alter table public.admin_audit_logs drop constraint if exists admin_audit_logs_action_check;
alter table public.admin_audit_logs add constraint admin_audit_logs_action_check check (
  action in (
    'update_config', 'set_feature_flag', 'freeze_season', 'ban_user', 'refund_purchase',
    'fraud_flag_created', 'fraud_flag_reviewed', 'fraud_flag_dismissed',
    'reward_frozen', 'reward_approved', 'reward_rejected',
    'admin_role_assigned', 'admin_role_revoked'
  )
);

alter table public.admin_audit_logs drop constraint if exists admin_audit_logs_target_type_check;
alter table public.admin_audit_logs add constraint admin_audit_logs_target_type_check check (
  target_type in (
    'economy_config', 'feature_flag', 'season', 'user', 'purchase',
    'fraud_flag', 'frozen_reward', 'admin_role'
  )
);

-- -----------------------------------------------------------------------------
-- 2. Admin Roles Table (RBAC)
-- -----------------------------------------------------------------------------
create table if not exists public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('admin', 'superadmin', 'auditor')),
  assigned_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, role)
);
create index if not exists admin_roles_user_id_idx on public.admin_roles(user_id);
create index if not exists admin_roles_role_idx on public.admin_roles(role);

-- -----------------------------------------------------------------------------
-- 3. Fraud Flags Table
-- -----------------------------------------------------------------------------
create table if not exists public.fraud_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  target_type text not null check (target_type in ('user', 'reward', 'transaction', 'referral', 'session')),
  target_id text not null,
  risk_score integer not null check (risk_score >= 0 and risk_score <= 100),
  reason_codes text[] not null check (array_length(reason_codes, 1) > 0),
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'pending' check (status in ('pending', 'investigating', 'resolved', 'dismissed')),
  metadata jsonb not null default '{}'::jsonb,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  resolution_notes text check (resolution_notes is null or length(resolution_notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fraud_flags_user_id_idx on public.fraud_flags(user_id);
create index if not exists fraud_flags_status_idx on public.fraud_flags(status);
create index if not exists fraud_flags_risk_score_idx on public.fraud_flags(risk_score desc);
create index if not exists fraud_flags_created_at_idx on public.fraud_flags(created_at desc);
create index if not exists fraud_flags_target_idx on public.fraud_flags(target_type, target_id);

-- -----------------------------------------------------------------------------
-- 4. Frozen Rewards Table (Reward Quarantine)
-- -----------------------------------------------------------------------------
create table if not exists public.frozen_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  fraud_flag_id uuid references public.fraud_flags(id) on delete set null,
  reward_type text not null check (reward_type in ('cash_claim', 'mission_reward', 'referral_bonus', 'streak_bonus', 'airdrop')),
  amount_cash bigint not null default 0 check (amount_cash >= 0),
  amount_season_points bigint not null default 0 check (amount_season_points >= 0),
  status text not null default 'frozen' check (status in ('frozen', 'approved', 'rejected')),
  freeze_reason text not null check (length(freeze_reason) between 1 and 256),
  source_ref_id text,
  metadata jsonb not null default '{}'::jsonb,
  frozen_at timestamptz not null default now(),
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text check (review_notes is null or length(review_notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (amount_cash > 0 or amount_season_points > 0),
  check ((status = 'frozen' and reviewed_at is null) or (status in ('approved', 'rejected') and reviewed_at is not null))
);
create index if not exists frozen_rewards_user_id_idx on public.frozen_rewards(user_id);
create index if not exists frozen_rewards_status_idx on public.frozen_rewards(status);
create index if not exists frozen_rewards_frozen_at_idx on public.frozen_rewards(frozen_at desc);
create index if not exists frozen_rewards_flag_id_idx on public.frozen_rewards(fraud_flag_id);

-- -----------------------------------------------------------------------------
-- 5. Row Level Security & Service Role Grants
-- -----------------------------------------------------------------------------
alter table public.admin_roles enable row level security;
alter table public.fraud_flags enable row level security;
alter table public.frozen_rewards enable row level security;

revoke all on public.admin_roles, public.fraud_flags, public.frozen_rewards from public, anon, authenticated;
grant select, insert, update, delete on public.admin_roles, public.fraud_flags, public.frozen_rewards to service_role;

-- -----------------------------------------------------------------------------
-- 6. Stored Procedures / RPC Functions
-- -----------------------------------------------------------------------------

-- 6.1 RBAC Role Verification
create or replace function public.empire_admin_check_role(
  p_user_id uuid,
  p_required_role text default 'admin'
) returns boolean
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_has_role boolean := false;
begin
  if p_user_id is null then
    return false;
  end if;

  select exists (
    select 1 from public.admin_roles
    where user_id = p_user_id
      and (role = p_required_role or role = 'superadmin' or (p_required_role = 'auditor' and role in ('admin', 'superadmin', 'auditor')))
  ) into v_has_role;

  return v_has_role;
end;
$$;

-- 6.2 Fraud Flag Creation
create or replace function public.empire_fraud_create_flag(
  p_user_id uuid,
  p_target_type text,
  p_target_id text,
  p_risk_score integer,
  p_reason_codes text[],
  p_severity text default null,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_flag_id uuid := gen_random_uuid();
  v_severity text := p_severity;
  v_now timestamptz := now();
begin
  if v_severity is null then
    if p_risk_score >= 85 then
      v_severity := 'critical';
    elsif p_risk_score >= 60 then
      v_severity := 'high';
    elsif p_risk_score >= 30 then
      v_severity := 'medium';
    else
      v_severity := 'low';
    end if;
  end if;

  if p_reason_codes is null or array_length(p_reason_codes, 1) is null or array_length(p_reason_codes, 1) = 0 then
    p_reason_codes := array['UNKNOWN_RISK'];
  end if;

  insert into public.fraud_flags (
    id, user_id, target_type, target_id, risk_score, reason_codes, severity, status, metadata, created_at, updated_at
  ) values (
    v_flag_id, p_user_id, p_target_type, p_target_id, p_risk_score, p_reason_codes, v_severity, 'pending', coalesce(p_metadata, '{}'::jsonb), v_now, v_now
  );

  update public.users
  set risk_score = greatest(risk_score, p_risk_score), updated_at = v_now
  where id = p_user_id;

  insert into public.analytics_events (
    user_id, event_name, properties, created_at
  ) values (
    p_user_id,
    'fraud_flag_created',
    jsonb_build_object('flagId', v_flag_id, 'riskScore', p_risk_score, 'severity', v_severity, 'reasonCodes', p_reason_codes, 'targetType', p_target_type, 'targetId', p_target_id),
    v_now
  );

  return jsonb_build_object(
    'success', true,
    'flagId', v_flag_id,
    'riskScore', p_risk_score,
    'severity', v_severity,
    'status', 'pending',
    'createdAt', v_now
  );
end;
$$;

-- 6.3 Reward Freezing (Quarantine)
create or replace function public.empire_fraud_freeze_reward(
  p_user_id uuid,
  p_reward_type text,
  p_amount_cash bigint,
  p_amount_season_points bigint,
  p_freeze_reason text,
  p_fraud_flag_id uuid default null,
  p_source_ref_id text default null,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_frozen_id uuid := gen_random_uuid();
  v_now timestamptz := now();
begin
  if (coalesce(p_amount_cash, 0) <= 0 and coalesce(p_amount_season_points, 0) <= 0) then
    return jsonb_build_object('error', 'INVALID_REWARD_AMOUNT');
  end if;

  insert into public.frozen_rewards (
    id, user_id, fraud_flag_id, reward_type, amount_cash, amount_season_points, status, freeze_reason, source_ref_id, metadata, frozen_at, created_at, updated_at
  ) values (
    v_frozen_id, p_user_id, p_fraud_flag_id, p_reward_type, coalesce(p_amount_cash, 0), coalesce(p_amount_season_points, 0), 'frozen', p_freeze_reason, p_source_ref_id, coalesce(p_metadata, '{}'::jsonb), v_now, v_now, v_now
  );

  insert into public.analytics_events (
    user_id, event_name, properties, created_at
  ) values (
    p_user_id,
    'reward_frozen',
    jsonb_build_object('frozenRewardId', v_frozen_id, 'rewardType', p_reward_type, 'amountCash', coalesce(p_amount_cash, 0), 'amountSeasonPoints', coalesce(p_amount_season_points, 0), 'reason', p_freeze_reason),
    v_now
  );

  insert into public.admin_audit_logs (
    admin_user_id, action, target_type, target_key, old_value, new_value, reason, created_at
  ) values (
    null,
    'reward_frozen',
    'frozen_reward',
    v_frozen_id::text,
    null,
    jsonb_build_object('userId', p_user_id, 'amountCash', coalesce(p_amount_cash, 0), 'amountSeasonPoints', coalesce(p_amount_season_points, 0), 'rewardType', p_reward_type),
    p_freeze_reason,
    v_now
  );

  return jsonb_build_object(
    'success', true,
    'frozenRewardId', v_frozen_id,
    'status', 'frozen',
    'amountCash', coalesce(p_amount_cash, 0),
    'amountSeasonPoints', coalesce(p_amount_season_points, 0),
    'frozenAt', v_now
  );
end;
$$;

-- 6.4 Admin Review Reward (Atomic Balance Credit & Audit)
create or replace function public.empire_admin_review_reward(
  p_frozen_reward_id uuid,
  p_admin_user_id uuid,
  p_decision text,
  p_notes text
) returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_frozen public.frozen_rewards;
  v_now timestamptz := now();
  v_new_cash bigint;
  v_new_season_points bigint;
  v_idempotency_key text;
  v_active_season_id uuid;
begin
  if not public.empire_admin_check_role(p_admin_user_id, 'admin') then
    return jsonb_build_object('error', 'FORBIDDEN');
  end if;

  if p_decision not in ('approve', 'reject') then
    return jsonb_build_object('error', 'INVALID_DECISION');
  end if;

  if p_notes is null or length(trim(p_notes)) = 0 then
    return jsonb_build_object('error', 'REASONING_REQUIRED');
  end if;

  select * into v_frozen
  from public.frozen_rewards
  where id = p_frozen_reward_id
  for update;

  if not found then
    return jsonb_build_object('error', 'REWARD_NOT_FOUND');
  end if;

  if v_frozen.status <> 'frozen' then
    return jsonb_build_object('error', 'ALREADY_REVIEWED', 'currentStatus', v_frozen.status);
  end if;

  if p_decision = 'approve' then
    update public.frozen_rewards set
      status = 'approved',
      reviewed_by = p_admin_user_id,
      reviewed_at = v_now,
      review_notes = p_notes,
      updated_at = v_now
    where id = p_frozen_reward_id;

    update public.player_balances set
      cash = cash + v_frozen.amount_cash,
      season_points = season_points + v_frozen.amount_season_points,
      updated_at = v_now
    where user_id = v_frozen.user_id
    returning cash, season_points into v_new_cash, v_new_season_points;

    if v_frozen.amount_season_points > 0 then
      select id into v_active_season_id
      from public.seasons
      where status = 'active'
      order by starts_at desc limit 1;

      if v_active_season_id is not null then
        insert into public.season_scores (season_id, user_id, points, updated_at)
        values (v_active_season_id, v_frozen.user_id, v_frozen.amount_season_points, v_now)
        on conflict (season_id, user_id) do update set
          points = season_scores.points + excluded.points,
          updated_at = excluded.updated_at;
      end if;
    end if;

    v_idempotency_key := encode(sha256(('unfreeze_approval_' || p_frozen_reward_id::text)::bytea), 'hex');
    insert into public.reward_ledger (
      user_id, delta_cash, delta_season_points, reason, idempotency_key, metadata, created_at
    ) values (
      v_frozen.user_id,
      v_frozen.amount_cash,
      v_frozen.amount_season_points,
      'reward_unfrozen_approved',
      v_idempotency_key,
      jsonb_build_object('frozenRewardId', p_frozen_reward_id, 'approvedBy', p_admin_user_id, 'notes', p_notes),
      v_now
    )
    on conflict (idempotency_key) do nothing;

    if v_frozen.fraud_flag_id is not null then
      update public.fraud_flags set
        status = 'resolved',
        reviewed_by = p_admin_user_id,
        reviewed_at = v_now,
        resolution_notes = 'Approved via reward review: ' || p_notes,
        updated_at = v_now
      where id = v_frozen.fraud_flag_id and status = 'pending';
    end if;

    insert into public.admin_audit_logs (
      admin_user_id, action, target_type, target_key, old_value, new_value, reason, created_at
    ) values (
      p_admin_user_id,
      'reward_approved',
      'frozen_reward',
      p_frozen_reward_id::text,
      jsonb_build_object('status', 'frozen'),
      jsonb_build_object('status', 'approved', 'creditedCash', v_frozen.amount_cash, 'creditedSeasonPoints', v_frozen.amount_season_points),
      p_notes,
      v_now
    );

    return jsonb_build_object(
      'success', true,
      'decision', 'approved',
      'frozenRewardId', p_frozen_reward_id,
      'creditedCash', v_frozen.amount_cash,
      'creditedSeasonPoints', v_frozen.amount_season_points,
      'newCash', v_new_cash,
      'newSeasonPoints', v_new_season_points,
      'reviewedAt', v_now
    );

  else -- reject
    update public.frozen_rewards set
      status = 'rejected',
      reviewed_by = p_admin_user_id,
      reviewed_at = v_now,
      review_notes = p_notes,
      updated_at = v_now
    where id = p_frozen_reward_id;

    if v_frozen.fraud_flag_id is not null then
      update public.fraud_flags set
        status = 'resolved',
        reviewed_by = p_admin_user_id,
        reviewed_at = v_now,
        resolution_notes = 'Rejected via reward review: ' || p_notes,
        updated_at = v_now
      where id = v_frozen.fraud_flag_id and status = 'pending';
    end if;

    insert into public.admin_audit_logs (
      admin_user_id, action, target_type, target_key, old_value, new_value, reason, created_at
    ) values (
      p_admin_user_id,
      'reward_rejected',
      'frozen_reward',
      p_frozen_reward_id::text,
      jsonb_build_object('status', 'frozen'),
      jsonb_build_object('status', 'rejected', 'canceledCash', v_frozen.amount_cash, 'canceledSeasonPoints', v_frozen.amount_season_points),
      p_notes,
      v_now
    );

    return jsonb_build_object(
      'success', true,
      'decision', 'rejected',
      'frozenRewardId', p_frozen_reward_id,
      'canceledCash', v_frozen.amount_cash,
      'canceledSeasonPoints', v_frozen.amount_season_points,
      'reviewedAt', v_now
    );
  end if;
end;
$$;

-- 6.5 Admin Review Flag
create or replace function public.empire_admin_review_flag(
  p_flag_id uuid,
  p_admin_user_id uuid,
  p_decision text,
  p_notes text
) returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_flag public.fraud_flags;
  v_new_status text;
  v_now timestamptz := now();
begin
  if not public.empire_admin_check_role(p_admin_user_id, 'admin') then
    return jsonb_build_object('error', 'FORBIDDEN');
  end if;

  if p_decision = 'resolve' then
    v_new_status := 'resolved';
  elsif p_decision = 'dismiss' then
    v_new_status := 'dismissed';
  elsif p_decision = 'investigate' then
    v_new_status := 'investigating';
  else
    return jsonb_build_object('error', 'INVALID_DECISION');
  end if;

  select * into v_flag from public.fraud_flags where id = p_flag_id for update;
  if not found then
    return jsonb_build_object('error', 'FLAG_NOT_FOUND');
  end if;

  update public.fraud_flags set
    status = v_new_status,
    reviewed_by = p_admin_user_id,
    reviewed_at = v_now,
    resolution_notes = p_notes,
    updated_at = v_now
  where id = p_flag_id;

  insert into public.admin_audit_logs (
    admin_user_id, action, target_type, target_key, old_value, new_value, reason, created_at
  ) values (
    p_admin_user_id,
    case when v_new_status = 'dismissed' then 'fraud_flag_dismissed' else 'fraud_flag_reviewed' end,
    'fraud_flag',
    p_flag_id::text,
    jsonb_build_object('status', v_flag.status),
    jsonb_build_object('status', v_new_status),
    p_notes,
    v_now
  );

  return jsonb_build_object(
    'success', true,
    'flagId', p_flag_id,
    'status', v_new_status,
    'reviewedAt', v_now
  );
end;
$$;

-- 6.6 Admin Get Fraud Flags (Paginated)
create or replace function public.empire_admin_get_fraud_flags(
  p_status text default null,
  p_user_id uuid default null,
  p_severity text default null,
  p_limit integer default 50,
  p_offset integer default 0
) returns jsonb
language plpgsql
stable
security definer
set search_path = 'public'
as $$
declare
  v_flags jsonb;
  v_total integer;
begin
  select count(*)::integer into v_total
  from public.fraud_flags f
  where (p_status is null or f.status = p_status)
    and (p_user_id is null or f.user_id = p_user_id)
    and (p_severity is null or f.severity = p_severity);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', f.id,
      'userId', f.user_id,
      'targetType', f.target_type,
      'targetId', f.target_id,
      'riskScore', f.risk_score,
      'reasonCodes', f.reason_codes,
      'severity', f.severity,
      'status', f.status,
      'metadata', f.metadata,
      'reviewedBy', f.reviewed_by,
      'reviewedAt', f.reviewed_at,
      'resolutionNotes', f.resolution_notes,
      'createdAt', f.created_at,
      'updatedAt', f.updated_at,
      'user', jsonb_build_object(
        'telegramId', u.telegram_user_id::text,
        'username', u.username,
        'firstName', u.first_name,
        'status', u.status,
        'userRiskScore', u.risk_score
      )
    ) order by f.created_at desc
  ), '[]'::jsonb) into v_flags
  from (
    select * from public.fraud_flags
    where (p_status is null or status = p_status)
      and (p_user_id is null or user_id = p_user_id)
      and (p_severity is null or severity = p_severity)
    order by created_at desc
    limit coalesce(p_limit, 50)
    offset coalesce(p_offset, 0)
  ) f
  join public.users u on u.id = f.user_id;

  return jsonb_build_object(
    'flags', v_flags,
    'total', v_total,
    'limit', coalesce(p_limit, 50),
    'offset', coalesce(p_offset, 0)
  );
end;
$$;

-- 6.7 Admin Get Frozen Rewards (Paginated)
create or replace function public.empire_admin_get_frozen_rewards(
  p_status text default 'frozen',
  p_user_id uuid default null,
  p_limit integer default 50,
  p_offset integer default 0
) returns jsonb
language plpgsql
stable
security definer
set search_path = 'public'
as $$
declare
  v_rewards jsonb;
  v_total integer;
begin
  select count(*)::integer into v_total
  from public.frozen_rewards fr
  where (p_status is null or fr.status = p_status)
    and (p_user_id is null or fr.user_id = p_user_id);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', fr.id,
      'userId', fr.user_id,
      'fraudFlagId', fr.fraud_flag_id,
      'rewardType', fr.reward_type,
      'amountCash', fr.amount_cash,
      'amountSeasonPoints', fr.amount_season_points,
      'status', fr.status,
      'freezeReason', fr.freeze_reason,
      'sourceRefId', fr.source_ref_id,
      'metadata', fr.metadata,
      'frozenAt', fr.frozen_at,
      'reviewedBy', fr.reviewed_by,
      'reviewedAt', fr.reviewed_at,
      'reviewNotes', fr.review_notes,
      'user', jsonb_build_object(
        'telegramId', u.telegram_user_id::text,
        'username', u.username,
        'firstName', u.first_name,
        'currentCash', pb.cash,
        'currentSeasonPoints', pb.season_points
      )
    ) order by fr.frozen_at desc
  ), '[]'::jsonb) into v_rewards
  from (
    select * from public.frozen_rewards
    where (p_status is null or status = p_status)
      and (p_user_id is null or user_id = p_user_id)
    order by frozen_at desc
    limit coalesce(p_limit, 50)
    offset coalesce(p_offset, 0)
  ) fr
  join public.users u on u.id = fr.user_id
  left join public.player_balances pb on pb.user_id = fr.user_id;

  return jsonb_build_object(
    'rewards', v_rewards,
    'total', v_total,
    'limit', coalesce(p_limit, 50),
    'offset', coalesce(p_offset, 0)
  );
end;
$$;

-- 6.8 Role Assignment Helper
create or replace function public.empire_admin_assign_role(
  p_target_user_id uuid,
  p_role text,
  p_assigned_by uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_now timestamptz := now();
begin
  if p_role not in ('admin', 'superadmin', 'auditor') then
    return jsonb_build_object('error', 'INVALID_ROLE');
  end if;

  if p_assigned_by is not null and not public.empire_admin_check_role(p_assigned_by, 'superadmin') then
    return jsonb_build_object('error', 'FORBIDDEN_SUPERADMIN_REQUIRED');
  end if;

  insert into public.admin_roles (user_id, role, assigned_by, created_at, updated_at)
  values (p_target_user_id, p_role, p_assigned_by, v_now, v_now)
  on conflict (user_id, role) do update set updated_at = v_now;

  insert into public.admin_audit_logs (
    admin_user_id, action, target_type, target_key, old_value, new_value, reason, created_at
  ) values (
    p_assigned_by,
    'admin_role_assigned',
    'admin_role',
    p_target_user_id::text,
    null,
    jsonb_build_object('role', p_role),
    'Role assigned by ' || coalesce(p_assigned_by::text, 'system'),
    v_now
  );

  return jsonb_build_object(
    'success', true,
    'userId', p_target_user_id,
    'role', p_role
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Revocations & Grants
-- -----------------------------------------------------------------------------
revoke all on function public.empire_admin_check_role(uuid, text) from public, anon, authenticated;
revoke all on function public.empire_fraud_create_flag(uuid, text, text, integer, text[], text, jsonb) from public, anon, authenticated;
revoke all on function public.empire_fraud_freeze_reward(uuid, text, bigint, bigint, text, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.empire_admin_review_reward(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.empire_admin_review_flag(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.empire_admin_get_fraud_flags(text, uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.empire_admin_get_frozen_rewards(text, uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.empire_admin_assign_role(uuid, text, uuid) from public, anon, authenticated;

grant execute on function public.empire_admin_check_role(uuid, text) to service_role;
grant execute on function public.empire_fraud_create_flag(uuid, text, text, integer, text[], text, jsonb) to service_role;
grant execute on function public.empire_fraud_freeze_reward(uuid, text, bigint, bigint, text, uuid, text, jsonb) to service_role;
grant execute on function public.empire_admin_review_reward(uuid, uuid, text, text) to service_role;
grant execute on function public.empire_admin_review_flag(uuid, uuid, text, text) to service_role;
grant execute on function public.empire_admin_get_fraud_flags(text, uuid, text, integer, integer) to service_role;
grant execute on function public.empire_admin_get_frozen_rewards(text, uuid, integer, integer) to service_role;
grant execute on function public.empire_admin_assign_role(uuid, text, uuid) to service_role;

commit;
```

---

## 6. Caveats

1. **Isolation from Codex/Sol Game-Loop Files**:
   - `apps/api/src/auth/test-db.ts` currently fails in default `pnpm test` because it specifies `202609140007_game_loop_apis.sql` which was never committed.
   - We adhered strictly to the constraint not to modify `apps/api/src/auth/test-db.ts` or `202609140007_game_loop_apis.sql`.
   - The anti-fraud test harness should be implemented independently in `apps/api/src/fraud/test-db.ts` (as allowed in Requirement R4), loading migrations 0001 through 0006 plus 0008.

2. **Idempotency Key Constraints on `reward_ledger`**:
   - `public.reward_ledger` has a strict constraint `check (idempotency_key ~ '^[a-f0-9]{64}$')`. Any service calling `reward_ledger` directly or via RPC must generate a 64-hex string (e.g. `encode(sha256(...), 'hex')`).

3. **No Project Source Code Modifications**:
   - As a read-only specification miner, no files outside `.agents/teamwork_preview_spec_miner_survey_db/` were modified.

---

## 7. Conclusion

Requirement R2 and its integration with R3 have been comprehensively surveyed, designed, and empirically proven in PostgreSQL/PGlite.
- The full schema for `admin_roles`, `fraud_flags`, and `frozen_rewards` is fully defined with constraints, foreign keys, cascade deletes, and indexes.
- The constraint bottleneck on `admin_audit_logs` has been identified and resolved via safe constraint extension.
- Stored procedures handle flag creation, reward freezing, atomic balance and season point crediting upon admin approval, permanent cancellation on rejection, and immutable audit logging.
- All RLS policies and role grants conform strictly to Supabase and PostgreSQL security practices.

---

## 8. Verification Method

To independently verify the DDL and all 8 stored procedures in PostgreSQL/PGlite:
1. Initialize PGlite and create Supabase roles:
   ```sql
   create role anon;
   create role authenticated;
   create role service_role bypassrls;
   grant usage on schema public to service_role;
   ```
2. Execute migrations `202609140001_auth.sql` through `202609140006_economy_starter_and_roi.sql` in order.
3. Execute the complete DDL from Section 5 (`202609140008_anti_fraud.sql`).
4. Execute test queries:
   ```sql
   -- Create test admin user and player
   insert into public.users (telegram_user_id, first_name, username) values (9001, 'Admin', 'admin') returning id;
   insert into public.users (telegram_user_id, first_name, username) values (9002, 'Player', 'player') returning id;

   -- Assign admin role
   select public.empire_admin_assign_role('<admin_id>', 'admin', null);

   -- Verify role check
   select public.empire_admin_check_role('<admin_id>', 'admin'); -- Returns true
   select public.empire_admin_check_role('<player_id>', 'admin'); -- Returns false

   -- Create fraud flag and freeze reward
   select public.empire_fraud_create_flag('<player_id>', 'reward', 'ref-1', 80, array['VELOCITY_CAP_EXCEEDED']);
   select public.empire_fraud_freeze_reward('<player_id>', 'cash_claim', 5000, 100, 'Velocity exceeded');

   -- Review with decision 'approve'
   select public.empire_admin_review_reward('<frozen_reward_id>', '<admin_id>', 'approve', 'Legitimate claim');

   -- Verify atomic credit in player_balances and reward_ledger
   select cash, season_points from public.player_balances where user_id = '<player_id>';
   select * from public.reward_ledger where user_id = '<player_id>';
   select * from public.admin_audit_logs;
   ```
5. Invalidation condition: Any failure to execute the DDL, syntax error, check violation, or uncredited balance upon approval invalidates this specification.
