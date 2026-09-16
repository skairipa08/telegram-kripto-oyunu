# Progress: Stream 3 (Admin Backend & Governance)

Last visited: 2026-09-16T09:26:30+03:00

## Status: COMPLETE

### Milestones & Deliverables
1. [x] **Investigation & Baseline Verification**:
   - Analyzed existing auth, fraud, and config routes.
   - Identified CSRF Origin requirement (`Origin: origin`) and PGlite parameterized query constraints.
2. [x] **Database Migration (`supabase/migrations/202609140011_admin_governance.sql`)**:
   - Added `admin_username text` column to `admin_audit_logs`.
   - Extended audit action constraint: `set_feature_flag`, `config_update`, `unfreeze_account`, `reject_account`.
   - Seeded baseline dynamic feature flags: `feature.stars_payments` (false), `feature.maintenance_mode` (false), `feature.referrals` (true), `economy.multiplier` (1.0).
   - Created stored procedures:
     - `empire_admin_update_config`: Idempotent updates with `requestId`, immutably logging old/new values, admin username/ID, and reasons.
     - `empire_admin_get_audit_logs`: Chronological audit log feed with pagination (`limit`, `offset`) and `target_key` filtering.
     - `empire_admin_get_flagged_accounts`: High-risk account review queue aggregating users, fraud flags, and frozen rewards.
     - `empire_admin_unfreeze_account`: Idempotent account unfreeze resetting risk score to 0, approving frozen rewards, resolving fraud flags, crediting balances and seasons via `reward_ledger`, and logging audit records.
3. [x] **Store Layer (`apps/api/src/admin/store.ts` & `apps/api/src/config/store.ts`)**:
   - Implemented `AdminStore` and `SupabaseAdminStore` compliant with `exactOptionalPropertyTypes`.
   - Updated `ConfigStore` and `SupabaseConfigStore` to support superadmin verification and idempotent updates.
4. [x] **API Route Handlers (`apps/api/src/admin/routes.ts` & `apps/api/src/config/routes.ts`)**:
   - Strict Superadmin RBAC: Enforces that session username is in (`barandnz`, `mberked`) (case-insensitive) OR `empire_admin_check_role(userId, 'superadmin')`.
   - Unauthenticated requests return 401 `UNAUTHORIZED`.
   - Regular users and auditors return 403 `FORBIDDEN`.
   - Implemented endpoints:
     - `GET /admin/feature-flags`
     - `POST /admin/feature-flags` (with idempotency and audit logs)
     - `GET /admin/audit-logs` (with pagination and filters)
     - `GET /admin/fraud/accounts`
     - `POST /admin/fraud/accounts/:id/unfreeze` & alias `resolve`
     - Updated `POST /admin/config` to enforce strict superadmin RBAC.
5. [x] **App Mounting & Parity (`apps/api/src/index.ts`)**:
   - Mounted `createAdminRoutes` on `/` (for `/admin/*`) and `/api` (for `/api/admin/*`) preserving dual-mounting parity.
6. [x] **Integration Testing & Test Harness (`apps/api/src/admin/routes.test.ts` & `apps/api/src/fraud/test-db.ts`)**:
   - Registered migration `0011` in `apps/api/src/fraud/test-db.ts` with RPC routing.
   - Comprehensive test suite in `apps/api/src/admin/routes.test.ts` with 17 tests covering RBAC matrix, feature flags, idempotency, audit log feeds, fraud account unfreeze, and dual mounting.
   - Verified 52/52 target tests pass (`admin/`, `config/`, `fraud/`).
   - Verified 175/175 tests pass across entire `apps/api` (0 regressions).
   - Typecheck clean (`pnpm --filter @empire/api typecheck` exit code 0).
