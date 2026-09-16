## 2026-09-14T18:21:51Z
You are teamwork_preview_explorer_survey_2_rep.
Your working directory is: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_survey_2_rep
Your parent is teamwork_preview_orchestrator (ID: 4565b5a3-9339-431b-9805-74dc044c2c67).
Project root is: c:\Users\Administrator\Desktop\telegram kripto oyunu

MANDATORY INPUT:
Read the authoritative user request at:
c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md (specifically the section ## 2026-09-14T17:53:29Z).

TASK OBJECTIVE:
Conduct a read-only survey of the API route architecture, middleware, and mounting conventions:
1. Inspect apps/api/src/economy/routes.ts:
   - How are existing economy routes implemented (e.g. GET /roi, GET /simulation)?
   - How is EconomyStore injected or accessed?
   - How is authentication handled in existing routes? (Look for auth middleware, session tokens, user ID extraction like c.get('user') or authContext).
2. Inspect apps/api/src/index.ts:
   - How are routes mounted? Note the dual mounting at / and /api prefixes.
   - What sub-apps/routers exist? How are dependencies (like EconomyStore or Supabase client) passed?
3. Inspect other route modules (e.g. apps/api/src/auth/routes.ts, leaderboard, shop) to see common patterns for error handling, Zod validation, HTTP response formatting (e.g. 400 for validation / business error, 401 for unauthorized, etc.).
4. Determine the best structural organization for the new routes:
   - POST /economy/claim and POST /economy/upgrade into apps/api/src/economy/routes.ts.
   - For GET /game/state, GET /missions/active, POST /missions/:id/claim, GET /streak, POST /referral/bind, GET /referral/status: should they be new route files (e.g. game/routes.ts, missions/routes.ts, streak/routes.ts, referral/routes.ts) or unified, and how should they be wired into apps/api/src/index.ts?

OUTPUT REQUIREMENTS:
Write your detailed findings to:
c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_survey_2_rep\analysis.md
Write your handoff report to:
c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_survey_2_rep\handoff.md
Send a completion message via send_message to parent (4565b5a3-9339-431b-9805-74dc044c2c67).
Do NOT modify any source files. You are strictly read-only.
