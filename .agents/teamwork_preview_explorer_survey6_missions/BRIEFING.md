# BRIEFING — 2026-09-15T07:22:00Z

## Mission
Investigate the existing codebase for how missions and daily streaks are implemented, structured, and need to be integrated for R1 and R2.

## 🔒 My Identity
- Archetype: Explorer
- Roles: Read-only investigation, code analysis, synthesis
- Working directory: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_survey6_missions
- Original parent: 3219366b-6e17-4215-806c-8fc42e4d3c7f
- Milestone: Survey 6 - Missions & Daily Streaks (R1 & R2)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Preserve existing game loop
- Do not modify UI in apps/web/src/screens/
- Write only to own agent directory (.agents/teamwork_preview_explorer_survey6_missions/)

## Current Parent
- Conversation ID: 3219366b-6e17-4215-806c-8fc42e4d3c7f
- Updated: not yet

## Investigation State
- **Explored paths**: None yet
- **Key findings**: Starting investigation
- **Unexplored areas**:
  1. `ORIGINAL_REQUEST.md` (section `## 2026-09-15T07:19:14Z`)
  2. `packages/game-core` mission types, mission pools, streak logic, SRU calculations, formula utilities
  3. `apps/api` routes, services, handlers related to `/missions`, `/streak`, auth/bootstrap/me, economy claim/upgrade
  4. Economy action progression hooks (`claim_cash_*`, `claim_offline_4h`, `upgrade_any_*`, `reach_milestone`, `upgrade_factory_tier`)
  5. Current database schema / migrations (prisma or sql) for missions, mission_instances, player_streaks, player_balances, season_scores
  6. Endpoint contracts for `POST /missions/:id/claim`, `POST /streak/claim` (validation, idempotency, atomicity, error codes)

## Key Decisions Made
- Initialized briefing and dispatch tracking

## Artifact Index
- DISPATCH.md — incoming dispatch instructions
- BRIEFING.md — working memory and context tracking
- progress.md — liveness heartbeat
- handoff.md — final handoff report
