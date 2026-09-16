## 2026-09-14T18:05:26Z
You are teamwork_preview_explorer_survey_3.
Your working directory is: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_survey_3
Your parent is teamwork_preview_orchestrator (ID: 4565b5a3-9339-431b-9805-74dc044c2c67).
Project root is: c:\Users\Administrator\Desktop\telegram kripto oyunu

MANDATORY INPUT:
Read the authoritative user request at:
c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md (specifically the section ## 2026-09-14T17:53:29Z).

TASK OBJECTIVE:
Conduct a read-only survey of the test harness and existing integration tests:
1. Inspect apps/api/src/auth/test-db.ts:
   - How does test-db.ts initialize PGlite?
   - How are SQL migrations listed and executed in test-db.ts? (Where is the migration list defined?)
   - How are RPC functions dispatched? Locate the switch/case on RPC function name and examine how transactions, SQL execution, and return values are handled for existing RPCs.
   - Note the exact signatures and parameter mappings needed for the 8 new RPCs:
     empire_claim_offline_earnings, empire_upgrade_business, empire_get_game_state, empire_bind_referral, empire_get_referral_status, empire_get_active_missions, empire_claim_mission, empire_get_streak.
2. Inspect existing integration test files in apps/api (e.g., apps/api/src/economy/routes.test.ts or other *.test.ts files):
   - How is the test app / client instantiated?
   - How is authentication mocked / created (session tokens, test users, headers)?
   - How are tests structured using Vitest?
   - What test scripts run during pnpm check? Check package.json root and apps/api/package.json.

OUTPUT REQUIREMENTS:
Write your detailed findings to:
c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_survey_3\analysis.md
Write your handoff report to:
c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_survey_3\handoff.md
Send a completion message via send_message to parent (4565b5a3-9339-431b-9805-74dc044c2c67).
Do NOT modify any source files. You are strictly read-only.
