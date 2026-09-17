# Project: Empire Telegram Mini App Testing & Quality Verification

## Architecture & Stream Isolation (Strictly Maximum 2 Concurrent Agents)

The mission executes comprehensive testing and quality verification across two strictly isolated streams:

### Stream 1: Core Math & Game Engine Unit Tests
- **Scope**: `packages/game-core/`, `apps/web/src/game/crypto-mines-model.ts`, `apps/web/src/game/crypto-predictions-model.ts`
- **Key Modules**:
  1. **Mines (Crypto Mines)**:
     - Multiplier formula: $(1 - \text{edge}) \times \prod_{i=0}^{k-1} \frac{25 - i}{25 - m - i}$
     - 1 to 20 mine bounds, house edge rules, fair cashout & bust logic
     - Fisher-Yates non-repeating grid (25 cells) distribution & first-move safe/fair rule bounds
  2. **Predictions (Crypto Predictions)**:
     - YES/NO odd calculations, coupon payout multipliers, stake deduction, settlement & profit claim limit tests
  3. **Crash & Adaptive House Algorithm**:
     - Dynamic risk multiplier on low vs high stakes, sudden bet spike penalties, crash point verification
  4. **Turnover (0.1% / Binde 1) & Tiered Referral Commission**:
     - 1,000 cash per 1M turnover; 3%, 5%, 7% commission tiers with exact numerical tests
  5. **Daily Streak Progression Bonuses**:
     - Threshold bonuses (7d, 30d, 90d, 180d, 365d) mathematical limits and reward calculations

### Stream 2: API Endpoints, Zod Validation & Monorepo Health Gate
- **Scope**: `apps/api/`, `apps/web/`, `packages/shared/`
- **Key Modules**:
  1. **Missions & Streak API & Zod Schemas**:
     - `getActiveMissions` and `getStreak` strict compliance with `PlayerMissionInstance` and `PlayerStreakDto`
     - Claim flows: UUID `id` validation, presence of `difficulty`, `key`, `assignedDate`
  2. **API Routes Verification**:
     - `/api/missions`, `/api/streak`, `/api/referral/status`, `/api/economy/roi` returning valid, expected types
  3. **Referral & Partner Kickback Integration**:
     - Referral code/link generation, balance update, kickback claim flow verification at API level
  4. **Monorepo Quality Gate**:
     - `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` with 0 errors and 0 warnings

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Survey & Test Gap Audit (Stream 1 & 2) | Full codebase test status audit | None | IN_PROGRESS |
| M2 | Stream 1 Core Math & Minigame Unit Tests | packages/game-core, apps/web/src/game/ | M1 | PLANNED |
| M3 | Stream 2 API, Zod Validation & Schema Fixes | apps/api, apps/web, packages/shared | M1 | PLANNED |
| M4 | Adversarial Verification & Forensic Audit | Challengers & Auditor (max 2 concurrent) | M2, M3 | PLANNED |
| M5 | Monorepo Health Gate & Final Handoff | Full pnpm check & HANDOFF.md update | M4 | PLANNED |

## Exclusive File Boundaries

- **Stream 1 Write Ownership**:
  - `packages/game-core/src/*.test.ts`
  - `apps/web/src/game/crypto-mines-model.test.ts`
  - `apps/web/src/game/crypto-predictions-model.test.ts`
  - Any missing unit tests under `packages/game-core/`
- **Stream 2 Write Ownership**:
  - `apps/api/src/**/*.test.ts`
  - `packages/shared/src/**/*.ts` (if schema fixes needed)
  - `apps/api/src/**/*.ts` (if endpoint schema/handler fixes needed)
  - `apps/web/src/api/**/*.ts` or integration tests
