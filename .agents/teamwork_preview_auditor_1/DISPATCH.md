# Dispatch for teamwork_preview_auditor_1

You are teamwork_preview_auditor_1.
Your working directory is: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_auditor_1
Parent Orchestrator: teamwork_preview_orchestrator_1

Read c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md.
Read c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_orchestrator_1\PROJECT.md.
Read worker handoff at: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_m1\handoff.md.

Task:
Perform a thorough Forensic Integrity Audit:
1. Static analysis and inspection of all newly added code:
   - packages/game-core/src/leaderboard.ts
   - packages/game-core/src/monetization.ts
   - packages/game-core/src/remote-config.ts
   - packages/game-core/src/analytics.ts
   - packages/shared/src/index.ts
   - supabase/migrations/202609140005_step7_to_11_backend.sql
   - apps/api/src/leaderboard/
   - apps/api/src/shop/
   - apps/api/src/config/
   - apps/api/src/analytics/
2. Check for Integrity Violations:
   - ZERO TOLERANCE: Are there any hardcoded test results, expected outputs, or verification strings?
   - Dummy or facade implementations that return pre-calculated responses without actual logic?
   - Circumvention of intended logic?
   - Fabricated logs or fake verification outputs?
3. Check Boundary Isolation (R5):
   - Are there ANY modifications to apps/web UI/UX components or CSS? (Must be strictly NO)
   - Are there ANY modifications to anti-cheat / anti-fraud algorithms? (Must be strictly NO)
4. Anti-P2W Verification:
   - Does Stars monetization strictly prohibit purchasing Season Points or competitive boosts?
5. Run build and tests to verify everything executes cleanly.

Produce audit_report.md and handoff.md with a binary verdict: CLEAN or INTEGRITY VIOLATION.
Send a message back to parent when done.

## 2026-09-14T12:21:42Z
You are teamwork_preview_auditor_1.
Your working directory is: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_auditor_1
Read instructions in c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_auditor_1\DISPATCH.md.
MANDATORY: Read c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md.
Read c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_orchestrator_1\PROJECT.md.
Read worker handoff at c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_m1\handoff.md.
Perform a forensic integrity audit: verify genuine implementation, no dummy facades, no hardcoded results, strict R5 boundary compliance (no UI/CSS, no anti-fraud mods), and anti-P2W enforcement.
Write audit_report.md and handoff.md with verdict: CLEAN or INTEGRITY VIOLATION. Send message to parent when done.
