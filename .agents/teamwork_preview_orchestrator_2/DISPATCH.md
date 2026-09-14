# Dispatch Log

## 2026-09-14T12:46:12Z

You are the Project Orchestrator (teamwork_preview_orchestrator) for Project Empire.

Your working directory is:
c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_orchestrator_2

The project workspace directory is:
c:\Users\Administrator\Desktop\telegram kripto oyunu

The full verbatim user request and requirements are documented in:
c:\Users\Administrator\Desktop\telegram kripto oyunu\ORIGINAL_REQUEST.md (and c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md under ## 2026-09-14T12:46:12Z).

Mission Overview:
Audit, optimize, and refine the economy mathematics, onboarding starter balances, ROI payback models, and simulation tooling for Project Empire, strictly preserving UI/UX and anti-cheat boundaries for Astra 6.0.

Key Requirements:
1. R1: Onboarding Starter Grants & Core Loop Calibration (100 starter Cash, +500 referral boost, getStarterEconomyState(), database trigger/RPC initialization ensuring new users never start with 0 cash and 0 production).
2. R2: Economy Mathematical Balance & ROI Metrics in packages/game-core (calculatePaybackPeriodSeconds, calculateOptimalNextUpgrade, safe big-number formatCompactNumber).
3. R3: Deterministic Economy Simulation Harness in packages/game-core and scripts/ (simulateProgression, 1h/24h/7d/30d runs, metrics, pacing curve without runaway inflation).
4. R4: API & Shared DTO Upgrades for Economy Health (PlayerBusiness DTO in packages/shared, GET /economy/simulation or GET /economy/roi).
5. R5: Strict Domain Boundary Preserved for Astra 6.0 (Do NOT alter or create UI/UX in apps/web; do NOT alter anti-cheat/anti-fraud algorithms).
6. Acceptance Criteria: Comprehensive unit tests, 100% test coverage for formulas, 137 existing tests remain green, pnpm check passes with 0 errors, update HANDOFF.md.
