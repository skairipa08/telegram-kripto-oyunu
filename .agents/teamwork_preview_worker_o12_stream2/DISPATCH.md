## 2026-09-17T10:58:47Z

You are Worker Stream 2 (teamwork_preview_worker).

## Identity & Paths
- Your working directory: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_o12_stream2`
- Parent Orchestrator ID: `4fb5c810-ec2d-4451-a45c-639a7bf5c7c7`
- Project Workspace Root: `c:\Users\Administrator\Desktop\telegram kripto oyunu`
- Path to User Request: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md` (see timestamp section `## 2026-09-17T10:50:36Z`)
- Path to Project Architecture: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_orchestrator_12\PROJECT.md`
- Path to Stream 2 Explorer Handoff: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_o12_stream2\handoff.md`

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Exclusive File Ownership (Write Boundary)
You exclusively own and may modify ONLY these files:
- `apps/api/src/dev-store.ts`
- `apps/api/src/economy/routes.ts`
- `apps/web/src/screens/missions-screen.tsx`
- `apps/web/src/components/crypto-mines-game.tsx`
- `apps/web/src/screens/empire-screen.tsx`
- `apps/web/src/screens/arcade-screen.test.tsx`
- Any formatting updates on these or project files via prettier.
DO NOT TOUCH files owned by Worker 1 (`crypto-mines-model.test.ts`, `crypto-predictions-model.ts`, `crypto-predictions-model.test.ts`, `referral.test.ts`).

## Required Tasks:
1. **Fix Missions & Streak Schema in Dev Store (`apps/api/src/dev-store.ts`)**:
   - Line 504: Change `difficulty: 'medium'` to `difficulty: 'normal'` so that `missionDifficultySchema` passes.
   - Line 544: In `claimMission`, return both `rewardPoints: 100` and `rewardSeasonPoints: 100` (so `claimMissionResponseSchema` receives a positive integer for `rewardPoints`).
2. **Fix API Routes (`apps/api/src/economy/routes.ts`)**:
   - Line 554: Fallback `rewardPoints: Number(result.rewardPoints ?? result.rewardSeasonPoints ?? 50)`.
   - Add route alias for `GET /api/missions` and `GET /missions`: mount it with the same handler as `/missions/active` so `GET /api/missions` returns the active missions list.
3. **Fix Lifetime Missions UUIDs (`apps/web/src/screens/missions-screen.tsx`)**:
   - In `FALLBACK_LIFETIME_MISSIONS`, update `id` fields to valid UUIDs:
     - e.g. `'00000000-0000-4000-a000-000000000001'` through `'00000000-0000-4000-a000-000000000006'`.
     This prevents `claimMissionRequestSchema` UUID validation error when claiming lifetime missions.
4. **Fix ESLint Violations**:
   - `apps/web/src/components/crypto-mines-game.tsx`: remove unused `useEffect` from line 1 import.
   - `apps/web/src/screens/empire-screen.tsx`: prefix unused props with underscore `_previewMiniGame` and `_onPreviewMiniGameReward` (or remove them).
5. **Fix Vitest Tab Title Regression (`apps/web/src/screens/arcade-screen.test.tsx`)**:
   - Line 21: Update assertion `expect(markup).toContain('Şifre');` to `expect(markup).toContain('Deşifre');`.
6. **Prettier Formatting**:
   - Run `pnpm prettier --write` on the modified files to ensure `pnpm format:check` passes with 0 errors.
7. **Monorepo Health Gate Verification**:
   - Run: `pnpm typecheck` -> must be 0 errors.
   - Run: `pnpm lint` -> must be 0 errors.
   - Run: `pnpm format:check` -> must be 0 errors.
   - Run: `pnpm test` -> all tests must pass.
   - Run: `pnpm build` -> must succeed.
