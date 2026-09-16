## 2026-09-14T20:13:08Z
You are teamwork_preview_worker_tests.
Your working directory is: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_tests
The project workspace is: c:\Users\Administrator\Desktop\telegram kripto oyunu
You MUST read the authoritative user request at: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md
Read the project architecture and specifications in: c:\Users\Administrator\Desktop\telegram kripto oyunu\PROJECT.md
Read the previous workers' handoff reports:
- c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_backend\handoff.md
- c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_frontend\handoff.md

FILE OWNERSHIP:
You EXCLUSIVELY own:
- apps/api/src/economy/game-loop.integration.test.ts (or additions to apps/api/src/economy/routes.test.ts)
- HANDOFF.md (at repo root)
Do NOT modify apps/web/src/screens or CSS or packages/shared or SQL migrations.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Mission:
Implement Milestone M5 (Integration Tests, Quality Gates & HANDOFF.md):
1. Integration Test Suite for All New Game Loop Endpoints:
   Write integration tests against the PGlite test harness (`createTestDatabase`) verifying:
   - `POST /economy/claim`: claims offline earnings, returns `ClaimCashResponse` with `claimedAmount`, `newBalance`, `claimedAt`, `isCapped`.
   - `POST /economy/upgrade`:
     - Successful upgrade upgrades business level and deducts cash.
     - Insufficient cash returns 400 with `{ error: { code: 'INSUFFICIENT_CASH' } }`.
     - Invalid business slug returns 400 with `{ error: { code: 'BUSINESS_NOT_FOUND' } }`.
   - `GET /game/state`: returns full player economy state, businesses, active season info.
   - `GET /missions/active`: returns today's active mission instances.
   - `POST /missions/:id/claim`: claims a completed mission reward and awards season points.
   - `GET /streak`: returns streak data with `canClaimToday` flag and `currentStreak`.
   - `POST /referral/bind`:
     - Valid referral code binds referrer, awards +500 Cash bonus.
     - Self-referral returns 400 error.
   - `GET /referral/status`: returns referral link, invite counts, and badges.
   - Unauthenticated 401 verification: all endpoints return 401 when called without session cookie.
   - Dual-prefix verification: endpoints work under both `/` and `/api`.
2. Quality Gates:
   - Execute `pnpm test` (verify all existing 232 tests pass + new integration tests pass).
   - Execute `pnpm check` (which runs `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build`). If prettier formatting needs adjusting on your test file or HANDOFF.md, ensure it is formatted cleanly.
   - Ensure `pnpm check` exits with code 0!
3. Documentation:
   - Document all changes across R1, R2, R3, R4, R5 in `HANDOFF.md` at project root.
4. Report:
   - Write your complete handoff in `handoff.md` in your working directory and notify parent.
