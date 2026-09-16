# DISPATCH

## 2026-09-14T19:38:00Z

You are the Project Orchestrator for Project Empire.
Your working directory is: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_orchestrator_4
The project workspace is: c:\Users\Administrator\Desktop\telegram kripto oyunu
The authoritative user request is in: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md

Mission:
Complete the missing game loop API endpoints for Project Empire — the Telegram idle business game — and wire them up to the newly created game screens in apps/web. The SQL migration and store layer are already written on disk; the team must implement the HTTP routes, update the local test database harness, write comprehensive integration tests, connect the frontend actions, and verify everything passes pnpm check.

Requirements to fulfill:
1. R1. Economy Game Loop Routes:
   Implement POST /economy/claim (offline earnings claim) and POST /economy/upgrade (business upgrade) in apps/api/src/economy/routes.ts.
   - Require authenticated session cookie.
   - Validate request bodies using existing Zod schemas from @empire/shared.
   - Call store methods (claimOfflineEarnings, upgradeBusiness).
   - Return properly typed HTTP responses with correct status codes (400 for INSUFFICIENT_CASH or BUSINESS_NOT_FOUND, 401 for unauthorized).

2. R2. Game State, Mission, Referral & Streak Routes:
   Create route modules and mount them in apps/api/src/index.ts under both / and /api prefixes:
   - GET /game/state — Full combined player economy, businesses, and season state.
   - GET /missions/active — Current active daily and weekly missions.
   - POST /missions/:id/claim — Claim a completed mission reward.
   - GET /streak — Current streak status and claimable flag.
   - POST /referral/bind — Bind a referral code and apply the +500 Cash bonus.
   - GET /referral/status — Current user's referral code, count, and tier badges.

3. R3. Test Database Harness Extension:
   Update apps/api/src/auth/test-db.ts:
   - Register migration 202609140007_game_loop_apis.sql.
   - Add RPC dispatch cases for all 8 new functions (empire_claim_offline_earnings, empire_upgrade_business, empire_get_game_state, empire_bind_referral, empire_get_referral_status, empire_get_active_missions, empire_claim_mission, empire_get_streak) via PGlite transactions.

4. R4. Frontend Live Game Connection:
   Update apps/web/src/game/live-game.tsx:
   - Pass onClaim and onUpgrade handlers to EmpireScreen to trigger POST /economy/claim and POST /economy/upgrade.
   - Wire MissionsScreen to GET /api/missions/active and POST /api/missions/:id/claim.
   - Wire FriendsScreen to GET /api/referral/status and POST /api/referral/bind.

5. R5. Workspace Integrity & Quality Gates:
   - Preserve all existing 232 passing unit and integration tests.
   - Add integration tests for all new endpoints.
   - Ensure pnpm check (lint, format:check, typecheck, test, build) exits with code 0.
   - Document all changes in HANDOFF.md.
