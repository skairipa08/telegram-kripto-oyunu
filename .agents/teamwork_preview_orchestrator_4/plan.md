# Concrete Execution Plan: Project Empire — Game Loop APIs & Frontend Wiring

## Objective
Implement missing game loop API endpoints, extend the local test database harness, connect frontend actions in live-game.tsx, add comprehensive integration tests, and ensure pnpm check passes with 0 errors.

## Steps
1. **Phase 0: Survey (3 Explorers / Spec Miners)**
   - Explorer 1: Inspect supabase/migrations/202609140007_game_loop_apis.sql, pps/api/src/economy/store.ts, pps/api/src/economy/routes.ts, and shared DTOs.
   - Explorer 2: Inspect pps/api/src/auth/test-db.ts, PGlite transaction RPC dispatch patterns, and existing route test suites.
   - Explorer 3: Inspect pps/web/src/game/live-game.tsx and the screen components (EmpireScreen, MissionsScreen, FriendsScreen) to understand existing props, state management, and fetch calls.

2. **Phase 1: Architecture & PROJECT.md**
   - Synthesize explorer findings.
   - Construct PROJECT.md with explicit feature inventory, milestone definitions, interface contracts, and code layout boundaries.

3. **Phase 2: Dual-Track Implementation & E2E Testing**
   - Milestone 1: Test DB Harness Extension (pps/api/src/auth/test-db.ts) - register migration 0007 and RPC dispatch for all 8 functions.
   - Milestone 2: Economy Game Loop Routes (pps/api/src/economy/routes.ts) - POST /economy/claim, POST /economy/upgrade.
   - Milestone 3: Game State, Missions, Referral & Streak Routes (pps/api/src/game/, pps/api/src/missions/, pps/api/src/referral/, pps/api/src/streak/, and mount in pps/api/src/index.ts).
   - Milestone 4: Frontend Live Game Connection (pps/web/src/game/live-game.tsx) - wire handlers and screens.
   - Milestone 5: E2E Integration Tests across all new endpoints (pps/api/src/.../*.test.ts).

4. **Phase 3: Verification & Quality Gate**
   - Worker runs pnpm check (lint, format:check, typecheck, test, build).
   - Reviewers (x2) independently review code correctness and contract compliance.
   - Challengers (x2) independently verify edge cases and stress conditions.
   - Forensic Auditor audits code integrity (zero hardcoded mock returns, genuine logic, strict compliance).

5. **Phase 4: Synthesis & Final Handoff**
   - Update HANDOFF.md with all changes, commands, and verification proof.
   - Report back to parent orchestrator.
