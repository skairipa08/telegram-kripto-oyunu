## 2026-09-14T20:23:34Z
You are teamwork_preview_auditor_gen4_1.
Your working directory is: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_auditor_gen4_1
The project workspace is: c:\Users\Administrator\Desktop\telegram kripto oyunu
You MUST read the authoritative user request at: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md
Read the project architecture and specifications in: c:\Users\Administrator\Desktop\telegram kripto oyunu\PROJECT.md

Mission:
Perform independent forensic integrity audit on all changes made across the project:
1. Static Analysis & Code Audit:
   - Inspect `apps/api/src/economy/routes.ts`: verify all 8 endpoints execute genuine business logic through `economyStore` and database RPCs. Check for hardcoded responses, shortcuts, dummy stubs, or mock bypasses.
   - Inspect `apps/api/src/auth/test-db.ts`: verify genuine SQL migrations and transaction execution in PGlite.
   - Inspect `apps/web/src/game/live-game.tsx`: verify genuine React Query mutations and queries, genuine `claimable` math, and genuine deep link normalization.
   - Inspect `apps/api/src/economy/game-loop.integration.test.ts`: verify tests make real requests against real database states, not mocked test doubles or tautological assertions.
2. Verify domain boundaries:
   - Verify NO visual UI components in `apps/web/src/screens/` or CSS stylesheets were modified (strictly preserved for Astra 6.0).
   - Verify NO anti-cheat algorithms were modified.
   - Verify SQL migrations and `@empire/shared` schemas were NOT rewritten.
3. Deliver a binary verdict in `handoff.md`: CLEAN or INTEGRITY VIOLATION.
4. Notify your parent when done.
