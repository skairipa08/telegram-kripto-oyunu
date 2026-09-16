# BRIEFING — 2026-09-15T12:02:00Z

## Mission
Implement Backend, Game Core, and Database Migration for Project Empire (M1, M2, M3).

## 🔒 My Identity
- Archetype: Worker
- Roles: implementer, qa, specialist
- Working directory: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_backend
- Original parent: 3219366b-6e17-4215-806c-8fc42e4d3c7f
- Milestone: M1, M2, M3 (Backend, Game Core, DB Migrations)

## 🔒 Key Constraints
- Exclusive write ownership:
  - `supabase/migrations/202609140009_missions_and_launch.sql`
  - `packages/game-core/src/missions.ts`
  - `packages/game-core/src/missions.test.ts`
  - `packages/shared/src/index.ts`
  - `apps/api/src/economy/routes.ts`
  - `apps/api/src/economy/store.ts`
  - `PROJECT.md`
- NEVER touch `apps/web/src/screens/**` or `apps/api/src/auth/test-db.ts`.
- Genuine implementations only: no hardcoding, no dummy facades.

## Current Parent
- Conversation ID: 3219366b-6e17-4215-806c-8fc42e4d3c7f
- Updated: 2026-09-15T12:02:00Z

## Task Summary
- **What to build**:
  - M1 DB Migration: `supabase/migrations/202609140009_missions_and_launch.sql` (columns, indexes, row-locking stored procedures) — COMPLETED.
  - M1 Game Core: Deterministic mission pool selector `selectMissionPool` (3 daily: 1 easy, 1 normal, 1 hard + 1 weekly) + unit tests — COMPLETED.
  - M2 API Store & Routes: Automated mission assignment, action hooks in claimCash and upgradeBusiness, POST /missions/:id/claim, POST /streak/claim — COMPLETED.
  - M3 API Store & Routes: Invitee progression milestones evaluation, referral events, POST /referral/claim — COMPLETED.
- **Success criteria**: All unit tests pass, typechecks pass, ESLint passes.

## Key Decisions Made
- Used FNV-1a hash and Monday UTC week truncation for deterministic mission pool selection.
- Stored procedures use `FOR UPDATE` on `mission_instances`, `player_streaks`, `player_balances`, and `referral_events`.
- Dual progression hooks in both stored procedures and API route handlers to guarantee consistency across all execution modes.
- Badges array dynamically maps both canonical keys and legacy `'recruiter'` to ensure backwards compatibility.

## Artifact Index
- `supabase/migrations/202609140009_missions_and_launch.sql`
- `packages/game-core/src/missions.ts`
- `packages/game-core/src/missions.test.ts`
- `apps/api/src/economy/routes.ts`
- `apps/api/src/economy/store.ts`
- `PROJECT.md`

## Change Tracker
- **Files modified**:
  - `supabase/migrations/202609140009_missions_and_launch.sql`: Created complete sequential migration
  - `packages/game-core/src/missions.ts`: Added deterministic pool picker and hash utilities
  - `packages/game-core/src/missions.test.ts`: Added 8 new unit tests for mission selection, hashing, week calculation
  - `apps/api/src/economy/store.ts`: Added streak, referral reward, and mission progression methods to store interface & class
  - `apps/api/src/economy/routes.ts`: Added POST /streak/claim, POST /referral/claim, progression hooks, auto assignment
  - `PROJECT.md`: Synced from orchestrator specification
- **Build status**: All packages typecheck cleanly, 219 game-core tests pass, ESLint passes with 0 errors
- **Pending issues**: Writing handoff report

## Quality Status
- **Build/test result**: All 219 game-core tests pass, 28 api fraud tests pass, typechecks pass
- **Lint status**: 0 violations on modified files
- **Tests added/modified**: 8 new unit tests in `missions.test.ts` (19 total in suite)

## Loaded Skills
- None
