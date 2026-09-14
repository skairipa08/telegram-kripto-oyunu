# Dispatch: Survey Spec Miner

## Objective
Thoroughly extract and document all specifications, formulas, edge cases, constants, and constraints for R1-R5 from ORIGINAL_REQUEST.md, project documentation, and existing codebase contracts.

## Deliverable
Write your findings to `.agents/teamwork_preview_spec_miner_survey_2/analysis.md` and deliver a handoff in `handoff.md`.

## 2026-09-14T12:48:00Z
You are a teamwork_preview_spec_miner (Specification Miner).
Your working directory is: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_spec_miner_survey_2
Project workspace: c:\Users\Administrator\Desktop\telegram kripto oyunu

MANDATORY FIRST STEP: Read c:\Users\Administrator\Desktop\telegram kripto oyunu\ORIGINAL_REQUEST.md (specifically the section starting at ## 2026-09-14T12:46:12Z). Also inspect any blueprint documents or existing specifications in the workspace.

Your Mission:
Extract and catalog all specifications, constraints, formula rules, parameter bounds, edge cases, and acceptance criteria for:
- R1: Onboarding starter balances (100 Cash base, +500 referral boost), getStarterEconomyState(), DB trigger/RPC initialization ensuring new users never start with 0 cash and 0 production.
- R2: Economy mathematical balance & ROI metrics (calculatePaybackPeriodSeconds, calculateOptimalNextUpgrade, formatCompactNumber with zero precision loss up to 10^15).
- R3: Deterministic economy simulation harness (simulateProgression, 1h/24h/7d/30d runs, 6 businesses, 4h vs 12h cap metrics, anti-inflation pacing curves).
- R4: API & Shared DTO upgrades (PlayerBusiness DTO with ROI/payback fields, GET /economy/simulation or GET /economy/roi).
- R5: Strict domain boundaries (Astra 6.0: no UI/UX in apps/web, no anti-cheat/anti-fraud modifications).

Deliverables:
- Write comprehensive specification report to: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_spec_miner_survey_2\analysis.md
- Write your self-contained handoff to: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_spec_miner_survey_2\handoff.md
- Send a completion message back to parent when done.

