# BRIEFING — 2026-09-15T07:22:00Z

## Mission
Investigate and document specifications for R4 (Real PostgreSQL Concurrency & Load Stress Harness) and R5 (Production Operations Runbook: Monitoring, Backup & Rollback Plan) for Project Empire.

## 🔒 My Identity
- Archetype: Specification Miner
- Roles: Teamwork specialist, Spec Miner
- Working directory: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_spec_miner_survey6_db_load
- Original parent: 3219366b-6e17-4215-806c-8fc42e4d3c7f
- Milestone: Survey 6 - Database, Concurrency, Load, and Operations Runbook

## 🔒 Key Constraints
- Read-only Spec Miner — do NOT implement or modify application code / migrations / test files
- apps/api/src/auth/test-db.ts must NOT be modified
- Authoritative user request in .agents/ORIGINAL_REQUEST.md must be reviewed
- Full interface enumeration, edge cases, Features Discovered table
- Handoff report in handoff.md with 5 components
- Send completion message to parent (3219366b-6e17-4215-806c-8fc42e4d3c7f)

## Current Parent
- Conversation ID: 3219366b-6e17-4215-806c-8fc42e4d3c7f
- Updated: 2026-09-15T07:22:00Z

## Task Summary
- **What to investigate**:
  1. Existing migrations (0001 to 0008) in supabase/migrations/ and need for migration 0009.
  2. Test database harness & PGlite setup across API test suite.
  3. Concurrency test architecture (FOR UPDATE row locking, racing balance updates, streak/mission claims, referral binding).
  4. Load test harness (100+ virtual concurrent players, scripts, Vitest setup).
  5. Operations runbooks in docs/ops/ (monitoring, backup/DR, rollback plan).
- **Success criteria**: Comprehensive handoff.md and completion message.
- **Interface contracts**: supabase/migrations, apps/api/src, docs/ops
- **Code layout**: apps/api, packages, supabase, docs

## Key Decisions Made
- Starting systematic survey across DB migrations, test harnesses, concurrency test patterns, package.json scripts, and ops runbooks.

## Artifact Index
- handoff.md — Comprehensive findings and spec mining report
- DISPATCH.md — Task assignment
- progress.md — Heartbeat and step tracking
