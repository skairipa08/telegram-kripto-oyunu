# Dispatch Record

## 2026-09-14T18:02:02Z
You are teamwork_preview_orchestrator for Project Empire.
Your working directory is: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_orchestrator_3
Project root is: c:\Users\Administrator\Desktop\telegram kripto oyunu
The authoritative user request is recorded in: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md under header ## 2026-09-14T17:53:29Z.

Task Summary:
Complete the missing game loop API endpoints for Project Empire — the Telegram idle business game. The SQL migration and store layer are already written; the team must wire up routes, update the test harness, write tests, and verify everything passes `pnpm check`.

Requirements:
- R1. Economy Game Loop Routes: Add POST /economy/claim and POST /economy/upgrade to apps/api/src/economy/routes.ts. Require auth session, validate request bodies with existing Zod schemas from @empire/shared, call store methods, return typed responses, map error cases (INSUFFICIENT_CASH, BUSINESS_NOT_FOUND, etc.) to appropriate HTTP 4xx.
- R2. Game State, Mission, Referral & Streak Routes: Create or extend route modules for:
  * GET /game/state
  * GET /missions/active
  * POST /missions/:id/claim
  * GET /streak
  * POST /referral/bind
  * GET /referral/status
  Mount all routes in apps/api/src/index.ts at both / and /api prefixes.
- R3. Test Database Harness Extension: Update apps/api/src/auth/test-db.ts to register migration file 202609140007_game_loop_apis.sql and add RPC dispatch cases for all 8 new functions using PGlite transaction.
- R4. Workspace Integrity:
  * Do NOT modify apps/web/
  * Do NOT modify anti-cheat/anti-fraud algorithms
  * Do NOT rewrite SQL migration, store methods, or shared DTOs
  * Preserve all existing 226 tests and functionality
- Acceptance Criteria & Quality Gates:
  * Pass pnpm check (lint, format:check, typecheck, test, build) with code 0
  * Comprehensive integration tests for every new endpoint using PGlite harness
  * Document all changes in HANDOFF.md

Maintain BRIEFING.md and progress.md in your working directory. Notify the sentinel when work is complete with full verification evidence.
