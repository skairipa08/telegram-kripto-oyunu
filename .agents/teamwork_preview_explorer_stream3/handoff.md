# Handoff Report: Stream 3 Explorer (Admin RBAC, Feature Flags & Fraud Review System)

## 1. Observation
- **`apps/api/src/config/routes.ts`**:
  - Exposes `GET /config/public` (lines 28–45) and `POST /admin/config` (lines 48–88).
  - Lines 56–58: Only validates session existence (`if (!session) return c.json(error('UNAUTHORIZED'), 401)`). Does NOT verify admin or superadmin role. Any authenticated user can modify economy configurations.
- **`apps/api/src/fraud/routes.ts`**:
  - Exposes `GET /admin/fraud/flags`, `GET /admin/fraud/frozen`, and `POST /admin/fraud/review`.
  - Lines 59–62 & 105–108: Accepts role `'auditor'`.
  - Lines 150–153: Accepts role `'admin'`.
  - Both `/admin/*` and `/api/admin/*` are dual-mounted in `apps/api/src/index.ts`.
- **`apps/api/src/admin/`**:
  - Directory does not currently exist.
- **`supabase/migrations/`**:
  - `202609140008_anti_fraud.sql`: Creates `admin_roles`, `fraud_flags`, `frozen_rewards`, stored procedures (`empire_admin_check_role`, `empire_fraud_create_flag`, `empire_fraud_freeze_reward`, `empire_admin_review_reward`, `empire_admin_review_flag`, `empire_admin_get_fraud_flags`, `empire_admin_get_frozen_rewards`, `empire_admin_assign_role`).
  - `202609140010_designated_admins.sql`: Implements designated superadmins `@Barandnz` and `@Mberked`:
    - `empire_admin_check_role` directly returns `true` if `lower(username) in ('barandnz', 'mberked')`.
    - Trigger `trg_designated_admins_auto_assign` on `public.users` auto-inserts `superadmin` into `admin_roles`.
- **`public.admin_audit_logs` schema**:
  - Currently contains: `id`, `admin_user_id`, `action`, `target_type`, `target_key`, `old_value`, `new_value`, `reason`, `created_at`.
  - Does NOT yet contain `admin_username` as a dedicated column.
- **Test suite execution**:
  - All 421 tests across 35 test files pass cleanly (`pnpm vitest run`).

## 2. Logic Chain
1. Requirement R3 mandates:
   - "Enforce strict RBAC on all admin endpoints: verify caller session belongs to authorized superadmin (@Barandnz or @Mberked or role = superadmin). 403 FORBIDDEN for unauthorized users."
2. The current implementation in `POST /admin/config` allows any logged-in user to mutate config because it lacks an RBAC check.
3. Adding the check `lower(username) in ('barandnz', 'mberked') || checkAdminRole(userId, 'superadmin')` to `POST /admin/config` and all new `/admin/*` endpoints ensures only `@Barandnz`, `@Mberked`, or users with `superadmin` in `admin_roles` are authorized; unauthorized users receive 403 `FORBIDDEN`.
4. Storing `admin_username` in `admin_audit_logs` requires either adding an `admin_username text` column via migration `202609140011_admin_governance.sql`, or resolving it at insertion time via `select username from public.users where id = p_admin_user_id`.
5. Dynamic toggles (`feature.stars_payments`, `feature.maintenance_mode`, `feature.referrals`, `economy.multiplier`) can be persisted in `public.economy_config` and managed idempotently using `requestId` as deduplication key.
6. The fraud queue review API requires listing flagged accounts with risk scores (`GET /admin/fraud/accounts`) and actions to approve, reject, or unfreeze flagged accounts (`POST /admin/fraud/accounts/:id/unfreeze`, etc.), coordinating updates between `users`, `fraud_flags`, `frozen_rewards`, and `admin_audit_logs`.

## 3. Caveats
- `apps/api/src/config/routes.test.ts` currently tests `POST /admin/config` using a user named `config_admin` who has no `superadmin` role. Once strict RBAC is added, this test must be updated to seed `@Barandnz` or grant `superadmin` to `config_admin` to prevent test regression.
- `apps/api/src/auth/test-db.ts` does not have RPC handling for `empire_admin_check_role` in its switch/case statement. Test databases for admin governance must either extend `apps/api/src/fraud/test-db.ts` or add the RPC case to avoid runtime dispatch errors.

## 4. Conclusion
- Requirement R3 is clearly scoped and can be implemented via:
  1. A new migration `202609140011_admin_governance.sql` adding `admin_username` to `admin_audit_logs`, default config rows, and stored procedures for feature flag updates, audit logs query, account unfreezing, and suspicious account listing.
  2. Strict RBAC middleware/guard on all admin endpoints checking `@Barandnz`, `@Mberked`, or `role = 'superadmin'`.
  3. Feature flag management endpoints (`GET /admin/feature-flags`, `POST /admin/feature-flags`, `GET /admin/audit-logs`).
  4. Fraud review & unfreeze endpoints (`GET /admin/fraud/accounts`, `POST /admin/fraud/accounts/:id/unfreeze`, `POST /admin/fraud/accounts/:id/reject`).
  5. Vitest test coverage ensuring 100% pass rate without breaking existing 421 tests.

## 5. Verification Method
- Independent verification commands:
  ```bash
  # Run config and fraud test suites
  pnpm vitest run apps/api/src/config apps/api/src/fraud

  # Run full repository test suite
  pnpm vitest run
  ```
- File inspection:
  - Check `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_stream3\report.md` for complete technical blueprint.
  - Verify `supabase/migrations/202609140010_designated_admins.sql` lines 36–52 for existing `@Barandnz` / `@Mberked` RBAC logic.
  - Verify `apps/api/src/config/routes.ts` line 56 for missing RBAC check on `POST /admin/config`.
