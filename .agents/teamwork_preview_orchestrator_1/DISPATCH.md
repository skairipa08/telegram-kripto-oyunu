# Dispatch Log

## 2026-09-14T12:04:28Z

Implement the backend, data engineering, and game logic modules for Project Empire (Steps 7, 8, 9, and 11) within the existing monorepo, while strictly keeping all UI design and anti-fraud/exploit security isolated for Astra 6.0.
Integrity mode: demo

Requirements:
- R1. Leaderboards Engine & Season Freeze (Blueprint R6):
  - Support high-volume ranking queries with deterministic tie-breaking and rank pagination.
  - Provide user rank pinning (retrieving the current player's exact rank and score).
  - Implement season freeze and score archiving routines when a season ends.
- R2. Stars Monetization & Pass Entitlement Backend (Blueprint R7):
  - Define invoice creation and idempotent payment fulfillment contracts (ensuring a transaction cannot be double-fulfilled).
  - Manage Convenience Pass entitlement state (expanding offline cap from 4h to 12h, upgrade queue slots).
  - Strictly enforce zero Season Points multipliers and zero competitive advantages for money (anti-P2W guardrail).
- R3. Admin Remote Config & Feature Flags (Blueprint R8):
  - Remote config loader for economy constants (costs, production rates, SRU baseline, referral thresholds).
  - Feature flag engine to toggle experimental features (e.g., token module OFF by default).
  - Audit logging schema for recording configuration changes.
- R4. Analytics Event Pipeline & Cohort Models (Blueprint R10):
  - Structured event taxonomy adhering to Blueprint Section 18 (app_open, cash_claim, business_upgrade, mission_claim, referral_bound, etc.).
  - Calculation models for activation, D1/D2/D7 retention cohorts, and payment conversion.
- R5. Strict Domain Boundary:
  - Do NOT create or modify UI/UX visual components or CSS styles (reserved for Astra 6.0).
  - Do NOT alter anti-cheat/anti-fraud algorithms, exploit testing, or external auth penetration hardening (reserved for Astra 6.0).
  - Implement only pure formulas in packages/game-core, DTO schemas in packages/shared, SQL migrations in supabase/migrations/, and backend routes in apps/api.
