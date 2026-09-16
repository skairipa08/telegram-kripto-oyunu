## 2026-09-14T19:39:34Z

You are teamwork_preview_explorer_survey4_web.
Your working directory is: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_survey4_web
The project workspace is: c:\Users\Administrator\Desktop\telegram kripto oyunu
You MUST read the authoritative user request at: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md

Mission:
Investigate requirement R4 for Project Empire:
1. Inspect `apps/web/src/game/live-game.tsx` and related components in `apps/web/src/`:
   - `EmpireScreen` (where business cards, upgrades, and claim buttons live)
   - `MissionsScreen` (where daily/weekly missions and claim buttons live)
   - `FriendsScreen` (where referral link, bind input, and stats live)
2. Determine:
   - What props each of these screens expects (e.g. `onClaim`, `onUpgrade`, active missions, claimMission handler, referral status, bindReferral handler).
   - How `live-game.tsx` currently fetches data (React Query / TanStack Query or native fetch), how auth cookies are sent (`credentials: 'include'`), and how state is updated or invalidated on mutations.
   - Exact code modifications needed in `apps/web/src/game/live-game.tsx` to:
     - Pass `onClaim` and `onUpgrade` handlers to `EmpireScreen` calling `POST /economy/claim` and `POST /economy/upgrade`.
     - Wire `MissionsScreen` to `GET /api/missions/active` and `POST /api/missions/:id/claim`.
     - Wire `FriendsScreen` to `GET /api/referral/status` and `POST /api/referral/bind`.
3. Check type compatibility and imports from `@empire/shared`.
4. Write your detailed analysis to `web_survey.md` and complete handoff report in `handoff.md` in your working directory. Send a message to your parent when done.
