## 2026-09-15T12:06:17Z
You are a Worker implementing the PostgreSQL Concurrency Test Suite and 100+ Player Load Stress Benchmark for Project Empire (Milestone M4 / Requirement R4).
Your working directory is: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_concurrency
Project root: c:\Users\Administrator\Desktop\telegram kripto oyunu

MANDATORY FIRST STEP: Read the authoritative user request at:
c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md
Specifically review section "## 2026-09-15T07:19:14Z" covering R4 (Real PostgreSQL Concurrency & Load Stress Harness).

Also read:
- Project Specification: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_orchestrator_6\PROJECT.md`
- Survey Report on DB and Concurrency: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_spec_miner_survey6_db_load_rep\handoff.md` (Specifically Section 3 & 4)
- Existing Migration: `supabase/migrations/202609140009_missions_and_launch.sql`
- Fraud Test DB pattern: `apps/api/src/fraud/test-db.ts` and `apps/api/src/fraud/review-stress.test.ts`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE OWNERSHIP (You own ONLY these files):
- `apps/api/src/launch/test-db.ts`
- `apps/api/src/launch/concurrency.test.ts`
- `scripts/load-benchmark.ts`
- `package.json` (adding `"test:load": "tsx scripts/load-benchmark.ts"`)
- `PROJECT.md` (sync milestones/status)
DO NOT touch any files in `apps/web/src/screens/**` or `apps/api/src/auth/test-db.ts`.

TASK DETAILS:
1. `apps/api/src/launch/test-db.ts`:
   - Independent PGlite test harness (patterned after `apps/api/src/fraud/test-db.ts`) that executes migrations from 0001 through 0009 dynamically.
   - Provides mock PostgREST fetcher and direct transaction handles for economy, game loop, streak, mission, and referral endpoints and RPCs.
   - Does NOT touch `apps/api/src/auth/test-db.ts`.
2. `apps/api/src/launch/concurrency.test.ts`:
   - Vitest test suite executing 20+ parallel racing requests against real PGlite/Postgres transactions:
     a) Concurrent racing balance updates: multiple parallel requests claiming cash or upgrading simultaneously must preserve invariant balance consistency without double-spend or negative balances.
     b) Concurrent streak claims: 20 simultaneous requests with the same session must execute exactly once (1x 200 OK, 19x 400 ALREADY_CLAIMED).
     c) Concurrent mission claims: 20 simultaneous requests with the same mission instance must execute exactly once (1x 200 OK, 19x 400 ALREADY_CLAIMED).
     d) Concurrent referral bindings: 20 simultaneous binding requests with the same invitee must cleanly handle unique constraints without deadlocks (1x 200 OK, 19x 400 ALREADY_REFERRED).
3. `scripts/load-benchmark.ts`:
   - Simulates 100+ virtual concurrent players performing interleaved game loop cycles (login -> get state -> streak claim -> business upgrade -> offline earnings claim -> mission claim -> leaderboard query).
   - Validates database connection pool stability, zero unhandled errors, and reports throughput (RPS) and latency percentiles (min, p50, p95, p99, max).
   - Add script `"test:load": "tsx scripts/load-benchmark.ts"` to root `package.json`.
4. Verification:
   - Run `pnpm vitest run apps/api/src/launch/concurrency.test.ts` (verify all 4 concurrency suites pass).
   - Run `pnpm test:load` (verify 100 concurrent player benchmark completes with 0 unhandled errors).
