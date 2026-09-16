# BRIEFING — 2026-09-14T19:47:40Z

## Mission
Investigate requirements R1 and R2 for Project Empire: survey Supabase migration 202609140007_game_loop_apis.sql, EconomyStore 8 methods in apps/api/src/economy/store.ts, shared Zod schemas in packages/shared/src/index.ts, auth and route structures in apps/api (economy/routes.ts, auth/routes.ts, index.ts), and detail implementation plans for economy routes and new route modules mounted at / and /api.

## 🔒 My Identity
- Archetype: explorer
- Roles: Teamwork explorer (Read-only investigation: analyze problems, synthesize findings, produce structured reports)
- Working directory: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_survey4_api
- Original parent: 82aec71c-13f6-4003-bbe4-b8f70c98c261
- Milestone: Survey 4 - API & Economy Store

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Inspect existing files in supabase, apps/api, packages/shared
- Write findings to apps_api_survey.md and handoff.md in working directory
- Send completion message to parent (82aec71c-13f6-4003-bbe4-b8f70c98c261)

## Current Parent
- Conversation ID: 82aec71c-13f6-4003-bbe4-b8f70c98c261
- Updated: 2026-09-14T19:47:40Z

## Investigation State
- **Explored paths**:
  - `supabase/migrations/202609140007_game_loop_apis.sql` (all 632 lines inspected)
  - `apps/api/src/economy/store.ts` (all 296 lines inspected)
  - `packages/shared/src/index.ts` (all 594 lines inspected)
  - `apps/api/src/economy/routes.ts` (all 205 lines inspected)
  - `apps/api/src/auth/routes.ts` (all 207 lines inspected)
  - `apps/api/src/index.ts` (all 107 lines inspected)
  - `apps/api/src/auth/test-db.ts` (all 158 lines inspected)
  - `apps/web/src/game/live-game.tsx` and `apps/web/src/game/types.ts`
- **Key findings**:
  - Migration 202609140007 defines 8 RPCs with Security Definer restricted to `service_role`.
  - `EconomyStore` interface in `apps/api/src/economy/store.ts` already contains all 8 corresponding methods.
  - Zod schemas exist in `packages/shared/src/index.ts` (`claimCashRequestSchema`, `claimCashResponseSchema`, `upgradeBusinessRequestSchema`, `upgradeBusinessResponseSchema`, `bindReferralRequestSchema`, `bindReferralResponseSchema`, `claimMissionRequestSchema`, `claimMissionResponseSchema`, `playerStreakDtoSchema`, etc.).
  - Auth extraction uses `sessionCookie` on `__Host-empire_session` cookie header and `getCurrentUserSession`.
  - Route mounting in `apps/api/src/index.ts` mounts route groups at both `/` and `/api` prefixes (`app.route('/', router)` and `app.route('/api', router)`).
  - All 8 new endpoints can be consolidated directly into `apps/api/src/economy/routes.ts` without modifying `AppStoreFactories`, ensuring seamless backward compatibility and test harness simplicity.
- **Unexplored areas**: None for API survey scope.

## Key Decisions Made
- Fully documented exact route implementations and test harnesses in `apps_api_survey.md`.
- Prepared 5-component handoff report in `handoff.md`.

## Artifact Index
- `DISPATCH.md` — Log of incoming dispatch messages
- `BRIEFING.md` — Situational awareness and working memory
- `progress.md` — Liveness heartbeat and progress tracking
- `apps_api_survey.md` — Comprehensive survey analysis report
- `handoff.md` — Self-contained 5-component handoff report
