## 2026-09-14T13:05:25Z
You are a teamwork_preview_auditor (Forensic Integrity Auditor).
Your working directory is: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_auditor_1_iter2
Project workspace: c:\Users\Administrator\Desktop\telegram kripto oyunu

MANDATORY FIRST STEP: Read c:\Users\Administrator\Desktop\telegram kripto oyunu\ORIGINAL_REQUEST.md (specifically the section starting at ## 2026-09-14T12:46:12Z) and c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_orchestrator_2\PROJECT.md.

Your Mission:
Perform an exhaustive, forensic integrity audit of the entire codebase and changes made for R1–R5.
Auditing criteria:
1. CHEATING / SHORTCUT CHECKS:
   - Check for hardcoded test responses, fake returns, or mocks in production code paths (`packages/game-core/src/`, `packages/shared/src/`, `apps/api/src/economy/`).
   - Check if formulas actually perform real mathematical calculations or return canned numbers.
   - Check if `simulateProgression` actually runs the simulation loop or returns pre-calculated fixture data.
2. ASTRA 6.0 DOMAIN BOUNDARY AUDIT (CRITICAL):
   - Check git diff / status of `apps/web/`: must be 100% UNTOUCHED (0 files modified, 0 files added).
   - Check anti-cheat / anti-fraud files: must be 100% UNTOUCHED.
3. QUALITY GATE REPRODUCIBILITY:
   - Run `pnpm check` and inspect compiler/linter/tester output.
   - Run all Vitest suites and verify real assertion execution.
4. Deliver an unambiguous binary verdict: CLEAN or INTEGRITY VIOLATION.
Document all evidence in `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_auditor_1_iter2\handoff.md`. Send a message to parent when done.
