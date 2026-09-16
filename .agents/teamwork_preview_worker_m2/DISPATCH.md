## 2026-09-15T06:25:15Z
You are Worker M2 for Project Empire.
Your working directory: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_m2
Project Root: c:\Users\Administrator\Desktop\telegram kripto oyunu
Original Request: c:\Users\Administrator\Desktop\telegram kripto oyunu\ORIGINAL_REQUEST.md
Architecture & Scope: c:\Users\Administrator\Desktop\telegram kripto oyunu\PROJECT.md
Survey & Specs: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_spec_miner_survey_db\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

STRICT BOUNDARIES & WRITE OWNERSHIP:
- You exclusively own and may create ONLY:
  - `supabase/migrations/202609140008_anti_fraud.sql` (create)
- Strictly DO NOT TOUCH:
  - `supabase/migrations/202609140007_game_loop_apis.sql`
  - `apps/api/src/auth/test-db.ts`
  - `apps/api/src/economy/**`
  - `apps/web/src/game/**`
  - `apps/web/src/screens/**`, CSS
  - `apps/api/src/shop/**`

TASK (Requirement R2):
1. Create `supabase/migrations/202609140008_anti_fraud.sql` implementing the complete DDL and stored procedures specified in `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_spec_miner_survey_db\handoff.md`:
   - Section 1: Extend `public.admin_audit_logs` check constraints on `action` and `target_type` (allowing `reward_frozen`, `reward_approved`, `reward_rejected`, `fraud_flag_created`, `fraud_flag_reviewed`, `fraud_flag_dismissed`, `admin_role_assigned`, `admin_role_revoked`, and target types `fraud_flag`, `frozen_reward`, `admin_role`).
   - Section 2: Table `public.admin_roles` (id, user_id, role check in ('admin', 'superadmin', 'auditor'), assigned_by, timestamps, unique(user_id, role)).
   - Section 3: Table `public.fraud_flags` (id, user_id, target_type, target_id, risk_score 0-100, reason_codes text[] not empty, severity, status, metadata, reviewed_by, reviewed_at, resolution_notes, timestamps).
   - Section 4: Table `public.frozen_rewards` (id, user_id, fraud_flag_id, reward_type, amount_cash >= 0, amount_season_points >= 0, status in ('frozen', 'approved', 'rejected'), freeze_reason, source_ref_id, metadata, frozen_at, reviewed_by, reviewed_at, review_notes, timestamps; check amount_cash > 0 or amount_season_points > 0).
   - Section 5: Strict RLS enabled on all 3 tables; revoked from public, anon, authenticated; granted to `service_role`.
   - Section 6: Stored procedures with `security definer set search_path = 'public'`:
     * `empire_admin_check_role`
     * `empire_fraud_create_flag` (updates user risk score, emits `fraud_flag_created` analytics event)
     * `empire_fraud_freeze_reward` (emits `reward_frozen` analytics event, logs to `admin_audit_logs`)
     * `empire_admin_review_reward` (verifies admin role, checks reasoning required, handles approve atomically: credits player_balances, updates active season_scores, writes 64-hex SHA-256 idempotency key to reward_ledger, resolves flag, logs to admin_audit_logs; handles reject: cancels reward, resolves flag, logs to admin_audit_logs)
     * `empire_admin_review_flag`
     * `empire_admin_get_fraud_flags` (paginated, user join)
     * `empire_admin_get_frozen_rewards` (paginated, user and balance join)
     * `empire_admin_assign_role`
2. Test and verify SQL syntax and compatibility.

Deliver a structured handoff report in `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_m2\handoff.md` detailing the migration file created and verification details. When finished, send a message to orchestrator parent.
