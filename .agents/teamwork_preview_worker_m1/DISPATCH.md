## 2026-09-15T06:25:15Z

You are Worker M1 for Project Empire.
Your working directory: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_m1
Project Root: c:\Users\Administrator\Desktop\telegram kripto oyunu
Original Request: c:\Users\Administrator\Desktop\telegram kripto oyunu\ORIGINAL_REQUEST.md
Architecture & Scope: c:\Users\Administrator\Desktop\telegram kripto oyunu\PROJECT.md
Survey & Specs: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_survey_core\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

STRICT BOUNDARIES & WRITE OWNERSHIP:
- You exclusively own and may modify ONLY:
  - `packages/game-core/src/fraud.ts` (create)
  - `packages/game-core/src/fraud.test.ts` (create)
  - `packages/game-core/src/index.ts` (append `export * from './fraud';`)
- Strictly DO NOT TOUCH:
  - `supabase/migrations/202609140007_game_loop_apis.sql`
  - `apps/api/src/auth/test-db.ts`
  - `apps/api/src/economy/**`
  - `apps/web/src/game/**`
  - `apps/web/src/screens/**`, CSS
  - `apps/api/src/shop/**`

TASK (Requirement R1):
1. Implement `packages/game-core/src/fraud.ts`:
   - Follow all mathematical formulas, constants (`FRAUD_REASON_CODES`), types, and algorithms documented in `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_survey_core\handoff.md`:
     - `evaluateEconomyVelocity`: checks claimed cash/season points vs max production ceiling and offline caps; detects negative elapsed time.
     - `evaluateBurstAndReplay`: detects duplicate requestId, sub-debounce intervals (<200ms), rapid burst (>15/5s), sustained rate (>60/60s).
     - `evaluateDeviceAndIpClustering`: detects multi-account density anomalies per IP and device fingerprint.
     - `evaluateReferralGraphAndAbuse`: traces parent-chain graph for cycle detection (self-referral, 2-hop reciprocal, multi-hop circular rings), device/IP collusion, and burst farming.
     - `calculateCompositeRiskScore`: 0–100 normalized score, 4 tiers (LOW, MEDIUM, HIGH, CRITICAL), critical floor overrides (replay=100, cycle=100, self-referral=100, vel>=95=95, dev collusion=90), explainable reason items with severity and score contributions.
   - Strictly satisfy TypeScript options: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `verbatimModuleSyntax: true`.
2. Register export in `packages/game-core/src/index.ts`:
   - Add `export * from './fraud';`.
3. Create comprehensive unit tests in `packages/game-core/src/fraud.test.ts`:
   - Test all 4 core signals in isolation with standard and boundary cases.
   - Test cycle detection (1-hop self-referral, 2-hop reciprocal, 3-hop and 5-hop circular rings, acyclic tree).
   - Test economy velocity (normal claim, cap exceeded, 0 production with cash claim, negative elapsed time, season points excess).
   - Test burst & replay (duplicate requestId, rapid sub-debounce, sliding window counts).
   - Test device/IP clustering (below thresholds, warn, critical).
   - Test composite scoring, critical floor overrides, tier categorization, and explainable reason details.
4. Run verification commands:
   - `pnpm --filter @empire/game-core typecheck`
   - `pnpm test packages/game-core`
   - Ensure all 136 existing tests continue to pass and new fraud tests pass 100%.

Deliver a structured handoff report in `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_m1\handoff.md` detailing all changes made and test execution outputs. When finished, send a message to orchestrator parent.
