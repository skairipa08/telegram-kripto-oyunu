# BRIEFING — 2026-09-15T11:28:30Z

## Mission
Investigate the existing codebase for how referrals and qualification milestones are structured for R3 (Qualified Referral Progression & Referrer Rewards).

## 🔒 My Identity
- Archetype: Explorer
- Roles: Teamwork explorer (read-only investigation, synthesis)
- Working directory: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_survey6_referrals_rep
- Original parent: 3219366b-6e17-4215-806c-8fc42e4d3c7f
- Milestone: Survey 6 - Referrals & Qualification Milestones (R3)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Scope: Check packages/game-core, apps/api, database tables, schemas, event hooks, qualification milestones (activation, retained_d2, retained_d7, progression), referral_events, reward crediting, invite counts/badges/tier stats.
- Output handoff.md with 5 components: Observation, Logic Chain, Caveats, Conclusion, Verification Method.

## Current Parent
- Conversation ID: 3219366b-6e17-4215-806c-8fc42e4d3c7f
- Updated: 2026-09-15T11:28:30Z

## Investigation State
- **Explored paths**:
  - `ORIGINAL_REQUEST.md` (Sections 2026-09-14T12:03:51Z, 2026-09-14T17:53:29Z, 2026-09-14T19:27:24Z, 2026-09-15T06:14:17Z, 2026-09-15T07:19:14Z R3)
  - `packages/game-core/src/referral.ts` & `referral.test.ts`
  - `packages/game-core/src/formulas.ts` (`calculateReferralWhaleFactor`)
  - `packages/game-core/src/fraud.ts` (`evaluateReferralGraphAndAbuse`)
  - `packages/game-core/src/analytics.ts` (`calculateRetentionCohorts`)
  - `packages/shared/src/index.ts` (referral DTOs, schemas, events)
  - `apps/api/src/economy/routes.ts` & `store.ts`
  - `apps/api/src/auth/routes.ts`, `store.ts`, `test-db.ts`
  - `apps/api/src/fraud/test-db.ts`
  - `apps/api/src/leaderboard/routes.ts` & `store.ts`
  - `supabase/migrations/202609140001` through `202609140008`
  - `apps/web/src/screens/friends-screen.tsx`, `types.ts`, `live-game.tsx`
  - Peer handoffs and surveys in `.agents/`
- **Key findings**:
  1. Pure math and milestone logic is 100% complete in `packages/game-core/src/referral.ts`.
  2. Database tables `public.referrals` and `public.referral_events` exist from `0004`, but lack `is_qualified` and `qualified_at` columns (previously only patched in test-db).
  3. API currently only exposes `POST /referral/bind` and `GET /referral/status`. Missing endpoint for `POST /referral/claim` (claiming milestone rewards) although schemas `claimReferralRewardRequestSchema` and `claimReferralRewardResponseSchema` already exist in `@empire/shared`.
  4. No event hooks currently exist in `POST /economy/upgrade` or `POST /economy/claim` to trigger milestone evaluations.
  5. Badges are dynamic, not a DB table. Two naming conventions exist (`badge_early_connector` in game-core vs `recruiter` in integration test).
- **Unexplored areas**: None for this survey scope.

## Key Decisions Made
- Documented full mapping of all 6 survey points with exact file paths, line numbers, and architectural proposals for implementation in `handoff.md`.

## Artifact Index
- DISPATCH.md — Initial prompt dispatch record
- BRIEFING.md — Working memory and status
- progress.md — Liveness progress log
- handoff.md — Final 5-component handoff report
