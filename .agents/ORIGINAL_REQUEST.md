# Original User Request

## 2026-09-14T12:03:51Z

Implement the backend, data engineering, and game logic modules for Project Empire (Steps 7, 8, 9, and 11) within the existing monorepo, while strictly keeping all UI design and anti-fraud/exploit security isolated for Astra 6.0.

Working directory: c:\Users\Administrator\Desktop\telegram kripto oyunu
Integrity mode: demo

## Requirements

### R1. Leaderboards Engine & Season Freeze (Blueprint R6)
Implement the data models, indexing, and logic for global and friend leaderboards.
- Support high-volume ranking queries with deterministic tie-breaking and rank pagination.
- Provide user rank pinning (retrieving the current player's exact rank and score).
- Implement season freeze and score archiving routines when a season ends.

### R2. Stars Monetization & Pass Entitlement Backend (Blueprint R7)
Implement the business logic and transaction contracts for Telegram Stars and Convenience Pass.
- Define invoice creation and idempotent payment fulfillment contracts (ensuring a transaction cannot be double-fulfilled).
- Manage Convenience Pass entitlement state (expanding offline cap from 4h to 12h, upgrade queue slots).
- Strictly enforce zero Season Points multipliers and zero competitive advantages for money (anti-P2W guardrail).

### R3. Admin Remote Config & Feature Flags (Blueprint R8)
Implement dynamic configuration and feature flag mechanisms that do not require redeploying code.
- Remote config loader for economy constants (costs, production rates, SRU baseline, referral thresholds).
- Feature flag engine to toggle experimental features (e.g., token module OFF by default).
- Audit logging schema for recording configuration changes.

### R4. Analytics Event Pipeline & Cohort Models (Blueprint R10)
Implement the data models and tracking abstractions for player analytics.
- Structured event taxonomy adhering to Blueprint Section 18 (app_open, cash_claim, business_upgrade, mission_claim, referral_bound, etc.).
- Calculation models for activation, D1/D2/D7 retention cohorts, and payment conversion.

### R5. Strict Domain Boundary (No UI, No Anti-Cheat/Exploit Modifications)
- Do NOT create or modify UI/UX visual components or CSS styles (reserved for Astra 6.0).
- Do NOT alter anti-cheat/anti-fraud algorithms, exploit testing, or external auth penetration hardening (reserved for Astra 6.0).
- Implement only pure formulas in packages/game-core, DTO schemas in packages/shared, SQL migrations in supabase/migrations/, and backend routes in apps/api.

## Acceptance Criteria

### Leaderboard Verification
- [ ] Database migration includes optimized composite indexes on season_scores(season_id, points desc).
- [ ] Pure sorting, ranking, and pagination functions in packages/game-core or API handle ties and edge cases with 100% test coverage.
- [ ] Season freeze and archival functions correctly preserve past season final ranks.

### Monetization & Entitlement Verification
- [ ] Payment fulfillment functions enforce idempotency (duplicate fulfillment attempts are rejected).
- [ ] Convenience Pass entitlement calculation correctly applies 12h (43,200s) offline cap without altering base production or SRU multipliers.
- [ ] Contract tests verify that Stars cannot purchase Season Points or competitive rank boosts.

### Remote Config & Feature Flags Verification
- [ ] Remote config getters fall back safely to defaults if database overrides are absent.
- [ ] Feature flag evaluator defaults feature.token to false and requires explicit enablement.
- [ ] All configuration mutations produce an audit trail entry.

### Analytics Pipeline Verification
- [ ] Event schemas validate against all event names defined in Blueprint Section 18.
- [ ] Retention calculation functions correctly identify D1, D2, and D7 qualifying players from session logs.

### Workspace Integrity & Quality Gates
- [ ] pnpm check (ESLint, Prettier, TypeScript across all packages, Vitest test suite, Vite build, and Wrangler dry-run) executes with exit code 0.
- [ ] All new logic and formulas have comprehensive automated tests.
- [ ] All changes are documented in HANDOFF.md with step-by-step progress.

## 2026-09-14T12:46:12Z

Audit, optimize, and refine the economy mathematics, onboarding starter balances, ROI payback models, and simulation tooling for Project Empire, strictly preserving UI/UX and anti-cheat boundaries for Astra 6.0.

Working directory: c:\Users\Administrator\Desktop\telegram kripto oyunu
Integrity mode: demo

## Requirements

### R1. Onboarding Starter Grants & Core Loop Calibration
Calibrate the initial player onboarding balance and unlock flow so that a new user never gets stuck:
- Provide a default starter balance (100 Cash) on first player creation so the player can immediately unlock Street Stand (Level 1, 1 Cash/s) and activate their core idle loop within 30 seconds.
- Support additive starter referral boost (+500 Cash) if the player bound a referral link.
- Expose a pure getStarterEconomyState() function and database trigger/RPC initialization ensuring new users are never initialized with 0 cash and 0 production.

### R2. Economy Mathematical Balance & ROI Metrics
Implement pure financial and progression analytics in packages/game-core:
- calculatePaybackPeriodSeconds(upgradeCost, currentProduction, nextProduction): Deterministic calculation of break-even time (ROI) in seconds for any business upgrade.
- calculateOptimalNextUpgrade(businesses, playerCash): Pure recommendation function identifying the business upgrade that yields the shortest payback period or highest marginal ROI.
- Safe big-number formatting helper: formatCompactNumber(value) (1.2K, 3.5M, 12.8B, 4.5T) ensuring zero precision loss and protection against numeric overflows.

### R3. Deterministic Economy Simulation Harness
Create an offline economy simulation runner in packages/game-core (and scripts/):
- Pure simulation function simulateProgression(strategy, durationSeconds, config) that models player growth over 1 hour, 24 hours, 7 days, and 30 days.
- Output metrics: total Cash generated, levels achieved per business, time-to-unlock for each of the 6 businesses, and impact of Convenience Pass (4h vs 12h offline cap).
- Verify that economic progression remains challenging yet achievable without exponential infinite-growth breakdown.

### R4. API & Shared DTO Upgrades for Economy Health
- Expose ROI and payback metrics in PlayerBusiness DTO within packages/shared.
- Add an API endpoint GET /economy/simulation or GET /economy/roi for inspecting current economic multipliers and next best upgrade recommendations.

### R5. Strict Domain Boundary (Preserved for Astra 6.0)
- Do NOT alter or create UI/UX visual elements, React screens, or CSS styling in apps/web (reserved for Astra 6.0).
- Do NOT alter anti-cheat/anti-fraud algorithms, Sybil clustering, or penetration tests (reserved for Astra 6.0).

## Acceptance Criteria

### Starter Balance & Onboarding Verification
- [ ] New player initialization tests verify that new users receive 100 starter Cash (or 600 if referred) and can immediately unlock Street Stand.
- [ ] First-session activation flow transitions smoothly without zero-income deadlock.

### ROI & Mathematical Balance Verification
- [ ] Payback period and marginal ROI formulas have 100% unit test coverage with mathematical assertions across all 6 business tiers.
- [ ] Compact number formatting cleanly formats values from 0 up to 10^15 (quadrillions).

### Simulation Harness Verification
- [ ] Automated simulation suite runs 1h, 24h, and 7-day headless runs with deterministic outputs.
- [ ] Simulation tests verify that reaching late-game businesses (Factory, Tech Co, Global Holding) follows a smooth pacing curve without runaway inflation.

### Workspace Integrity & Double-Check Quality Gates
- [ ] pnpm check (ESLint, Prettier, TypeScript across 4 packages, Vitest test suite, Vite build, Wrangler dry-run) passes with 0 errors.
- [ ] Existing 137 tests remain 100% green; new tests bring coverage even higher.
- [ ] Full handoff documentation updated in HANDOFF.md.

