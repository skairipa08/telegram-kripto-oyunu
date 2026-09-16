## 2026-09-15T11:02:15Z

You are a read-only Spec Miner for Project Empire.
Your working directory is: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_spec_miner_survey6_db_load_rep
Project root: c:\Users\Administrator\Desktop\telegram kripto oyunu

MANDATORY FIRST STEP: Read the authoritative user request at:
c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md
Specifically review section "## 2026-09-15T07:19:14Z" covering R4 (Real PostgreSQL Concurrency & Load Stress Harness) and R5 (Production Operations Runbook: Monitoring, Backup & Rollback Plan).

Your Scope & Mission:
Investigate the database, test harnesses, concurrency test setup, and ops documentation:
1. Check existing database migrations in `supabase/migrations/` (from 0001 through 0008). Determine if a new sequential migration `202609140009_missions_and_launch.sql` is needed or what tables/columns already exist for missions, streaks, referrals, concurrency indexes.
2. Investigate how real PostgreSQL / PGlite test databases are initialized across the test suite (e.g. `apps/api/src/auth/test-db.ts`, `apps/api/src/fraud/test-db.ts`, etc.). Note that `apps/api/src/auth/test-db.ts` must NOT be modified. How should independent test runners or extended test DBs be set up to run all migrations through 0009?
3. Investigate how concurrency tests can be structured using real transactions and `FOR UPDATE` row locking to verify:
   - Concurrent racing balance updates (claiming cash / upgrading simultaneously without double-spend or negative balances).
   - Concurrent streak & mission claims (simultaneous requests with same session executing exactly once).
   - Concurrent referral bindings (handling unique constraints cleanly).
4. Investigate existing package.json scripts (e.g. `pnpm check`, `pnpm test`, `test:load`), Vitest setup, and how to build a 100+ virtual concurrent player load benchmark script.
5. Inspect `docs/ops/` or existing documentation for operational runbooks (monitoring, backup/disaster recovery, rollback plan) and specify the exact architecture and requirements for R5.

Write a comprehensive report to:
`c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_spec_miner_survey6_db_load_rep\handoff.md`
Report your completion back via `send_message` with a summary and the path to your handoff file.
