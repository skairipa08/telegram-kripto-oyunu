## 2026-09-14T12:53:09Z
You are a teamwork_preview_worker (Backend Domain Worker).
Your working directory is: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_2
Project workspace: c:\Users\Administrator\Desktop\telegram kripto oyunu

MANDATORY FIRST STEP: Read the following authoritative documents before starting work:
1. c:\Users\Administrator\Desktop\telegram kripto oyunu\ORIGINAL_REQUEST.md (specifically the section starting at ## 2026-09-14T12:46:12Z).
2. c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_orchestrator_2\PROJECT.md.
3. The survey reports:
   - c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_spec_miner_survey_2\analysis.md
   - c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_codebase_2\analysis.md
   - c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_math_2\analysis.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Assigned Scope & Exclusive Write Ownership:
1. R1: Onboarding Starter Grants & Core Loop Calibration:
   - Implement `getStarterEconomyState(isReferred?: boolean)` in `packages/game-core/src/starter.ts` (100 starter Cash, +500 referral boost, 6 businesses initialized at level 0).
   - Create migration `supabase/migrations/202609140006_economy_starter_and_roi.sql` establishing database triggers/RPC on user creation to ensure new users are never initialized with 0 cash and 0 production.
   - Update `apps/api/src/auth/test-db.ts` to register migration `202609140006` in PGlite.
2. R2: Economy Mathematical Balance & ROI Metrics:
   - Implement `calculatePaybackPeriodSeconds(upgradeCost, currentProduction, nextProduction)` in `packages/game-core/src/formulas.ts`.
   - Implement `calculateOptimalNextUpgrade(businesses, playerCash)` in `packages/game-core/src/formulas.ts`.
   - Implement `formatCompactNumber(value)` handling safe numbers and bigints up to and beyond 10^15 (quadrillions: K, M, B, T, Q) with zero precision loss.
   - Export all new functions through `packages/game-core/src/index.ts`.
3. R3: Deterministic Economy Simulation Harness:
   - Implement `simulateProgression(durationSeconds, config)` in `packages/game-core/src/simulation.ts`. Support 1h, 24h, 7d, and 30d headless simulation runs with deterministic outputs.
   - Model metrics: total Cash generated, levels achieved per business, time-to-unlock for all 6 businesses, Convenience Pass impact (4h vs 12h offline cap).
   - Create executable CLI script `scripts/simulate-economy.ts`.
4. R4: API & Shared DTO Upgrades:
   - Expand `playerBusinessSchema` in `packages/shared/src/index.ts` to include `paybackPeriodSeconds`, `marginalRoi`, `nextProductionPerSecond`.
   - Add DTO schemas for `/economy/roi` and `/economy/simulation`.
   - Implement API routes `GET /economy/roi` and `GET /economy/simulation` in `apps/api/src/economy/`. Mount in `apps/api/src/index.ts`.
5. R5: Strict Domain Boundary Preservation (Astra 6.0):
   - DO NOT alter or create any files in `apps/web/` (strictly preserved for Astra 6.0).
   - DO NOT alter anti-cheat or anti-fraud algorithms (strictly preserved for Astra 6.0).
6. Comprehensive Tests & Verification:
   - Add unit tests in `packages/game-core` covering 100% of the new formulas and all 6 business tiers.
   - Add tests for deterministic simulations (1h, 24h, 7d, 30d).
   - Add tests for database starter cash trigger and `/economy` API routes.
   - Verify that all existing 137 tests remain green.
   - Run `pnpm check` and ensure exit code 0.
   - Update `HANDOFF.md` at project root with step-by-step documentation of all changes.
