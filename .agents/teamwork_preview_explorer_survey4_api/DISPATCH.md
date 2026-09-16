## 2026-09-14T19:39:34Z
You are teamwork_preview_explorer_survey4_api.
Your working directory is: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_survey4_api
The project workspace is: c:\Users\Administrator\Desktop\telegram kripto oyunu
You MUST read the authoritative user request at: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md

Mission:
Investigate requirements R1 and R2 for Project Empire:
1. Inspect `supabase/migrations/202609140007_game_loop_apis.sql` and `apps/api/src/economy/store.ts` to see the existing EconomyStore interface and all 8 methods (`claimOfflineEarnings`, `upgradeBusiness`, `getGameState`, `bindReferral`, `getReferralStatus`, `getActiveMissions`, `claimMission`, `getStreak`).
2. Inspect `packages/shared/src/index.ts` to see all existing Zod schemas and DTOs (`ClaimCashRequest/Response`, `UpgradeBusinessRequest/Response`, `BindReferralRequest/Response`, `ClaimMissionRequest/Response`, etc.).
3. Inspect `apps/api/src/economy/routes.ts`, `apps/api/src/auth/routes.ts`, and `apps/api/src/index.ts` to see how auth sessions are extracted/validated (cookie handling, user id extraction), how route groups are mounted, and error handling patterns.
4. Detail exactly how:
   - `POST /economy/claim` and `POST /economy/upgrade` should be implemented in `apps/api/src/economy/routes.ts` (with status codes 400 for INSUFFICIENT_CASH or BUSINESS_NOT_FOUND, 401 for unauthorized).
   - `GET /game/state`, `GET /missions/active`, `POST /missions/:id/claim`, `GET /streak`, `POST /referral/bind`, `GET /referral/status` should be structured into route modules and mounted in `apps/api/src/index.ts` at both `/` and `/api` prefixes.
5. Write your detailed analysis to `apps_api_survey.md` and complete handoff report in `handoff.md` in your working directory. Send a message to your parent when done.
