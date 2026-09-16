# BRIEFING — 2026-09-14T19:48:40Z

## Mission
Investigate requirement R4 for Project Empire: front-end integration in apps/web (live-game.tsx, EmpireScreen, MissionsScreen, FriendsScreen).

## 🔒 My Identity
- Archetype: explorer
- Roles: read-only investigation, survey web frontend integration (R4)
- Working directory: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_survey4_web
- Original parent: 82aec71c-13f6-4003-bbe4-b8f70c98c261
- Milestone: survey4_web

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Investigate requirement R4 for Project Empire (apps/web live-game.tsx, EmpireScreen, MissionsScreen, FriendsScreen, endpoints, shared types)
- Write analysis to web_survey.md and handoff report to handoff.md
- Report back to parent agent via send_message

## Current Parent
- Conversation ID: 82aec71c-13f6-4003-bbe4-b8f70c98c261
- Updated: 2026-09-14T19:48:40Z

## Investigation State
- **Explored paths**:
  - `apps/web/src/game/live-game.tsx`
  - `apps/web/src/game/api.ts`
  - `apps/web/src/game/types.ts`
  - `apps/web/src/screens/empire-screen.tsx`
  - `apps/web/src/screens/missions-screen.tsx`
  - `apps/web/src/screens/friends-screen.tsx`
  - `apps/web/src/screens/friends-screen.test.ts`
  - `packages/shared/src/index.ts`
  - `supabase/migrations/202609140007_game_loop_apis.sql`
- **Key findings**:
  - `EmpireScreen` needs `onClaim` and `onUpgrade` handlers calling `POST /api/economy/claim` and `POST /api/economy/upgrade`. `claimable` must be dynamically computed so the claim button activates.
  - `MissionsScreen` expects `ScreenResource<MissionsView>`. Needs queries to `GET /api/missions/active` and `GET /api/streak`, and `onClaim` mutation to `POST /api/missions/:id/claim`.
  - `FriendsScreen` expects `ScreenResource<FriendsView>`. Requires deep link parameter normalization from `?start=ref_` to `?startapp=ref_` to pass `isSafeTelegramInvite`.
  - All DTOs and Zod schemas already exist in `@empire/shared`.
- **Unexplored areas**: None.

## Key Decisions Made
- Fully documented all screen contracts, queries, mutations, type mappings, and exact code modifications in `web_survey.md` and `handoff.md`.

## Artifact Index
- `DISPATCH.md` — Recorded dispatch message
- `progress.md` — Liveness heartbeat
- `web_survey.md` — Detailed survey analysis
- `handoff.md` — 5-component handoff report
