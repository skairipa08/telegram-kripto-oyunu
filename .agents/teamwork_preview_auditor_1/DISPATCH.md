## 2026-09-16T06:39:19Z
You are teamwork_preview_auditor_1, the Forensic Integrity Auditor for Project Empire (Step 8 & Step 9).
Your working directory is c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_auditor_1.
The project root is c:\Users\Administrator\Desktop\telegram kripto oyunu.

READ THESE FIRST:
1. c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md
2. c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_orchestrator_7\SCOPE.md
3. c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_orchestrator_7\GATE_STATUS.md

AUDIT INSTRUCTIONS (ZERO TOLERANCE FOR CHEATING):
Conduct an exhaustive forensic integrity audit across all code modified or created for Step 8 and Step 9:
1. Audit Stream 1 (Shop & Payments):
   - Inspect apps/api/src/shop/ (routes.ts, store.ts, test files), packages/shared/src/index.ts, apps/api/src/auth/env.ts.
   - Verify authentic implementation: NO hardcoded return values, NO mock facades in production routes, genuine secret token validation, authentic pre-checkout query checks against purchases table, genuine atomic fulfillment with 64-char lowercase hex sha256 reward_ledger recording.
2. Audit Stream 2 (Shop & Stars UI):
   - Inspect apps/web/src/screens/shop-screen.tsx, apps/web/src/screens/shop-analytics.css, apps/web/src/game/live-game.tsx, apps/web/src/telegram/types.ts.
   - Verify genuine feature.stars_payments gating, authentic openInvoice call, authentic callback state handling, and authentic layout shift prevention.
3. Audit Stream 3 (Admin Backend & Governance):
   - Inspect apps/api/src/admin/, apps/api/src/config/, apps/api/src/fraud/, supabase/migrations/202609140011_admin_governance.sql.
   - Verify genuine RBAC enforcement (401 unauthenticated, 403 unauthorized, allow @Barandnz and @Mberked), genuine feature flag persistence and immutable audit logging in admin_audit_logs, genuine fraud accounts listing and unfreezing.
4. Audit Stream 4 (Admin UI Dashboard):
   - Inspect apps/web/src/screens/admin-screen.tsx, apps/web/src/admin/, apps/web/src/shell/.
   - Verify genuine admin gating (isDesignatedAdmin), genuine Feature Flags, Fraud Review, and Audit Log tabs, genuine API integration, and clean Astra 6.0 theme scoping.
5. Verify Full Monorepo Quality Gate:
   - Run pnpm check (or pnpm lint, pnpm format:check, pnpm -r typecheck, pnpm -r test, pnpm -r build).
6. Write your comprehensive forensic audit report to c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_auditor_1\handoff.md with a definitive binary verdict: CLEAN or INTEGRITY VIOLATION.
Send a message back to parent with your verdict and findings.

## 2026-09-16T11:59:37Z
You are teamwork_preview_auditor_1.
Your working directory is: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_auditor_1
Your identity: teamwork_preview_auditor_1
Authoritative User Request: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md (MUST read the entire file, especially the latest section dated 2026-09-16T11:18:25Z).
Master Project Architecture: c:\Users\Administrator\Desktop\telegram kripto oyunu\PROJECT.md
Worker 1 Handoff: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_stream1\handoff.md
Worker 2 Handoff: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_stream2\handoff.md
Remediation Worker Handoff: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_stream2_remediation\handoff.md
Challenger 1 Report: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_challenger_1\handoff.md
Challenger 2 Post-Fix Report: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_challenger_2_post_fix\handoff.md

OBJECTIVE:
Perform strict forensic integrity auditing of all code added or modified in Stream 1 and Stream 2 for Project Empire Arcade Suite Overhaul.
Your verdict is a NON-NEGOTIABLE BINARY VETO. If any cheating, hardcoded test results, facade implementations, mock bypasses, or integrity violations exist, you must return VERDICT: INTEGRITY VIOLATION. If all code is genuine, authentic, and compliant, return VERDICT: CLEAN.

SYSTEMATIC FORENSIC AUDIT CHECKS:
1. Static Analysis & Cheating Detection:
   - Scan all source files in packages/game-core/src/, packages/shared/src/, apps/api/src/arcade/, apps/web/src/components/, apps/web/src/game/, apps/web/src/screens/ for:
     - Hardcoded return values specifically tailored to test strings or test assertions.
     - Facade / stub / dummy classes or functions that do not execute real algorithms.
     - Mock short-circuits in production paths.
     - Fake telemetry or fake logs.
2. Runtime Verification & Mathematical Authenticity:
   - Verify notcoin-tap.ts: Does calculateEnergyState and calculateTapClick authentically compute energy depletion and power scaling? Does calculateTapBotEarnings genuinely clamp to available energy?
   - Verify catizen-merge.ts: Does solveAutoMergeBoard authentically find lowest pairs and merge iteratively? Are tier rates authentic and super-linear?
   - Verify crypto-crash.ts: Does generateCrashMultiplier authentically compute HMAC-SHA256 digests and Pareto distribution? Is the 97.00% RTP sink genuine?
   - Verify dynasty-cipher.ts: Does sequence generation and combo multiplication execute real logic?
3. Anti-P2W & Security Integrity:
   - Check Telegram Stars SKUs in minigames-config.ts: Verify seasonPointsMultiplier: 1.0 and bonusSeasonPoints: 0 permanently.
   - Check authentication in apps/api/src/arcade/routes.ts: Verify session authentication on all endpoints.
4. Independent Command Verification:
   - Run pnpm test (verify all tests pass cleanly).
   - Run pnpm -r typecheck (verify 0 type errors).
   - Run pnpm lint (verify 0 lint errors).
   - Run pnpm -r build (verify Wrangler and Vite builds succeed).

OUTPUT:
Write your audit report to:
c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_auditor_1\handoff.md
Include unambiguous verdict: VERDICT: CLEAN or VERDICT: INTEGRITY VIOLATION.
When done, send a message to orchestrator with verdict and handoff path.
