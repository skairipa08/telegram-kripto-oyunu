# Stream 2 Investigation Report: API Endpoints, Zod Validation & Monorepo Health Gate

**Date**: 2026-09-17T11:05:00Z  
**Agent**: Explorer Stream 2 (`teamwork_preview_explorer`)  
**Scope**: `apps/api/`, `apps/web/`, `packages/shared/`, Monorepo Quality Gates  

---

## 1. Observation

### 1.1 Missions & Streak Zod Schemas vs. Implementation
1. **Schema Definition (`packages/shared/src/index.ts:175-196`)**:
   ```typescript
   export const missionDifficultySchema = z.enum([
     'easy',
     'normal',
     'hard',
     'weekly',
   ]);
   export type MissionDifficultyDto = z.infer<typeof missionDifficultySchema>;

   export const playerMissionInstanceSchema = z.object({
     id: z.uuid(),
     key: z.string(),
     difficulty: missionDifficultySchema,
     title: z.string(),
     description: z.string(),
     progress: z.number().int().nonnegative(),
     target: z.number().int().positive(),
     status: z.enum(['in_progress', 'completed', 'claimed']),
     rewardPoints: z.number().int().positive(),
     assignedDate: z.string(),
     claimedAt: z.iso.datetime().nullable(),
   });
   ```

2. **In-Memory Dev Store Bug (`apps/api/src/dev-store.ts:481-527`)**:
   ```typescript
   // Line 502-506 in dev-store.ts:
   {
     id: m2Id,
     key: 'upgrade_business',
     difficulty: 'medium', // <--- ERROR: 'medium' is not in ['easy', 'normal', 'hard', 'weekly']
     title: 'İlk İşletmeni Geliştir',
     ...
   }
   ```
   - In `apps/web/src/game/live-game.tsx:101-105`:
     ```typescript
     const missionsResponseSchema = {
       parse(value: unknown): PlayerMissionInstance[] {
         if (Array.isArray(value)) {
           return playerMissionInstanceSchema.array().parse(value);
         }
         ...
       }
     };
     ```
     When running against dev mode (when `SUPABASE_URL` is unset), `playerMissionInstanceSchema.array().parse(value)` fails with:
     `ZodError: Invalid enum value. Expected 'easy' | 'normal' | 'hard' | 'weekly', received 'medium' at [1].difficulty`.
     This causes `missions.isError` to be set to `true`, breaking active mission loading and forcing a fallback to static client fixtures.

3. **Mission Claim Flow Response Mismatch (`apps/api/src/dev-store.ts:530-548` & `apps/api/src/economy/routes.ts:549-558`)**:
   - In `apps/api/src/dev-store.ts:538-546`:
     ```typescript
     return {
       success: true,
       claimedAt: new Date().toISOString(),
       rewardCash: 1000,
       rewardSeasonPoints: 100, // <--- returns rewardSeasonPoints, not rewardPoints
       newCash: p.cash,
       newSeasonPoints: p.seasonPoints,
     };
     ```
   - In `apps/api/src/economy/routes.ts:549-558`:
     ```typescript
     const response: ClaimMissionResponse = {
       apiVersion: 'v1',
       missionInstanceId: String(result.missionInstanceId ?? body.missionInstanceId),
       rewardPoints: Number(result.rewardPoints ?? 0), // <--- Evaluates to 0!
       newSeasonPoints: Number(result.newSeasonPoints ?? 0),
       claimedAt: new Date(String(result.claimedAt ?? Date.now())).toISOString(),
     };
     ```
   - In `packages/shared/src/index.ts:216-223`:
     ```typescript
     export const claimMissionResponseSchema = z.object({
       apiVersion: z.literal('v1'),
       missionInstanceId: z.uuid(),
       rewardPoints: z.number().int().positive(), // <--- Requires positive (>0) integer!
       newSeasonPoints: z.number().int().nonnegative(),
       claimedAt: z.iso.datetime(),
     });
     ```
     Because `dev-store.ts` returned `rewardSeasonPoints` instead of `rewardPoints`, `response.rewardPoints` is `0`, which violates `z.number().positive()`. Client validation in `apps/web/src/game/live-game.tsx:277` throws a Zod error on claim.

4. **Missing Route for `GET /api/missions` (`apps/api/src/economy/routes.ts:481`)**:
   - `apps/api/src/economy/routes.ts` mounts `routes.get('/missions/active', ...)`.
   - The user specification / acceptance criteria states:
     `API /api/missions, /api/streak, /api/referral/status ve /api/economy/roi rotalarının geçerli ve beklenen tipte veri döndürdüğü doğrulanmalı.`
   - Requesting `GET /api/missions` or `GET /missions` currently returns HTTP 404 (`NOT_FOUND`) because only `/missions/active` is registered. An alias `routes.get('/missions', ...)` is missing.

5. **UUID Validation on Claim Flow (`packages/shared/src/index.ts:208-214` & `apps/web/src/screens/missions-screen.tsx:75-136`)**:
   - `claimMissionRequestSchema` strictly enforces:
     ```typescript
     export const claimMissionRequestSchema = z.object({
       missionInstanceId: z.uuid(),
       requestId: z.uuid(),
     }).strict();
     ```
   - All backend-generated daily/weekly missions (via SQL and `dev-store.ts`) use UUID format (`00000000-0000-4000-b000-000000000001`).
   - However, in `apps/web/src/screens/missions-screen.tsx:75-136`, `FALLBACK_LIFETIME_MISSIONS` has non-UUID identifiers:
     `'lifetime_earn_1m'`, `'lifetime_earn_10m'`, `'lifetime_reach_level_50'`, `'lifetime_invite_5'`, etc.
     If a user triggers `onClaim` for a lifetime mission, `POST /api/missions/:id/claim` rejects with HTTP 400 `INVALID_REQUEST`.

### 1.2 API Endpoints Status & Payloads
| Endpoint | Mounted Prefix | Handler Location | Response Type | Validation Status |
|---|---|---|---|---|
| `GET /api/missions/active` | `/` and `/api` | `apps/api/src/economy/routes.ts:481` | `PlayerMissionInstance[]` | Fails in dev mode due to `'medium'` difficulty. Works in SQL mode. |
| `GET /api/missions` | **MISSING** | None | HTTP 404 | Needs alias to `/missions/active`. |
| `GET /api/streak` | `/` and `/api` | `apps/api/src/economy/routes.ts:567` | `PlayerStreakDto & { apiVersion: 'v1' }` | Fully valid against `playerStreakDtoSchema`. |
| `GET /api/referral/status`| `/` and `/api` | `apps/api/src/economy/routes.ts:689` | `PlayerReferralOverview & { apiVersion: 'v1' }` | Fully valid against `playerReferralOverviewSchema`. |
| `GET /api/economy/roi` | `/` and `/api` | `apps/api/src/economy/routes.ts:60` | `EconomyRoiResponse` | Fully valid against `economyRoiResponseSchema`. |
| `POST /api/missions/:id/claim` | `/` and `/api` | `apps/api/src/economy/routes.ts:509` | `ClaimMissionResponse` | Fails in dev mode (rewardPoints=0). Requires UUID param. |
| `POST /api/streak/claim` | `/` and `/api` | `apps/api/src/economy/routes.ts:597` | `ClaimStreakResponse` | Fully valid against `claimStreakResponseSchema`. |
| `POST /api/referral/bind` | `/` and `/api` | `apps/api/src/economy/routes.ts:645` | `BindReferralResponse` | Fully valid against `bindReferralResponseSchema`. |
| `POST /api/referral/claim-kickback` | `/` and `/api` | `apps/api/src/economy/routes.ts:732` | `{ claimedCash, newCash, claimedAt }` | Works in `MemoryEconomyStore`, returns 501 in `SupabaseEconomyStore`. |

### 1.3 Referral & Partner Kickback Integration
- **Referral Code Generation**: In `apps/api/src/dev-store.ts:446-447`, deep links use `https://t.me/PemtokenBot?startapp=ref_REF_${userId.slice(0, 8)}`. In `apps/web/src/game/live-game.tsx:522`, `normalizeReferralInviteLink` safely sanitizes and validates the deep link.
- **Turnover Kickback Calculation**: `calculateReferralKickback` in `@empire/game-core` calculates the exact 0.1% (1 in 1000) kickback. `apps/api/src/economy/referral-kickback.test.ts` passes 100% against `MemoryEconomyStore`.
- **Store Support**: `SupabaseEconomyStore` (`apps/api/src/economy/store.ts`) lacks `claimReferralKickback`. If called in production/Supabase mode, it responds with HTTP 501 `NOT_IMPLEMENTED`.
- **Frontend Action**: `apps/web/src/screens/friends-screen.tsx:118` calls `POST /api/referral/claim-kickback` and opens a celebratory modal when cash is claimed. Note that `onCashUpdated` prop is not passed from `live-game.tsx:799`, so the balance refresh relies on manual/automatic query refetch.

### 1.4 Monorepo Quality Gate Status (Direct Command Execution)
1. **`pnpm typecheck`**:
   - Result: **0 errors (PASS)**.
   - All 4 packages (`@empire/shared`, `@empire/game-core`, `apps/api`, `apps/web`) compile with zero TypeScript errors.
2. **`pnpm build`**:
   - Result: **0 errors (PASS)**.
   - `apps/api`: Wrangler dry-run succeeded (`Total Upload: 1089.16 KiB / gzip: 182.62 KiB`).
   - `apps/web`: Vite built successfully (`dist/index.html` 0.52 kB, CSS 128.38 kB, JS 613.53 kB).
3. **`pnpm lint`**:
   - Result: **3 errors (FAIL)**.
     - `apps/web/src/components/crypto-mines-game.tsx:1:27`: `'useEffect' is defined but never used` (@typescript-eslint/no-unused-vars).
     - `apps/web/src/screens/empire-screen.tsx:493:3`: `'previewMiniGame' is assigned a value but never used` (@typescript-eslint/no-unused-vars).
     - `apps/web/src/screens/empire-screen.tsx:494:3`: `'onPreviewMiniGameReward' is defined but never used` (@typescript-eslint/no-unused-vars).
4. **`pnpm format:check`**:
   - Result: **15 files failed formatting (FAIL)**.
     - Files needing Prettier formatting:
       1. `apps/api/src/dev-store.ts`
       2. `apps/web/src/components/crypto-mines-game.tsx`
       3. `apps/web/src/components/crypto-predictions-game.tsx`
       4. `apps/web/src/components/empire-arcade.tsx`
       5. `apps/web/src/components/icons.tsx`
       6. `apps/web/src/game/arcade-audio.ts`
       7. `apps/web/src/game/arcade-haptics.ts`
       8. `apps/web/src/game/crypto-mines-model.ts`
       9. `apps/web/src/game/crypto-predictions-model.ts`
       10. `apps/web/src/game/live-game.tsx`
       11. `apps/web/src/game/types.ts`
       12. `apps/web/src/screens/empire-screen.tsx`
       13. `apps/web/src/screens/friends-screen.tsx`
       14. `apps/web/src/screens/social.css`
       15. `HANDOFF.md`
5. **`pnpm test`**:
   - Result: **791 passed, 1 failed across 67 test files (FAIL)**.
   - Failing test: `apps/web/src/screens/arcade-screen.test.tsx:21:22`
     - Test: `ArcadeScreen and Mini-Games Suite > ArcadeScreen and Hub Shell > renders ArcadeScreen with header, audio controls, tabs, and default Notcoin Tap game`
     - Error: `AssertionError: expected '<div class="arcade-screen workspace-g…' to contain 'Şifre'`.
     - Cause: Tab button text in `apps/web/src/components/empire-arcade.tsx:207` was changed to `'Deşifre'`, but the unit test still asserts `expect(markup).toContain('Şifre')`.

---

## 2. Logic Chain

1. **Premise 1**: The web application in dev mode relies on `apps/api/src/dev-store.ts` (`MemoryEconomyStore`) when no Supabase backend is configured.
2. **Premise 2**: `apps/web/src/game/live-game.tsx` validates the payload of `GET /api/missions/active` with `playerMissionInstanceSchema.array().parse(value)`.
3. **Premise 3**: In `dev-store.ts:504`, mission #2 is defined with `difficulty: 'medium'`. `missionDifficultySchema` only permits `'easy'`, `'normal'`, `'hard'`, `'weekly'`.
4. **Deduction 1**: Parsing fails with a runtime `ZodError`. The missions tab fails to show real active missions and falls back to static fixtures.
5. **Premise 4**: In `dev-store.ts:538-546`, `claimMission` returns `{ rewardSeasonPoints: 100 }`. In `routes.ts:554`, `rewardPoints` reads `Number(result.rewardPoints ?? 0)`.
6. **Premise 5**: `claimMissionResponseSchema` validates that `rewardPoints` is a positive integer (`z.number().int().positive()`).
7. **Deduction 2**: In dev mode, claiming any mission results in `rewardPoints: 0`, failing Zod validation in `live-game.tsx` and preventing players from claiming missions.
8. **Premise 6**: `apps/api/src/economy/routes.ts` mounts `routes.get('/missions/active', ...)`, but does not register `routes.get('/missions', ...)`.
9. **Deduction 3**: Requests to `GET /api/missions` return 404 `NOT_FOUND`, which fails the expected endpoint contract.
10. **Premise 7**: Quality gate commands (`pnpm lint`, `pnpm format:check`, `pnpm test`) returned exit code 1 due to 3 unused TypeScript variables, 15 unformatted files, and 1 stale string assertion in `arcade-screen.test.tsx:21`.
11. **Deduction 4**: Monorepo health gate is blocked by these 3 isolated issues, despite TypeScript types (`pnpm typecheck`) and builds (`pnpm build`) being 100% green.

---

## 3. Caveats

- **Supabase Production Migration**: In real Supabase SQL (`supabase/migrations/202609140009_missions_and_launch.sql`), `empire_get_active_missions` assigns valid difficulty types (`'easy'`, `'normal'`, `'hard'`, `'weekly'`) from the database table enum. The difficulty bug is isolated to `MemoryEconomyStore` in `dev-store.ts`.
- **Turnover Kickback Persistence in SQL**: The 0.1% referral kickback is implemented in `MemoryEconomyStore` and `@empire/game-core`. It is not yet backed by a PostgreSQL migration in `supabase/migrations/`. In production Supabase mode, the endpoint returns 501.
- **No Source Modifications**: As this is an Explorer role, no edits were made to source files. Concrete remediation instructions are detailed below.

---

## 4. Conclusion & Proposed Remediation

### 4.1 Required Fixes for Stream 2 Implementer

#### Fix 1: Dev-Store Mission Schemas (`apps/api/src/dev-store.ts`)
- **Line 504**: Change `difficulty: 'medium'` to `difficulty: 'normal'`.
- **Line 544**: Change `rewardSeasonPoints: 100` to `rewardPoints: 100` (or return both).
- In `apps/api/src/economy/routes.ts:554`: Update `rewardPoints` fallback to:
  ```typescript
  rewardPoints: Number(result.rewardPoints ?? result.rewardSeasonPoints ?? 50),
  ```

#### Fix 2: Alias Endpoint for `/api/missions` (`apps/api/src/economy/routes.ts`)
- Add `routes.get('/missions', ...)` using the exact same handler as `routes.get('/missions/active', ...)`.

#### Fix 3: Lifetime Missions ID Format (`apps/web/src/screens/missions-screen.tsx`)
- In `FALLBACK_LIFETIME_MISSIONS`, convert IDs to valid UUIDs (e.g. `00000000-0000-4000-a000-000000000001` through `...0006`) so that `claimMissionRequestSchema.parse` does not reject them.

#### Fix 4: Monorepo Quality Gate Fixes
1. **ESLint (`apps/web/src/components/crypto-mines-game.tsx`)**:
   - Line 1: Remove unused `useEffect` from `import React, { useState, useEffect } from 'react';`.
2. **ESLint (`apps/web/src/screens/empire-screen.tsx`)**:
   - Lines 493-494: Prefix with underscore `_previewMiniGame = false,` and `_onPreviewMiniGameReward,` or omit from destructured props.
3. **Vitest (`apps/web/src/screens/arcade-screen.test.tsx`)**:
   - Line 21: Update `expect(markup).toContain('Şifre');` to `expect(markup).toContain('Deşifre');`.
4. **Prettier**:
   - Run `pnpm prettier --write .` across the 15 flagged files.

---

## 5. Verification Method

To independently reproduce and verify all findings:

1. **Verify Lint Errors**:
   ```powershell
   pnpm lint
   ```
   *Expected result*: Exits with code 1, reporting 3 unused variable errors in `crypto-mines-game.tsx` and `empire-screen.tsx`.

2. **Verify Format Failures**:
   ```powershell
   pnpm format:check
   ```
   *Expected result*: Exits with code 1, reporting 15 files with formatting issues.

3. **Verify Typecheck**:
   ```powershell
   pnpm typecheck
   ```
   *Expected result*: Exits with code 0 across all 4 packages.

4. **Verify Test Failure**:
   ```powershell
   pnpm vitest run apps/web/src/screens/arcade-screen.test.tsx
   ```
   *Expected result*: Fails on line 21 with `expected markup to contain 'Şifre'`.

5. **Verify Endpoint Schemas**:
   Inspect `apps/api/src/dev-store.ts:504` and `packages/shared/src/index.ts:175` to confirm `'medium'` vs `'normal'` enum mismatch.
