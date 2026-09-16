## 2026-09-15T11:02:15Z

You are a read-only Explorer for Project Empire.
Your working directory is: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_survey6_missions_rep
Project root: c:\Users\Administrator\Desktop\telegram kripto oyunu

MANDATORY FIRST STEP: Read the authoritative user request at:
c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md
Specifically review section "## 2026-09-15T07:19:14Z" covering R1 (Mission Pool Assignment & Real-Time Action Progression) and R2 (Daily Streak Evaluation & Claim Endpoint).

Your Scope & Mission:
Investigate the existing codebase for how missions and daily streaks are implemented or structured:
1. Check `packages/game-core` for mission types, mission pools (easy, normal, hard, weekly), streak logic, SRU calculations, formula utilities.
2. Check `apps/api` for routes, services, handlers related to `/missions`, `/streak`, state initialization (`/auth/telegram`, `/me`, `/bootstrap` or game state), and economy endpoints (`POST /economy/claim`, `POST /economy/upgrade`).
3. Identify where action progression hooks must be placed for economy claim (`claim_cash_*`, `claim_offline_4h`) and economy upgrade (`upgrade_any_*`, `reach_milestone`, `upgrade_factory_tier`).
4. Check current database tables for missions, mission_instances, player_streaks, player_balances, season_scores.
5. Determine exact endpoint contracts for `POST /missions/:id/claim` and `POST /streak/claim` (and `/api/streak/claim`), including validation, idempotency, atomicity, error codes (e.g. 400 ALREADY_CLAIMED).
6. Note any boundary constraints: preserve existing game loop, do not modify UI in `apps/web/src/screens/`.

Write a comprehensive report to:
`c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_survey6_missions_rep\handoff.md`
Report your completion back via `send_message` with a summary and the path to your handoff file.
