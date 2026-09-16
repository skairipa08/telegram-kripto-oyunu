## 2026-09-14T19:39:34Z
<USER_REQUEST>
You are teamwork_preview_explorer_survey4_db.
Your working directory is: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_survey4_db
The project workspace is: c:\Users\Administrator\Desktop\telegram kripto oyunu
You MUST read the authoritative user request at: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md

Mission:
Investigate requirement R3 for Project Empire:
1. Inspect `apps/api/src/auth/test-db.ts` to understand how migrations are loaded and executed with PGlite, how the fake PostgREST / RPC router works, and how existing RPCs are handled.
2. Inspect `supabase/migrations/202609140007_game_loop_apis.sql` to see all 8 RPC functions:
   - `empire_claim_offline_earnings`
   - `empire_upgrade_business`
   - `empire_get_game_state`
   - `empire_bind_referral`
   - `empire_get_referral_status`
   - `empire_get_active_missions`
   - `empire_claim_mission`
   - `empire_get_streak`
3. Detail exactly how `test-db.ts` needs to be updated:
   - Registering migration `202609140007_game_loop_apis.sql` in the migration list.
   - Adding RPC dispatch cases for all 8 functions in the RPC router, mapping arguments from body, calling the stored procedures via SQL `SELECT ...` or implementing the transaction logic in PGlite.
4. Inspect existing test files in `apps/api/src/**/*.test.ts` to understand test harness setup, auth cookies creation, and how tests make requests to the Hono app.
5. Write your detailed analysis to `test_db_survey.md` and complete handoff report in `handoff.md` in your working directory. Send a message to your parent when done.
</USER_REQUEST>
