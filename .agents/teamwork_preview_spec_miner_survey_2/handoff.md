# Handoff Report: Survey 2 — Economy Balancing & Onboarding Spec Mining

**Agent**: `teamwork_preview_spec_miner_survey_2`  
**Milestone**: Survey 2 (Requirements R1–R5)  
**Date**: 2026-09-14  
**Working Directory**: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_spec_miner_survey_2`

---

## 1. Observation

1. **`ORIGINAL_REQUEST.md` (Lines 66–120)**:
   - Line 77: *"Provide a default starter balance (100 Cash) on first player creation so the player can immediately unlock Street Stand (Level 1, 1 Cash/s) and activate their core idle loop within 30 seconds."*
   - Line 78: *"Support additive starter referral boost (+500 Cash) if the player bound a referral link."*
   - Line 79: *"Expose a pure getStarterEconomyState() function and database trigger/RPC initialization ensuring new users are never initialized with 0 cash and 0 production."*
   - Line 83: *"calculatePaybackPeriodSeconds(upgradeCost, currentProduction, nextProduction): Deterministic calculation of break-even time (ROI) in seconds for any business upgrade."*
   - Line 84: *"calculateOptimalNextUpgrade(businesses, playerCash): Pure recommendation function identifying the business upgrade that yields the shortest payback period or highest marginal ROI."*
   - Line 85: *"Safe big-number formatting helper: formatCompactNumber(value) (1.2K, 3.5M, 12.8B, 4.5T) ensuring zero precision loss and protection against numeric overflows."*
   - Line 89: *"Pure simulation function simulateProgression(strategy, durationSeconds, config) that models player growth over 1 hour, 24 hours, 7 days, and 30 days."*
   - Line 90: *"Output metrics: total Cash generated, levels achieved per business, time-to-unlock for each of the 6 businesses, and impact of Convenience Pass (4h vs 12h offline cap)."*
   - Lines 94–95: *"Expose ROI and payback metrics in PlayerBusiness DTO within packages/shared. Add an API endpoint GET /economy/simulation or GET /economy/roi for inspecting current economic multipliers and next best upgrade recommendations."*
   - Lines 98–99: *"Do NOT alter or create UI/UX visual elements, React screens, or CSS styling in apps/web (reserved for Astra 6.0). Do NOT alter anti-cheat/anti-fraud algorithms, Sybil clustering, or penetration tests (reserved for Astra 6.0)."*

2. **Existing Database Schema**:
   - `supabase/migrations/202609140002_economy.sql` (Line 48):
     `cash bigint not null default 0 check (cash >= 0)`
     Observed that existing `player_balances` currently defaults `cash` to `0`, which directly causes zero-income deadlock unless explicitly initialized.
   - `supabase/migrations/202609140001_auth.sql` (Line 68–72):
     Observed that `empire_auth_login` inserts rows into `public.users`, but there is currently no trigger or RPC automatically populating `player_balances` or `player_businesses` on user insertion.

3. **Existing Game Core & Shared DTOs**:
   - `packages/game-core/src/formulas.ts`:
     Already provides `calculateUpgradeCost(baseCost, level, growthRate=1.18)`, `calculateMilestoneMultiplier(level)`, and `calculateProductionPerSecond(baseIncome, level, growthRate=1.07)`. It lacks `calculatePaybackPeriodSeconds`, `calculateOptimalNextUpgrade`, and `formatCompactNumber`.
   - `packages/game-core/src/referral.ts` (Line 48):
     `export const REFERRAL_STARTER_CASH_BOOST = 500;` already exists as an export.
   - `packages/shared/src/index.ts` (Lines 18–28):
     `playerBusinessSchema` currently defines `slug`, `name`, `level`, `baseCost`, `baseIncome`, `upgradeCost`, `productionPerSecond`, `lastClaimAt`. It lacks `paybackPeriodSeconds`, `marginalRoi`, and `nextLevelProductionPerSecond`.

4. **Workspace Quality Gates**:
   - Running `pnpm check`:
     Executed ESLint, Prettier, TypeScript across 4 packages, Vitest suite (17 test files, 137 tests passing), Vite web build, and Cloudflare Wrangler dry-run. Exit code was strictly `0`.

---

## 2. Logic Chain

1. **Deadlock Elimination Rationale**:
   From Observation 1 and 2, a user with $0$ Cash and $0$ businesses generates $0$ Cash/s. Since Street Stand unlock requires 100 Cash (`DEFAULT_BUSINESSES[0].baseCost = 100`), the player can never earn enough cash to unlock Street Stand without external cash. Therefore, initializing `player_balances.cash` with `100` (or `600` if referred) and populating all 6 businesses at level 0 completely eliminates the zero-income deadlock.

2. **Mathematical ROI & Recommendation Rationale**:
   From Observation 1 and 3, upgrading a business increases production by $\Delta P = P_{\text{next}} - P_{\text{current}}$. The break-even time in seconds is $T = \text{cost} / \Delta P$. Because milestone bonuses ($2\times$ at level 10, 25, 50, 100) create sudden spikes in $\Delta P$, the payback period drops substantially (e.g., Street Stand Level 9 $\to$ 10 payback drops from $\approx 104$s to $\approx 20.8$s). `calculateOptimalNextUpgrade` must evaluate both unconstrained shortest payback and affordable-only options with deterministic tie-breaking.

3. **Number Formatting & BigInt Scale Rationale**:
   From Observation 1, formatting must safely handle numbers up to $10^{15}$ (1 Quadrillion). Although $10^{15} < 2^{53}-1$ (JavaScript `Number.MAX_SAFE_INTEGER` $\approx 9.007 \times 10^{15}$), higher season totals or large BigInts can suffer floating-point inaccuracies. Supporting `number | bigint | string` with suffix tiers (`K`, `M`, `B`, `T`, `Q`) guarantees zero precision loss.

4. **Simulation Pacing & Anti-Inflation Equilibrium Rationale**:
   From Observation 1 and 3, upgrade cost grows at $1.18$ per level while base production grows at $1.07 \times L$. The ratio of cost escalation to production escalation is $\approx 1.1028$ per level ($10.3\%$ cost growth advantage). This mathematical friction naturally tames exponential runaway and ensures 1h, 24h, 7d, and 30d progression curves remain challenging, pacing late-game unlocks (Factory, Tech Co, Global Holding) across weeks.

5. **Convenience Pass Economic Ratio Rationale**:
   For a casual player checking in twice daily (every 12h = 43,200s):
   - Free (4h cap) claims $8\text{h}$ of production/day ($16\text{h}$ wasted).
   - Pass (12h cap) claims $24\text{h}$ of production/day ($0\text{h}$ wasted).
   - The Pass provides an exact $3.0\times$ efficiency boost without violating anti-P2W principles ($1.0\times$ base SRU, 0 point multipliers).

---

## 3. Caveats

1. **Astra 6.0 Boundaries**: No UI components or CSS styling in `apps/web/` were designed or implemented; all UI work must be executed by Astra 6.0.
2. **Database Trigger Deployment**: In production Supabase environments, triggers require superuser/service_role migration execution. An in-memory PGlite test suite should be used during implementation to verify trigger execution without requiring a live remote database.
3. **BigInt Serialization**: JSON does not natively serialize `BigInt`. Therefore, API responses should represent large currency numbers as native JavaScript numbers (safe up to $9 \times 10^{15}$) or as strings if exceeding `Number.MAX_SAFE_INTEGER`.

---

## 4. Conclusion

All requirements (R1–R5) are thoroughly extracted, mathematically verified, and documented in `.agents/teamwork_preview_spec_miner_survey_2/analysis.md`. The design provides:
1. Complete elimination of zero-income deadlock with 100/600 starter cash and automatic database triggers/RPCs.
2. Exact deterministic financial ROI formulas (`calculatePaybackPeriodSeconds`, `calculateOptimalNextUpgrade`, `formatCompactNumber`).
3. Headless simulation engine (`simulateProgression`) testing 1h, 24h, 7d, and 30d runs with 4h vs 12h offline cap comparisons.
4. Upgraded `PlayerBusiness` DTO schemas and `GET /economy/roi` endpoint contracts.
5. 100% adherence to Astra 6.0 domain boundaries.

The implementation team can immediately proceed to architecture, code generation, and test creation using the contracts specified in `analysis.md`.

---

## 5. Verification Method

1. **Inspect Analysis Report**:
   - Review `.agents/teamwork_preview_spec_miner_survey_2/analysis.md`
   - Confirm presence of Features Discovered table (15 items) and Edge Cases table (24 items).
2. **Execute Baseline Test Suite**:
   ```powershell
   pnpm test
   ```
   Verify 17 test files and 137 tests pass with 0 failures.
3. **Execute Full Quality Gate**:
   ```powershell
   pnpm check
   ```
   Verify ESLint, Prettier, TypeScript typecheck, Vitest, Vite build, and Wrangler dry-run exit with code 0.
4. **Invalidation Conditions**:
   - Any modification to `apps/web/src/` components or anti-cheat risk scoring violates R5.
   - Any initialization path permitting a new user with 0 cash and 0 production violates R1.
   - Any compact number formatting failing at $10^{15}$ violates R2.
