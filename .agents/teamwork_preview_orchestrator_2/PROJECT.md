# Project: Project Empire — Economy Balancing, Starter Grants & Simulation Tooling

## Architecture
- **packages/game-core**: Pure deterministic game logic, mathematical models, ROI metrics, starter state factory, compact number formatter, and headless progression simulation engine. Zero external dependencies.
- **packages/shared**: Canonical Zod schemas and TypeScript DTOs (`PlayerBusiness`, `PlayerEconomyState`, `/economy/roi` and `/economy/simulation` request/response contracts).
- **apps/api**: Hono REST endpoints running on Cloudflare Workers. Mounts `/economy` route handler backed by `EconomyStore` and PGlite database runner for deterministic testing.
- **supabase/migrations**: PostgreSQL schema migrations (`202609140006_economy_starter_and_roi.sql`) implementing onboarding starter cash grants (100 cash base, +500 if referred) and zero-deadlock user initialization triggers/RPCs.
- **scripts**: CLI entry points (`scripts/simulate-economy.ts`) for running headless 1h, 24h, 7d, 30d progression scenarios with formatted reporting.
- **apps/web**: Strictly isolated. Zero visual or CSS changes (preserved for Astra 6.0).
- **Anti-Cheat**: Strictly isolated. Zero modifications to anti-cheat or anti-fraud algorithms (preserved for Astra 6.0).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Starter Cash Onboarding Grant | 100 Cash default starter balance on first user creation to unlock Street Stand within 30s | M1 | ORIGINAL_REQUEST R1 |
| 2 | Referral Starter Cash Boost | Additive +500 Cash bonus (600 total) if user bound a referral link | M1 | ORIGINAL_REQUEST R1 |
| 3 | Pure getStarterEconomyState() | Pure factory function returning baseline economy state with non-zero cash | M1 | ORIGINAL_REQUEST R1 |
| 4 | Database Starter Grant Trigger/RPC | Migration 0006 establishing trigger/RPC on user creation to prevent 0-cash 0-income deadlock | M1 | ORIGINAL_REQUEST R1 |
| 5 | calculatePaybackPeriodSeconds | Pure break-even time calculation in seconds for any business upgrade | M2 | ORIGINAL_REQUEST R2 |
| 6 | calculateOptimalNextUpgrade | Pure recommendation engine identifying upgrade with shortest payback period / highest marginal ROI | M2 | ORIGINAL_REQUEST R2 |
| 7 | formatCompactNumber | Safe number/bigint formatting helper (1.2K, 3.5M, 12.8B, 4.5T, 1Q) with zero precision loss up to 10^15 | M2 | ORIGINAL_REQUEST R2 |
| 8 | Pure simulateProgression | Deterministic offline progression simulator across 1h, 24h, 7d, 30d | M3 | ORIGINAL_REQUEST R3 |
| 9 | Simulation Pacing Curve Verification | Verification that economic growth remains damped (cost growth 1.18 vs production growth 1.07) | M3 | ORIGINAL_REQUEST R3 |
| 10 | Convenience Pass Efficiency Metrics | Verification of 4h vs 12h offline cap impact (3.0x casual check-in efficiency, 0% P2W active advantage) | M3 | ORIGINAL_REQUEST R3 |
| 11 | CLI Simulation Runner Script | Executable script `scripts/simulate-economy.ts` for running head-to-head simulations | M3 | ORIGINAL_REQUEST R3 |
| 12 | PlayerBusiness DTO ROI Expansion | Inclusion of `paybackPeriodSeconds`, `marginalRoi`, `nextProductionPerSecond` in PlayerBusiness DTO | M4 | ORIGINAL_REQUEST R4 |
| 13 | API Economy Inspection Routes | Endpoint `GET /economy/roi` and `GET /economy/simulation` in apps/api | M4 | ORIGINAL_REQUEST R4 |
| 14 | Astra 6.0 Domain Boundary Enforcement | 100% isolation of apps/web visual UI and anti-cheat modules | M5 | ORIGINAL_REQUEST R5 |
| 15 | Monorepo Quality Gates & Test Coverage | pnpm check exit 0, 137 existing tests passing, 100% formula coverage, updated HANDOFF.md | M5 | Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Onboarding Starter Grants & Core Loop Calibration | 100 base Cash, +500 referral boost, `getStarterEconomyState()`, migration 0006 | none | IN_PROGRESS |
| M2 | Economy Mathematical Balance & ROI Metrics | `calculatePaybackPeriodSeconds`, `calculateOptimalNextUpgrade`, `formatCompactNumber` | none | IN_PROGRESS |
| M3 | Deterministic Economy Simulation Harness | `simulateProgression` (1h/24h/7d/30d), Convenience Pass comparison, `scripts/simulate-economy.ts` | M2 | IN_PROGRESS |
| M4 | API & Shared DTO Upgrades for Economy Health | `PlayerBusiness` DTO fields, `GET /economy/roi`, `GET /economy/simulation` | M1, M2, M3 | IN_PROGRESS |
| M5 | Verification, Quality Gates & Forensic Audit | Monorepo test suite, `pnpm check`, Reviewers x2, Challengers x2, Forensic Auditor, `HANDOFF.md` | M1–M4 | PLANNED |

## Interface Contracts

### packages/game-core

```typescript
// Starter State
export function getStarterEconomyState(isReferred?: boolean): {
  cash: number;
  businesses: { slug: string; level: number; baseCost: number; baseIncome: number }[];
};

// ROI & Payback
export function calculatePaybackPeriodSeconds(
  upgradeCost: number,
  currentProduction: number,
  nextProduction: number
): number; // Returns Infinity if delta <= 0, 0 if cost <= 0, otherwise cost / delta

export function calculateMarginalRoi(
  upgradeCost: number,
  currentProduction: number,
  nextProduction: number
): number; // 1 / paybackPeriodSeconds

export interface BusinessUpgradeCandidate {
  slug: string;
  name: string;
  currentLevel: number;
  upgradeCost: number;
  currentProduction: number;
  nextProduction: number;
  paybackPeriodSeconds: number;
  marginalRoi: number;
  isAffordable: boolean;
}

export function calculateOptimalNextUpgrade(
  businesses: Array<{ slug: string; name?: string; level: number; baseCost: number; baseIncome: number }>,
  playerCash?: number
): {
  bestOverall: BusinessUpgradeCandidate | null;
  bestAffordable: BusinessUpgradeCandidate | null;
  candidates: BusinessUpgradeCandidate[];
};

// Safe Compact Number Formatter
export function formatCompactNumber(value: number | bigint | string): string;
// Formats numbers with suffixes: '', 'K', 'M', 'B', 'T', 'Q' (Quadrillion)
// 1 decimal place if decimal > 0, e.g. 1.2K, 3.5M, 12.8B, 4.5T, 1Q, 10Q

// Simulation Engine
export interface SimulationConfig {
  initialCash?: number;
  isReferred?: boolean;
  hasConveniencePass?: boolean;
  offlineCapSeconds?: number;
  claimIntervalSeconds?: number;
  strategy?: 'greedy_roi' | 'cheapest' | 'balanced';
}

export interface SimulationResult {
  durationSeconds: number;
  totalCashEarned: number;
  finalCashBalance: number;
  finalProductionPerSecond: number;
  unlockedBusinessCount: number;
  businessLevels: Record<string, number>;
  timeToUnlockSeconds: Record<string, number | null>;
  conveniencePassImpact?: {
    cashEarnedFree: number;
    cashEarnedPass: number;
    wastedOfflineSecondsFree: number;
    wastedOfflineSecondsPass: number;
    efficiencyGainMultiplier: number;
  };
}

export function simulateProgression(
  durationSeconds: number,
  config?: SimulationConfig
): SimulationResult;
```

### packages/shared

```typescript
export const playerBusinessSchema = z.object({
  slug: z.string(),
  name: z.string(),
  level: z.number().int().nonnegative(),
  baseCost: z.number().positive(),
  baseIncome: z.number().positive(),
  upgradeCost: z.number().int().positive(),
  productionPerSecond: z.number().nonnegative(),
  lastClaimAt: z.string(),
  paybackPeriodSeconds: z.number().nonnegative().optional(),
  marginalRoi: z.number().nonnegative().optional(),
  nextProductionPerSecond: z.number().nonnegative().optional(),
});

export const economyRoiResponseSchema = z.object({
  currentCash: z.number().nonnegative(),
  totalProductionPerSecond: z.number().nonnegative(),
  optimalUpgrade: z.object({
    slug: z.string(),
    name: z.string(),
    currentLevel: z.number().int(),
    upgradeCost: z.number(),
    paybackPeriodSeconds: z.number(),
    marginalRoi: z.number(),
    isAffordable: z.boolean(),
  }).nullable(),
  businesses: z.array(playerBusinessSchema),
});
```

### apps/api

- `GET /economy/roi`: Authenticated or query-based inspection of current businesses, payback periods, and next optimal upgrade recommendation.
- `GET /economy/simulation?duration=86400&hasPass=true`: Inspection endpoint returning progression simulation metrics.

## Code Layout
- `packages/game-core/src/formulas.ts`: Core ROI, payback, upgrade cost, and compact formatter formulas.
- `packages/game-core/src/starter.ts`: Pure `getStarterEconomyState` implementation and starter constants.
- `packages/game-core/src/simulation.ts`: Pure progression simulator engine.
- `packages/game-core/src/index.ts`: Public barrel exports for all new functions and types.
- `packages/shared/src/index.ts`: Extended Zod schemas and DTO types.
- `supabase/migrations/202609140006_economy_starter_and_roi.sql`: SQL migration for starter cash grants & registration triggers.
- `apps/api/src/economy/`: Route handlers and store logic for `/economy/roi` and `/economy/simulation`.
- `apps/api/src/index.ts`: Mount `/economy` route.
- `apps/api/src/auth/test-db.ts`: Register migration `202609140006` in PGlite.
- `scripts/simulate-economy.ts`: CLI simulation tool.
- `HANDOFF.md`: Project-wide documentation of changes, test metrics, and verification steps.
