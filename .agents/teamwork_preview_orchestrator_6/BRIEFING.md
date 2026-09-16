# BRIEFING — 2026-09-15T12:06:00Z

## Mission
Complete the mission and referral progression lifecycle for Project Empire (daily/weekly mission assignment, real-time action progress, daily streak claiming, qualified referral milestone verification) and establish production launch readiness (real PostgreSQL concurrency & load tests, monitoring telemetry, backup, and rollback runbooks).

## 🔒 My Identity
- Archetype: teamwork_preview_orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_orchestrator_6
- Original parent: parent
- Original parent conversation ID: 540e9f86-3c00-48dd-aa13-6dbf03084fa3

## 🔒 My Workflow
- **Pattern**: Project
- **Scope document**: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_orchestrator_6\PROJECT.md
1. **Decompose**: Decomposed into 6 milestones (M1: DB Migration & Core, M2: Missions & Streaks, M3: Referrals, M4: Concurrency & Load Harness, M5: Ops Runbooks, M6: Verification & Gate).
2. **Dispatch & Execute**:
   - Survey completed: 3 reports synthesized.
   - M1-M3: Implementation in place (`202609140009_missions_and_launch.sql`, `missions.ts`, `routes.ts`, `store.ts`).
   - M5: COMPLETED by `088df656` (`MONITORING.md`, `BACKUP_AND_DISASTER_RECOVERY.md`, `ROLLBACK_PLAN.md`).
   - M4: Dispatched Worker Concurrency (`669c187a`) for test harness, 20+ parallel request concurrency suites, and 100+ player load benchmark.
   - Next: Verification & Quality Gate (Reviewers, Challengers, Forensic Auditor).
3. **On failure**:
   - Retry -> Replace -> Skip (except Auditor) -> Redistribute -> Redesign -> Escalate.
4. **Succession**: Self-succeed when spawn count >= 16 and pending subagents complete.
- **Work items**:
  1. Survey & Architecture Exploration [DONE]
  2. Milestone 1: DB Migration 0009 & Core Missions Selector [DONE]
  3. Milestone 2: Missions & Daily Streak Lifecycle APIs [DONE]
  4. Milestone 3: Qualified Referral Progression & Rewards [DONE]
  5. Milestone 5: Production Operations Runbooks [DONE]
  6. Milestone 4: PostgreSQL Concurrency & Load Stress Harness [IN_PROGRESS]
  7. Milestone 6: Verification & Quality Gate [pending]
- **Current phase**: Implementation (M4)
- **Current focus**: PostgreSQL concurrency suites and 100+ player load benchmark

## 🔒 Key Constraints
- NEVER write, modify, or create source code files directly.
- NEVER run build/test commands yourself — require workers to do so.
- NEVER investigate or explore the problem at the code level — dispatch Explorers for technical investigation.
- You MAY use file-editing tools ONLY for metadata/state files (.md) in your .agents/ folder.
- Preserve existing game loop functionality and anti-fraud boundaries (0 regressions, all existing tests pass).
- Keep all UI/visual components in `apps/web/src/screens/` isolated.
- All new database schema modifications or migrations must use sequential numbering (`202609140009_missions_and_launch.sql`).
- Real PostgreSQL / PGlite tests must verify actual transaction isolation and row locking (`FOR UPDATE`).
- Forensic Auditor verdict is a BINARY VETO.
- Never reuse a subagent after it has delivered its handoff — always spawn fresh.

## Current Parent
- Conversation ID: 540e9f86-3c00-48dd-aa13-6dbf03084fa3
- Updated: 2026-09-15T07:21:00Z

## Key Decisions Made
- M1, M2, M3 backend components and M5 operational runbooks are complete.
- Dispatched Worker Concurrency (`669c187a`) to build independent test DB harness (`apps/api/src/launch/test-db.ts`), Vitest concurrency suites (`apps/api/src/launch/concurrency.test.ts`), and 100-player load benchmark (`scripts/load-benchmark.ts`).

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|
| survey_missions_rep | teamwork_preview_explorer | Survey R1 Missions & R2 Streaks | COMPLETED | 5b24c17e-31b4-4ddf-9979-06628b2251c7 |
| survey_referrals_rep | teamwork_preview_explorer | Survey R3 Qualified Referrals | COMPLETED | ab45ddb2-c123-4fe2-aedc-4634c55d45b5 |
| survey_db_load_rep | teamwork_preview_spec_miner | Survey R4 Concurrency & R5 Ops | COMPLETED | 4a5d757c-5094-4418-803d-8846e098c3c2 |
| worker_backend | teamwork_preview_worker | M1, M2, M3 Implementation | KILLED (hung) | 0f12ce17-5003-4b61-8a08-5991bae6bda1 |
| worker_ops | teamwork_preview_worker | M5 Production Ops Runbooks | COMPLETED | 088df656-4425-47fb-a44c-b63a226f0975 |
| worker_concurrency | teamwork_preview_worker | M4 Concurrency & Load Stress | running | 669c187a-99b4-4c64-88b2-001f3224949e |

## Succession Status
- Succession required: no
- Spawn count: 9 / 16
- Pending subagents: 669c187a-99b4-4c64-88b2-001f3224949e
- Predecessor: teamwork_preview_orchestrator_5
- Successor: not yet spawned

## Active Timers
- Heartbeat cron: task-20
- Safety timer: none
- On succession: kill all timers before spawning successor
- On context truncation: run `manage_task(Action="list")` — re-create if missing

## Artifact Index
- `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_orchestrator_6\PROJECT.md` — Global architecture & feature inventory
- `c:\Users\Administrator\Desktop\telegram kripto oyunu\HANDOFF.md` — Project root handoff document
- `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_orchestrator_6\progress.md` — Liveness & status tracking
- `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_orchestrator_6\BRIEFING.md` — Working memory
- `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_orchestrator_6\DISPATCH.md` — Task assignment
