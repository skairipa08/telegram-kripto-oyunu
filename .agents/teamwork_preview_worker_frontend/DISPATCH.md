## 2026-09-14T19:52:14Z

You are teamwork_preview_worker_frontend.
Your working directory is: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_frontend
The project workspace is: c:\Users\Administrator\Desktop\telegram kripto oyunu
You MUST read the authoritative user request at: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md
Read the project architecture and specifications in: c:\Users\Administrator\Desktop\telegram kripto oyunu\PROJECT.md
Read the detailed survey report:
- c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_survey4_web\web_survey.md
- c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_survey4_web\handoff.md

FILE OWNERSHIP:
You EXCLUSIVELY own:
- apps/web/src/game/live-game.tsx
STRICT BOUNDARY: Do NOT modify visual components in `apps/web/src/screens/` or CSS styles (strictly preserved for Astra 6.0). Do NOT touch backend or migrations.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Mission:
Implement Milestone M4 (Requirement R4 Frontend Live Game Connection):
1. In `apps/web/src/game/live-game.tsx`:
   - Wire `EmpireScreen`:
     - Implement `onClaim` callback calling `POST /api/economy/claim` via mutation with `{ requestId: crypto.randomUUID() }`. On success, invalidate economy query.
     - Implement `onUpgrade` callback `(slug: string) => void` calling `POST /api/economy/upgrade` with `{ businessSlug: slug, requestId: crypto.randomUUID() }`. On success, invalidate economy query.
     - Pass `onClaim` and `onUpgrade` to `EmpireScreen`.
     - Calculate live `claimable` earnings so the "Geliri topla" button activates when cash is ready to claim:
       Compute elapsed seconds since `min(lastClaimAt)` across active businesses (`level > 0`), bounded by `offlineCapSeconds`, multiplied by `totalProductionPerSecond`.
   - Wire `MissionsScreen`:
     - Query `GET /api/missions/active` via `useQuery`.
     - Query `GET /api/streak` via `useQuery`.
     - Map active missions (`PlayerMissionInstance`) and streak to `MissionsView = { streak: number, missions: MissionView[] }`.
     - Implement `onClaim` callback `(id: string) => void` calling `POST /api/missions/:id/claim` via mutation with `{ missionInstanceId: id, requestId: crypto.randomUUID() }`. On success, invalidate missions and economy queries.
     - Pass resource and `onClaim` to `MissionsScreen`.
   - Wire `FriendsScreen`:
     - Query `GET /api/referral/status` via `useQuery` (`PlayerReferralOverview`).
     - Map to `FriendsView`.
     - CRITICAL INVARIANT: The backend deep link might use `?start=ref_...`. In `live-game.tsx`, normalize the URL to `?startapp=ref_...` so `isSafeTelegramInvite(data.link)` in `friends-screen.tsx` evaluates to `true` (enabling the copy button and safe invite status).
     - Implement `bindReferralMutation` calling `POST /api/referral/bind` with `{ referralCode, requestId: crypto.randomUUID() }`. On success, invalidate referral and economy queries.
     - Pass resource to `FriendsScreen`.

2. Verification:
   - Run `pnpm --filter @empire/web typecheck`
   - Run `pnpm --filter @empire/web build`
   - Run `pnpm vitest run apps/web/src/screens/friends-screen.test.ts`
   - Document changes and verification results in `handoff.md`.
   - Notify parent when done.
