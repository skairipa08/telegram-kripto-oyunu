# Handoff Report — Requirement R4 Web Survey

**Agent**: `teamwork_preview_explorer_survey4_web`  
**Milestone**: `survey4_web`  
**Date**: 2026-09-14T19:48:30Z  
**Target File Under Survey**: `apps/web/src/game/live-game.tsx`  

---

## 1. Observation

1. **Current State of `apps/web/src/game/live-game.tsx`**:
   - Lines 18-23 import `EmpireScreen`, `MissionsScreen`, `FriendsScreen`, `LeaderboardScreen`, `ShopScreen`, and `ApiError`.
   - Line 25 defines a placeholder constant: `const unavailable = { status: 'unavailable' as const, data: null };`.
   - Lines 40-46 fetch `/api/economy/roi` via `useQuery` and store it in `economy`.
   - Lines 71-93 construct `empireResource`:
     ```typescript
     cash: economy.data.currentCash,
     seasonPoints: points,
     production: economy.data.totalProductionPerSecond,
     claimable: null, // Hardcoded null
     offlineHours: (economy.data.multipliers?.offlineCapSeconds ?? 14400) / 3600,
     ```
   - Lines 164-166 render tabs:
     ```tsx
     {tab === 'empire' && <EmpireScreen resource={empireResource} />}
     {tab === 'missions' && <MissionsScreen resource={unavailable} />}
     {tab === 'friends' && <FriendsScreen resource={unavailable} />}
     ```
   - Neither `onClaim` nor `onUpgrade` is passed to `EmpireScreen`. Both `MissionsScreen` and `FriendsScreen` receive `resource={unavailable}`.

2. **EmpireScreen Component Props (`apps/web/src/screens/empire-screen.tsx`)**:
   - Lines 5-9:
     ```typescript
     type EmpireScreenProps = {
       resource: ScreenResource<EmpireView>;
       onClaim?: () => void;
       onUpgrade?: (slug: string) => void;
     };
     ```
   - Lines 185-187:
     ```typescript
     const canClaim = data.claimable !== null && data.claimable > 0 && Boolean(onClaim);
     ```
     Because `claimable` is `null` in `live-game.tsx`, `canClaim` is permanently false even if `onClaim` were passed.

3. **MissionsScreen Component Props (`apps/web/src/screens/missions-screen.tsx`)**:
   - Lines 11-14:
     ```typescript
     type MissionsScreenProps = {
       resource: ScreenResource<MissionsView>;
       onClaim?: (id: string) => void;
     };
     ```
   - Lines 31-38:
     ```typescript
     const isComplete = mission.status === 'completed';
     const actionDisabled = !isComplete || !onClaim;
     ```
   - Line 86: `onClick={() => onClaim?.(mission.id)}`.

4. **FriendsScreen Component Props & Deep Link Validation (`apps/web/src/screens/friends-screen.tsx`)**:
   - Lines 11-13:
     ```typescript
     type FriendsScreenProps = {
       resource: ScreenResource<FriendsView>;
     };
     ```
   - Lines 24-43 define `isSafeTelegramInvite(value: string)`:
     ```typescript
     url.protocol === 'https:' &&
     url.hostname === 't.me' &&
     /^\/[A-Za-z0-9_]+\/?$/.test(url.pathname) &&
     params.length === 1 &&
     params[0]?.[0] === 'startapp' &&
     /^ref_[A-Za-z0-9]+$/.test(params[0]?.[1] ?? '')
     ```
   - Lines 144-156: If `isSafeTelegramInvite(data.link)` returns false, the copy button is disabled and the link is rendered as "Davet bağlantısı kullanılamıyor".
   - `FriendsScreenProps` has no `onBind` or `bindReferral` property in its interface; visual UI components are frozen for Astra 6.0.

5. **Existing DTOs in `packages/shared/src/index.ts`**:
   - `claimCashRequestSchema`, `claimCashResponseSchema` (lines 121-135).
   - `upgradeBusinessRequestSchema`, `upgradeBusinessResponseSchema` (lines 137-155).
   - `playerMissionInstanceSchema` (lines 183-196).
   - `playerStreakDtoSchema` (lines 198-206).
   - `claimMissionRequestSchema`, `claimMissionResponseSchema` (lines 208-223).
   - `playerReferralOverviewSchema` (lines 250-260).
   - `bindReferralRequestSchema`, `bindReferralResponseSchema` (lines 262-275).

6. **Current Test & Typecheck Status**:
   - `pnpm test` executes Vitest across 25 files with 232 passed tests (0 failures).
   - `pnpm -r typecheck` passes with 0 errors across 4 workspace packages (`packages/game-core`, `packages/shared`, `apps/api`, `apps/web`).

---

## 2. Logic Chain

1. **EmpireScreen Wiring**:
   - `EmpireScreen` accepts `onClaim?: () => void` and `onUpgrade?: (slug: string) => void`.
   - When `onClaim` is passed, clicking the claim button calls `POST /api/economy/claim` with `{ requestId: crypto.randomUUID() }`.
   - To make the claim button active, `claimable` in `EmpireView` must not be null. By taking `totalProductionPerSecond` and multiplying by elapsed seconds since `min(lastClaimAt)` across active businesses (`level > 0`), bounded by `offlineCapSeconds`, `claimable` reflects actual earned cash.
   - When `onUpgrade` is passed with `(slug: string)`, clicking any business upgrade button calls `POST /api/economy/upgrade` with `{ businessSlug: slug, requestId: crypto.randomUUID() }`.
   - When either mutation resolves successfully, `queryClient.invalidateQueries({ queryKey: ['game-design', actor, 'economy'] })` triggers a background refetch of `/api/economy/roi`, updating cash balance, business levels, payback calculations, and optimal upgrade recommendation.

2. **MissionsScreen Wiring**:
   - `MissionsScreen` expects `ScreenResource<MissionsView>` where `MissionsView = { streak: number; missions: MissionView[] }`.
   - `useQuery` fetching `GET /api/missions/active` provides the mission instances.
   - `useQuery` fetching `GET /api/streak` provides the streak day count.
   - Mapping `PlayerMissionInstance` to `MissionView` maps `id`, `title`, `description`, `difficulty`, `progress`, `target`, `rewardPoints -> reward`, and `status`.
   - Passing `onClaim={(id) => void claimMissionMutation.mutate(id)}` calls `POST /api/missions/:id/claim` with `{ missionInstanceId: id, requestId: crypto.randomUUID() }`.
   - On success, `queryClient.invalidateQueries` refreshes both `missions` and `economy` (updating season points).

3. **FriendsScreen Wiring**:
   - `FriendsScreen` expects `ScreenResource<FriendsView>`.
   - `useQuery` fetching `GET /api/referral/status` provides `PlayerReferralOverview`.
   - The SQL backend outputs `?start=ref_...` in `deepLink`. However, `isSafeTelegramInvite` strictly tests for `?startapp=ref_...`. Normalizing `?start=` to `?startapp=` ensures the copy button and safe invite validation succeed.
   - For `POST /api/referral/bind`, a mutation calling `postGameResource('/api/referral/bind', { referralCode, requestId })` is implemented. Because `FriendsScreen` visual components are frozen for Astra 6.0 and lack an input field, the mutation is exposed and wired to auto-bind Telegram start parameters if present, or ready for future UI hooks.

---

## 3. Caveats

1. **No Visual Changes Allowed**: `apps/web/src/screens/friends-screen.tsx` does not have a referral code input or `onBind` in `FriendsScreenProps`. As specified in Astra 6.0 visual freeze boundaries, UI elements are not added to `friends-screen.tsx`; the connection in `live-game.tsx` provides the mutation infrastructure and hooks.
2. **Deep Link Parameter Mismatch**: The backend migration `202609140007_game_loop_apis.sql` constructs `'https://t.me/EmpireBot?start=ref_' || code`. The web client must replace `?start=` with `?startapp=` to satisfy `isSafeTelegramInvite`.
3. **Response Envelope Flexibility**: Backend routes might return either raw arrays/objects or `{ apiVersion: 'v1', ... }` envelopes. Using `z.union` ensures the frontend handles both formats without failing schema validation.

---

## 4. Conclusion

Requirement R4 is fully scoped and verified:
1. `apps/web/src/game/live-game.tsx` can be completely wired using `@tanstack/react-query` mutations and queries without modifying any visual UI component.
2. All required endpoints (`POST /api/economy/claim`, `POST /api/economy/upgrade`, `GET /api/missions/active`, `POST /api/missions/:id/claim`, `GET /api/streak`, `GET /api/referral/status`, `POST /api/referral/bind`) map directly to existing `@empire/shared` DTOs and Zod schemas.
3. Live claimable earnings calculation enables the "Geliri topla" button.
4. Detailed implementation code and architectural survey are documented in `web_survey.md`.

---

## 5. Verification Method

1. **Typecheck across all workspace packages**:
   ```powershell
   pnpm -r typecheck
   ```
   Must exit with code 0.
2. **Execute entire unit and integration test suite**:
   ```powershell
   pnpm test
   ```
   Must pass all 232+ tests.
3. **Check Vite build**:
   ```powershell
   pnpm --filter @empire/web build
   ```
   Must bundle `apps/web` with exit code 0.
4. **Verify Deep Link Invariant in Vitest**:
   ```powershell
   pnpm vitest run apps/web/src/screens/friends-screen.test.ts
   ```
   Confirms `isSafeTelegramInvite` accepts the normalized referral URL format.
