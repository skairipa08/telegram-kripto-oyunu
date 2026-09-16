# Stream 3 Investigation Report: Admin RBAC, Remote Config, Feature Flags & Fraud Review System (Requirement R3)

**Author:** teamwork_preview_explorer_stream3  
**Date:** 2026-09-16  
**Scope:** `apps/api/src/config/`, `apps/api/src/fraud/`, `apps/api/src/admin/`, `supabase/migrations/`  
**Reference Entrypoints:** `apps/api/src/index.ts`, `apps/api/src/auth/test-db.ts`, `apps/api/src/fraud/test-db.ts`  

---

## 1. Executive Summary & Current State Audit

A comprehensive inspection was conducted across the database migrations, store layers, route handlers, and test suites covering administrative configuration, anti-fraud review, and role-based access control (RBAC).

### Key Findings Summary:
1. **Existing Components in `apps/api/src/config/`**:
   - `store.ts`: Defines `ConfigStore` interface and `SupabaseConfigStore` class calling database RPCs `empire_config_get` and `empire_config_update`.
   - `routes.ts`: Exposes `GET /config/public` (resolving config via `@empire/game-core`) and `POST /admin/config` (mutating config and writing audit log).
   - **Critical Vulnerability / Architecture Gap**: `POST /admin/config` validates user session cookie but **does NOT verify any administrative role or superadmin status**. Any authenticated player can currently update economy configuration!
   - `routes.test.ts`: Contains 3 integration tests using a seeded user `config_admin` (who has no admin role in `admin_roles`).

2. **Existing Components in `apps/api/src/fraud/`**:
   - `store.ts`: Defines `FraudStore` with RPC wrappers: `checkAdminRole`, `getFraudFlags`, `getFrozenRewards`, `reviewReward`, `reviewFlag`, `createFraudFlag`, `freezeReward`, `assignAdminRole`.
   - `routes.ts`: Exposes:
     - `GET /admin/fraud/flags`: Requires session + `checkAdminRole(userId, 'auditor')`. Returns paginated flags.
     - `GET /admin/fraud/frozen`: Requires session + `checkAdminRole(userId, 'auditor')`. Returns paginated quarantined rewards.
     - `POST /admin/fraud/review`: Requires session + `checkAdminRole(userId, 'admin')`. Executes approve/reject on frozen reward, atomically credits balances via ledger, resolves flag, and writes to `admin_audit_logs`.
   - `test-db.ts`: Full independent in-memory PGlite test harness running migrations 0001–0008 and 0010, seeding users, admins, fraud flags, and frozen rewards.
   - `designated-admins.test.ts`: 3 tests verifying `@Barandnz` and `@Mberked` auto-assignment and RBAC checks.
   - `routes.test.ts`: 18 tests covering filtering, pagination, approve/reject flows, idempotency, and dual prefix mounting (`/admin/fraud/*` and `/api/admin/fraud/*`).
   - `review-stress.test.ts`: 10 stress tests proving concurrency race protection (10 simultaneous approval requests on same reward result in 1 success, 9 HTTP 409s).

3. **Status of `apps/api/src/admin/`**:
   - Directory currently **does not exist** on disk. All admin-facing endpoints are currently split between `apps/api/src/config/` and `apps/api/src/fraud/`.
   - Requirement R3 calls for dedicated admin governance APIs, which can be cleanly added in `apps/api/src/admin/` or integrated directly into `config` and `fraud` with unified admin re-exports.

4. **Status of `supabase/migrations/`**:
   - `202609140005_step7_to_11_backend.sql`: Created `public.admin_audit_logs`, `public.economy_config`, and RPCs `empire_config_get` and `empire_config_update`.
   - `202609140008_anti_fraud.sql`: Created `public.admin_roles`, `public.fraud_flags`, `public.frozen_rewards`. Extended `admin_audit_logs` check constraints (`action` in 13 actions, `target_type` in 8 types, `reason` <= 1024 chars). Created stored procedures for flag creation, reward freezing, admin review, and role verification.
   - `202609140010_designated_admins.sql`: Implemented designated superadmins logic for `@Barandnz` and `@Mberked` (direct check in `empire_admin_check_role` + auto-assignment trigger `trg_designated_admins_auto_assign`).

---

## 2. Deep Dive: RBAC Architecture & Superadmin Recognition

### 2.1 Current Implementation of `empire_admin_check_role`
In `supabase/migrations/202609140010_designated_admins.sql`:
```sql
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
  v_username text;
begin
  if p_user_id is null then
    return false;
  end if;

  -- 1. Check if user is one of the designated admins (@Barandnz, @Mberked)
  select lower(username) into v_username
  from public.users
  where id = p_user_id;

  if v_username in ('barandnz', 'mberked') then
    return true;
  end if;

  -- 2. Role hierarchy verification from public.admin_roles
  select exists (
    select 1 from public.admin_roles
    where user_id = p_user_id
      and (role = p_required_role or role = 'superadmin' or (p_required_role = 'auditor' and role in ('admin', 'superadmin', 'auditor')))
  ) into v_has_role;

  return v_has_role;
end;
$$;
```

### 2.2 How `@Barandnz` and `@Mberked` Are Recognized
The system uses a **triple-layer defense**:
1. **Direct Fast-Path Check in SQL Function**:
   Regardless of whether the user exists in `public.admin_roles` or what role was passed (`admin`, `superadmin`, `auditor`), if `lower(username)` equals `'barandnz'` or `'mberked'`, `empire_admin_check_role` returns `true` immediately.
2. **Database Auto-Assignment Trigger (`trg_designated_admins_auto_assign`)**:
   Fires `AFTER INSERT OR UPDATE OF username ON public.users FOR EACH ROW`. If `lower(coalesce(new.username, '')) in ('barandnz', 'mberked')`, it automatically executes:
   ```sql
   insert into public.admin_roles (user_id, role, assigned_by, created_at, updated_at)
   values (new.id, 'superadmin', null, now(), now())
   on conflict (user_id, role) do update set updated_at = now();
   ```
   This guarantees that `@Barandnz` and `@Mberked` possess persistent `superadmin` records in `admin_roles`.
3. **Session-Level Fast Path in API**:
   `session.user.username` is loaded directly into memory from the authenticated session record. The API can perform an immediate zero-latency verification:
   ```ts
   const uname = session.user.username?.toLowerCase();
   const isDesignatedSuperadmin = uname === 'barandnz' || uname === 'mberked';
   ```

### 2.3 Identified Authorization Gaps
1. **`POST /admin/config` Missing RBAC**:
   In `apps/api/src/config/routes.ts`, line 56, only `if (!session) return c.json(error('UNAUTHORIZED'), 401)` is checked. It **does not call `checkAdminRole`**. Any normal player can update configuration.
2. **Fraud Endpoint Role Granularity vs Requirement R3**:
   `GET /admin/fraud/flags` and `GET /admin/fraud/frozen` currently check role `'auditor'`. `POST /admin/fraud/review` checks role `'admin'`.
   Requirement R3 specifies:
   > *"Enforce strict RBAC on all admin endpoints: verify caller session belongs to authorized superadmin (@Barandnz or @Mberked or role = superadmin). 403 FORBIDDEN for unauthorized users."*
   Therefore, to strictly satisfy R3, all admin endpoints (feature flags, config, fraud review queue, unfreezing) must enforce the superadmin constraint (`@Barandnz`, `@Mberked`, or `role = 'superadmin'`).

---

## 3. Specifications for Requirement R3

### 3.1 Strict RBAC Enforcement Specification
All admin routes under `/admin/*` and `/api/admin/*` must enforce two-phase authorization:
1. **Authentication Check**:
   - Must contain valid session cookie (`__Host-empire_session`).
   - If missing, invalid, or expired: return HTTP `401 UNAUTHORIZED`:
     ```json
     {
       "apiVersion": "v1",
       "error": { "code": "UNAUTHORIZED" }
     }
     ```
2. **Superadmin RBAC Check**:
   - Must verify:
     `lower(session.user.username) in ('barandnz', 'mberked')` **OR** `checkAdminRole(session.user.id, 'superadmin') === true`.
   - If user is a standard player, auditor, or non-superadmin: return HTTP `403 FORBIDDEN`:
     ```json
     {
       "apiVersion": "v1",
       "error": { "code": "FORBIDDEN" }
     }
     ```

### 3.2 Feature Flag Management API Specification
The system must support dynamic, real-time toggling and inspection of game feature flags without requiring code redeployment.

#### Required Flags & Parameters:
1. `feature.stars_payments`: boolean (Default: `false` in migration 0002) — Controls Telegram Stars purchasing flow.
2. `feature.maintenance_mode`: boolean (Default: `false`) — System-wide emergency maintenance mode.
3. `feature.referrals`: boolean (Default: `true` in migration 0005) — Enables/disables referral bonuses and link binding.
4. `economy.multiplier`: number (Default: `1.0`) — Global economy production rate multiplier applied to idle earnings.

#### Idempotency & Audit Logging Requirements:
- **Idempotent Updates**:
  Every update request carries `requestId: UUID`. Re-submitting the exact same request with the same `requestId` must succeed idempotently without creating duplicate audit log entries or throwing errors.
- **Audit Logging Contract**:
  Every mutation must insert a record into `public.admin_audit_logs` storing:
  - `admin_user_id`: UUID of superadmin (or NULL if system)
  - `admin_username`: Text of admin's username (e.g. `'Barandnz'`, `'Mberked'`)
  - `action`: `'set_feature_flag'` (for `feature.*`) or `'update_config'` (for `economy.*`)
  - `target_type`: `'feature_flag'` or `'economy_config'`
  - `target_key`: The exact flag key
  - `old_value`: JSONB snapshot before mutation
  - `new_value`: JSONB snapshot after mutation
  - `reason`: Text explanation provided by superadmin (up to 1024 characters)
  - `created_at`: Timestamptz of execution

#### Endpoints Contract:
- `GET /admin/feature-flags` & `GET /api/admin/feature-flags`:
  - Returns current states of all 4 feature flags and any additional flags from `economy_config`.
  - Response Schema:
    ```json
    {
      "apiVersion": "v1",
      "flags": {
        "feature.stars_payments": false,
        "feature.maintenance_mode": false,
        "feature.referrals": true,
        "economy.multiplier": 1.0
      },
      "updatedAt": "2026-09-16T09:00:00.000Z"
    }
    ```
- `POST /admin/feature-flags` & `POST /api/admin/feature-flags` (and `POST /admin/config`):
  - Request Body Schema:
    ```json
    {
      "key": "feature.stars_payments",
      "value": true,
      "reason": "Enabling stars shop for launch testing",
      "requestId": "550e8400-e29b-41d4-a716-446655440000"
    }
    ```
  - Response Schema:
    ```json
    {
      "apiVersion": "v1",
      "success": true,
      "key": "feature.stars_payments",
      "updatedValue": true,
      "auditLogId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    }
    ```
- `GET /admin/audit-logs` & `GET /api/admin/audit-logs`:
  - Returns chronological history of administrative mutations.
  - Query parameters: `limit` (default 50), `offset` (default 0), `targetKey` (optional).
  - Response Schema:
    ```json
    {
      "apiVersion": "v1",
      "logs": [
        {
          "id": "uuid",
          "adminUserId": "uuid",
          "adminUsername": "Barandnz",
          "action": "set_feature_flag",
          "targetType": "feature_flag",
          "targetKey": "feature.stars_payments",
          "oldValue": false,
          "newValue": true,
          "reason": "Enabling stars shop for launch testing",
          "createdAt": "2026-09-16T09:00:00.000Z"
        }
      ],
      "total": 1,
      "limit": 50,
      "offset": 0
    }
    ```

### 3.3 Fraud Queue Review API Specification
The fraud queue review API allows superadmins to inspect suspicious player accounts and resolve frozen assets.

#### Endpoints Contract:
1. `GET /admin/fraud/flags` & `GET /api/admin/fraud/flags`:
   - Returns paginated list of suspicious flagged events, risk scores (0–100), severity (`low`, `medium`, `high`, `critical`), reason codes (e.g. `RAPID_BURST_REQUESTS`, `VELOCITY_CAP_EXCEEDED`, `DEVICE_CLUSTER_DETECTED`, `CIRCULAR_REFERRAL_SUSPECT`), and joined user data (`telegramId`, `username`, `firstName`, `userRiskScore`).
2. `GET /admin/fraud/frozen` & `GET /api/admin/fraud/frozen`:
   - Returns quarantined rewards (`cash_claim`, `mission_reward`, `referral_bonus`, `streak_bonus`, `airdrop`), amounts (`amountCash`, `amountSeasonPoints`), freeze reasons, and player balances.
3. `POST /admin/fraud/review` & `POST /api/admin/fraud/review`:
   - Decision on specific quarantined reward:
     - `decision: "approve"`: Atomically credits player balance (cash + season points), writes ledger entry with SHA256 idempotency key, resolves linked fraud flag, and logs to `admin_audit_logs`.
     - `decision: "reject"`: Permanently cancels reward, marks status `rejected`, resolves linked fraud flag, and logs to `admin_audit_logs`.
4. `GET /admin/fraud/accounts` & `GET /api/admin/fraud/accounts`:
   - Lists suspicious player accounts sorted by risk score.
   - Response Schema:
     ```json
     {
       "apiVersion": "v1",
       "accounts": [
         {
           "userId": "uuid",
           "telegramId": "12345678",
           "username": "suspicious_user",
           "firstName": "John",
           "riskScore": 85,
           "status": "active",
           "pendingFlagsCount": 2,
           "frozenRewardsCount": 1,
           "totalFrozenCash": 50000,
           "totalFrozenSeasonPoints": 1000,
           "createdAt": "2026-09-15T12:00:00.000Z"
         }
       ],
       "total": 1,
       "limit": 50,
       "offset": 0
     }
     ```
5. `POST /admin/fraud/accounts/:id/unfreeze` & `POST /api/admin/fraud/accounts/:id/unfreeze`:
   - Superadmin action to unfreeze a quarantined account:
     - Reinstates `users.status = 'active'` (if suspended).
     - Approves all pending frozen rewards belonging to this account and atomically credits balances.
     - Resolves all pending fraud flags for the user.
     - Inserts record into `admin_audit_logs` (`action = 'reward_approved'` / `'unfreeze_account'`, storing `admin_username`).
   - Request Body Schema:
     ```json
     {
       "reason": "Account verified legitimate after manual review",
       "requestId": "uuid"
     }
     ```
   - Response Schema:
     ```json
     {
       "apiVersion": "v1",
       "success": true,
       "userId": "uuid",
       "status": "active",
       "unfrozenRewardsCount": 1,
       "creditedCash": 50000,
       "creditedSeasonPoints": 1000,
       "reviewedAt": "2026-09-16T09:05:00.000Z"
     }
     ```
6. `POST /admin/fraud/accounts/:id/reject` & `POST /api/admin/fraud/accounts/:id/reject`:
   - Rejects account: sets `users.status = 'banned'` or `'suspended'`, cancels frozen rewards, marks flags resolved, logs to `admin_audit_logs`.

---

## 4. Blueprint of Concrete Changes & Implementation Plan

### 4.1 Database Migration Requirements (`202609140011_admin_governance.sql`)
Author a sequential migration `supabase/migrations/202609140011_admin_governance.sql`:
1. **Schema Enhancements**:
   ```sql
   -- 1. Add admin_username column to public.admin_audit_logs
   alter table public.admin_audit_logs add column if not exists admin_username text;
   create index if not exists admin_audit_logs_username_idx on public.admin_audit_logs(admin_username);

   -- 2. Extend admin_audit_logs check constraints for account actions
   alter table public.admin_audit_logs drop constraint if exists admin_audit_logs_action_check;
   alter table public.admin_audit_logs add constraint admin_audit_logs_action_check check (
     action in (
       'update_config', 'set_feature_flag', 'freeze_season', 'ban_user', 'refund_purchase',
       'fraud_flag_created', 'fraud_flag_reviewed', 'fraud_flag_dismissed',
       'reward_frozen', 'reward_approved', 'reward_rejected',
       'admin_role_assigned', 'admin_role_revoked',
       'unfreeze_account', 'reject_account'
     )
   );

   -- 3. Seed canonical baseline values for new dynamic toggles
   insert into public.economy_config(key, value, description) values
     ('feature.maintenance_mode', 'false'::jsonb, 'Global emergency maintenance mode toggle'),
     ('economy.multiplier', '1.0'::jsonb, 'Global idle economy cash production multiplier')
   on conflict (key) do nothing;
   ```
2. **Stored Procedures**:
   - `public.empire_admin_update_config(p_key text, p_value jsonb, p_admin_user_id uuid, p_reason text, p_request_id uuid default null)`:
     - Verifies `empire_admin_check_role(p_admin_user_id, 'superadmin')`.
     - Idempotency check: returns existing audit log if `p_request_id` already exists.
     - Retrieves `v_old_value` from `economy_config`.
     - Fetches `v_admin_username` from `public.users` where `id = p_admin_user_id`.
     - Upserts into `economy_config`.
     - Inserts into `admin_audit_logs` including `admin_username = v_admin_username`.
     - Returns JSONB with `success`, `key`, `updatedValue`, `auditLogId`.
   - `public.empire_admin_get_audit_logs(p_limit int, p_offset int, p_target_key text default null)`:
     - Returns paginated audit logs, resolving `admin_username` via join on `public.users` if column was null in legacy rows.
   - `public.empire_admin_get_flagged_accounts(p_limit int, p_offset int)`:
     - Returns distinct suspicious accounts aggregated with risk score, pending flag count, frozen reward totals, and user metadata.
   - `public.empire_admin_unfreeze_account(p_target_user_id uuid, p_admin_user_id uuid, p_notes text, p_request_id uuid default null)`:
     - Enforces `superadmin` role.
     - Sets `users.status = 'active'`, risk score lowered/cleared if applicable.
     - For all frozen rewards of target user with status `'frozen'`: marks `'approved'`, credits balances via atomic ledger insert.
     - Updates pending fraud flags to `'resolved'`.
     - Inserts audit log row with `action = 'unfreeze_account'`, storing `admin_username`.
     - Returns summary of restored account and credited rewards.
3. **Permissions**:
   - Grant execution of all new functions strictly to `service_role`; revoke from public/anon/authenticated.

---

### 4.2 Store Layer Updates

#### In `apps/api/src/config/store.ts` (or `apps/api/src/admin/store.ts`):
Extend `ConfigStore` / `AdminStore` with methods:
```ts
export interface FeatureFlagsMap {
  'feature.stars_payments': boolean;
  'feature.maintenance_mode': boolean;
  'feature.referrals': boolean;
  'economy.multiplier': number;
  [key: string]: unknown;
}

export interface AdminAuditLogEntry {
  id: string;
  adminUserId: string | null;
  adminUsername: string | null;
  action: string;
  targetType: string;
  targetKey: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string | null;
  createdAt: string;
}

export interface AdminStore {
  checkSuperadminRole(userId: string): Promise<boolean>;
  getFeatureFlags(): Promise<FeatureFlagsMap>;
  updateConfigOrFlag(params: {
    key: string;
    value: unknown;
    adminUserId: string;
    reason?: string;
    requestId?: string;
  }): Promise<{ success: boolean; key: string; updatedValue: unknown; auditLogId: string }>;
  getAuditLogs(params?: { limit?: number; offset?: number; targetKey?: string }): Promise<{
    logs: AdminAuditLogEntry[];
    total: number;
  }>;
}
```

#### In `apps/api/src/fraud/store.ts`:
Add methods to `FraudStore`:
```ts
export interface FlaggedAccountDto {
  userId: string;
  telegramId: string;
  username: string | null;
  firstName: string;
  riskScore: number;
  status: string;
  pendingFlagsCount: number;
  frozenRewardsCount: number;
  totalFrozenCash: number;
  totalFrozenSeasonPoints: number;
  createdAt: string;
}

export interface UnfreezeAccountResult {
  success: boolean;
  userId: string;
  status: string;
  unfrozenRewardsCount: number;
  creditedCash: number;
  creditedSeasonPoints: number;
  reviewedAt: string;
}

// In FraudStore interface:
getFlaggedAccounts(params?: { limit?: number; offset?: number }): Promise<{
  accounts: FlaggedAccountDto[];
  total: number;
}>;
unfreezeAccount(params: {
  targetUserId: string;
  adminUserId: string;
  reason: string;
  requestId?: string;
}): Promise<UnfreezeAccountResult>;
```

---

### 4.3 Route Layer Architecture & Changes

To enforce modular isolation without touching unrelated modules:

#### Option A: Unified `apps/api/src/admin/routes.ts` (Recommended)
Create `apps/api/src/admin/routes.ts` mounted under `/admin` and `/api/admin`.
Endpoints:
- `GET /admin/feature-flags`
- `POST /admin/feature-flags`
- `GET /admin/audit-logs`
- `POST /admin/config` (relocated or proxied)
- `GET /admin/fraud/accounts`
- `POST /admin/fraud/accounts/:id/unfreeze`
- `POST /admin/fraud/accounts/:id/reject`
- Re-exports / mounts existing fraud endpoints with superadmin guard.

#### Option B: In-Place Updates in `config/routes.ts` and `fraud/routes.ts`
1. In `apps/api/src/config/routes.ts`:
   - Add RBAC guard to `POST /admin/config`:
     ```ts
     const uname = session.user.username?.toLowerCase();
     const isDesignated = uname === 'barandnz' || uname === 'mberked';
     const isSuperadmin = isDesignated || (await store.checkAdminRole(session.user.id, 'superadmin'));
     if (!isSuperadmin) {
       return c.json(error('FORBIDDEN'), 403);
     }
     ```
   - Add `GET /admin/feature-flags`: Returns dynamic toggles map with superadmin guard.
   - Add `POST /admin/feature-flags`: Idempotent toggle update with audit logging.
   - Add `GET /admin/audit-logs`: Paginated audit log retrieval.
2. In `apps/api/src/fraud/routes.ts`:
   - Update `GET /admin/fraud/flags`, `GET /admin/fraud/frozen`, and `POST /admin/fraud/review` to enforce superadmin guard (`@Barandnz`, `@Mberked`, or `role = 'superadmin'`).
   - Add `GET /admin/fraud/accounts`: Lists flagged suspicious accounts with risk scores.
   - Add `POST /admin/fraud/accounts/:id/unfreeze`: Unfreezes flagged account, approves frozen rewards, logs audit.
   - Add `POST /admin/fraud/accounts/:id/reject`: Rejects/bans account and cancels rewards.

Both options achieve 100% compliance with Blueprint Step 9 and Requirement R3.

---

### 4.4 Test Database Harness & Integration Test Updates

#### Updates to `apps/api/src/fraud/test-db.ts`:
1. Register `202609140011_admin_governance.sql` in `migrationFiles`.
2. Add RPC dispatch cases:
   - `empire_admin_update_config`: maps `$1=p_key, $2=p_value, $3=p_admin_user_id, $4=p_reason, $5=p_request_id`
   - `empire_admin_get_audit_logs`: maps `$1=p_limit, $2=p_offset, $3=p_target_key`
   - `empire_admin_get_flagged_accounts`: maps `$1=p_limit, $2=p_offset`
   - `empire_admin_unfreeze_account`: maps `$1=p_target_user_id, $2=p_admin_user_id, $3=p_notes, $4=p_request_id`
   - `empire_config_get` & `empire_config_update`

#### Test Suite Coverage Requirements:
1. **RBAC Security Matrix**:
   - Verify `@Barandnz` accesses all admin endpoints (HTTP 200).
   - Verify `@Mberked` accesses all admin endpoints (HTTP 200).
   - Verify non-designated user with `role = 'superadmin'` in `admin_roles` accesses all admin endpoints (HTTP 200).
   - Verify user with `role = 'auditor'` or `role = 'admin'` is rejected with HTTP 403 `FORBIDDEN` on superadmin-only endpoints.
   - Verify standard user without role receives HTTP 403 `FORBIDDEN`.
   - Verify unauthenticated requests receive HTTP 401 `UNAUTHORIZED`.
2. **Feature Flags & Idempotency**:
   - Toggle `feature.stars_payments`, `feature.maintenance_mode`, `feature.referrals`, and `economy.multiplier`.
   - Verify updates persist and reflect in `GET /admin/feature-flags` and `GET /config/public`.
   - Verify idempotency: re-issuing `POST /admin/feature-flags` with identical `requestId` returns HTTP 200 without duplicate audit rows.
   - Verify `public.admin_audit_logs` contains exact `admin_username` (`Barandnz` / `Mberked`), `action`, `target_key`, `old_value`, `new_value`, and `created_at`.
3. **Fraud Review & Unfreeze Lifecycle**:
   - Seed high-risk user (`risk_score = 85`), create pending flags, quarantine a reward in `frozen_rewards`.
   - Call `GET /admin/fraud/accounts`: assert account appears with risk score 85 and pending flag counts.
   - Call `POST /admin/fraud/accounts/:id/unfreeze` with superadmin session:
     - User status becomes `'active'`.
     - Quarantined reward status becomes `'approved'`.
     - Balance credited atomically.
     - Audit log row written with `action = 'unfreeze_account'` and `admin_username = 'Barandnz'`.
   - Repeat unfreeze to verify idempotency (already unfreezed).

---

## 5. Risk Assessment & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Breaking existing `config/routes.test.ts` by adding strict RBAC | `routes.test.ts` uses `config_admin` without role | Update `routes.test.ts` to use `@Barandnz` or seed `superadmin` role for `config_admin`. |
| Session username missing in test mock | In-memory fast-path returns false | Always fallback to calling `empire_admin_check_role` via RPC, which checks DB table `admin_roles` and `users`. |
| Concurrency on feature flag updates | Stale overwrite | Use database row locks (`FOR UPDATE`) inside `empire_admin_update_config`. |
| Duplicate audit log entries on retries | Audit table pollution | Use `requestId` as primary key / conflict target on `admin_audit_logs(id)` or idempotency deduplication. |

---
*Report complete. All findings directly verified against code and database migrations on disk.*
