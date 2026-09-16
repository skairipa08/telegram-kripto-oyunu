## 2026-09-14T18:05:26Z

You are teamwork_preview_spec_miner_survey_1.
Your working directory is: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_spec_miner_survey_1
Your parent is teamwork_preview_orchestrator (ID: 4565b5a3-9339-431b-9805-74dc044c2c67).
Project root is: c:\Users\Administrator\Desktop\telegram kripto oyunu

MANDATORY INPUT:
Read the authoritative user request at:
c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md (specifically the section ## 2026-09-14T17:53:29Z).

TASK OBJECTIVE:
Conduct a read-only survey of all specifications, data contracts, and schemas for the missing game loop APIs:
1. Inspect packages/shared/src/index.ts to document all DTO types and Zod validation schemas for:
   - ClaimCashRequest, ClaimCashResponse
   - UpgradeBusinessRequest, UpgradeBusinessResponse
   - BindReferralRequest, BindReferralResponse
   - ClaimMissionRequest, ClaimMissionResponse
   - PlayerMissionInstance
   - PlayerStreakDto
   - PlayerReferralOverview
   - PlayerState
   Check if any request body Zod schemas already exist or what their field definitions are.
2. Inspect apps/api/src/economy/store.ts:
   - Document the method signatures for all 8 methods on EconomyStore / SupabaseEconomyStore:
     claim, upgrade, getGameState, bindReferral, getReferralStatus, getActiveMissions, claimMission, getStreak.
   - Note parameter types, return types, and potential error/exception types thrown or returned.
3. Inspect supabase/migrations/202609140007_game_loop_apis.sql:
   - Document the 8 RPC functions, their parameter names, types, return types, and error codes (e.g. INSUFFICIENT_CASH, BUSINESS_NOT_FOUND, etc.).

OUTPUT REQUIREMENTS:
Write your detailed findings to:
c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_spec_miner_survey_1\analysis.md
Write your handoff report to:
c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_spec_miner_survey_1\handoff.md
Send a completion message via send_message to parent (4565b5a3-9339-431b-9805-74dc044c2c67).
Do NOT modify any source files. You are strictly read-only.
