# BRIEFING — 2026-09-15T11:29:00Z

## Mission
Investigate codebase for R1 (Mission Pool Assignment & Real-Time Action Progression) and R2 (Daily Streak Evaluation & Claim Endpoint), producing a self-contained handoff report.

## 🔒 My Identity
- Archetype: Explorer
- Roles: Explorer, Synthesizer
- Working directory: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_survey6_missions_rep
- Original parent: 3219366b-6e17-4215-806c-8fc42e4d3c7f
- Milestone: Survey 6 - Missions & Streaks

## 🔒 Key Constraints
- Read-only investigation — do NOT implement or modify code
- Preserve existing game loop
- Do not modify UI in `apps/web/src/screens/`
- Check exact endpoint contracts, DB schemas, hooks, formulas, error codes

## Current Parent
- Conversation ID: 3219366b-6e17-4215-806c-8fc42e4d3c7f
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `packages/game-core/src/missions.ts` & `missions.test.ts`
  - `packages/game-core/src/formulas.ts` & `config.ts`
  - `packages/shared/src/index.ts` (DTOs and Zod schemas)
  - `apps/api/src/economy/store.ts` & `routes.ts`
  - `apps/api/src/auth/routes.ts` & `test-db.ts`
  - `apps/api/src/fraud/test-db.ts` & `review-stress.test.ts`
  - `apps/api/src/index.ts`
  - `apps/web/src/game/live-game.tsx` & `apps/web/src/screens/missions-screen.tsx`
  - `supabase/migrations/` (migrations 0001, 0002, 0003, 0004, 0005, 0006, 0008)
- **Key findings**:
  - `packages/game-core/src/missions.ts` contains canonical definitions for 9 missions across 4 pools (3 easy, 3 normal, 2 hard, 1 weekly), `calculateMissionReward`, `calculateStreakReward`, `evaluateStreak`, `isMissionCompleted`.
  - Missing in `packages/game-core`: automated daily mission pool selector (e.g. 1 easy, 1 normal, 1 hard, 1 weekly based on user + calendar date).
  - Missing in `apps/api/src/economy/routes.ts`: `POST /streak/claim` (and `/api/streak/claim`). `EconomyStore` has `getStreak(userId)` but lacks `claimStreak(userId, requestId)`.
  - Missing on disk: `supabase/migrations/202609140007_game_loop_apis.sql`, causing legacy `test-db.ts` to throw ENOENT when loading migrations.
  - Action progression hooks identified:
    - Upgrade hook: `POST /economy/upgrade` -> `upgrade_any_*`, `reach_milestone` (levels 10, 25, 50, 100, 150...), `upgrade_factory_tier` (factory, tech_company, global_holding).
    - Claim hook: `POST /economy/claim` -> `claim_cash_*`, `claim_offline_4h` (elapsedSeconds >= 14400).
    - Social hook: `GET /referral/status` -> `view_friends`.
    - Daily-to-Weekly hook: completed/claimed daily -> `weekly_complete_15_dailies`.
  - Database tables: `missions`, `mission_instances`, `player_streaks`, `player_balances`, `season_scores`, `reward_ledger`.
  - Strict UI boundaries: `apps/web/src/screens/` must remain untouched.
- **Unexplored areas**: None within survey scope.

## Key Decisions Made
- Fully documented all 6 survey scope points.
- Mapped exact endpoint contracts, payload schemas, error codes, and SQL transaction requirements.

## Artifact Index
- context.md — initial context
- DISPATCH.md — dispatch message
- BRIEFING.md — persistent memory
- progress.md — liveness heartbeat
- handoff.md — 5-component comprehensive handoff report
