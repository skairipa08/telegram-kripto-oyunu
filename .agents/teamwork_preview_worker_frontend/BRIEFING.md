# BRIEFING — 2026-09-14T23:03:00+03:00

## Mission
Implement Milestone M4 (Requirement R4 Frontend Live Game Connection) in apps/web/src/game/live-game.tsx without altering visual components or CSS.

## 🔒 My Identity
- Archetype: teamwork_preview_worker_frontend
- Roles: implementer, qa, specialist
- Working directory: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_frontend
- Original parent: 82aec71c-13f6-4003-bbe4-b8f70c98c261
- Milestone: M4 (Frontend Live Game Connection)

## 🔒 Key Constraints
- EXCLUSIVELY own: apps/web/src/game/live-game.tsx
- STRICT BOUNDARY: Do NOT modify visual components in `apps/web/src/screens/` or CSS styles (strictly preserved for Astra 6.0).
- Do NOT touch backend or migrations.
- Genuine implementations only, no cheating or hardcoding test results.

## Current Parent
- Conversation ID: 82aec71c-13f6-4003-bbe4-b8f70c98c261
- Updated: 2026-09-14T23:03:00+03:00

## Task Summary
- **What to build**: Full wire-up in `apps/web/src/game/live-game.tsx` for EmpireScreen (live claimable calc, onClaim, onUpgrade), MissionsScreen (active missions, streak, onClaim), FriendsScreen (referral overview, url normalization for safe link, bindReferralMutation).
- **Success criteria**:
  - `apps/web/src/game/live-game.tsx` connects real endpoints with proper mutation/query invalidations.
  - Safe Telegram invite normalization (`?startapp=ref_...`).
  - Claimable production formula accurate, reactive, bounded by offline cap.
  - Typecheck, build, lint, format, and tests pass.
- **Interface contracts**: PROJECT.md, packages/contracts, apps/web/src/screens/*.tsx
- **Code layout**: apps/web/src/game/live-game.tsx

## Key Decisions Made
- Implemented `postGameResource` helper locally in `apps/web/src/game/live-game.tsx` with same-origin credentials, 8s timeout, and ApiError normalization to avoid editing `api.ts`.
- Structured response parsers using `@empire/shared` Zod schemas to handle both envelope formats and raw arrays without requiring a direct `zod` dependency in `apps/web/package.json`.
- Implemented reactive 1-second interval to compute live `claimable` earnings so player cash visibly accumulates on screen.
- Deep link sanitization replaces `?start=` with `?startapp=` to strictly satisfy `isSafeTelegramInvite` in `friends-screen.tsx`.

## Artifact Index
- `apps/web/src/game/live-game.tsx` — Frontend live game screen router, queries, mutations, and live calculations

## Change Tracker
- **Files modified**: `apps/web/src/game/live-game.tsx` (fully wired Empire, Missions, and Friends screens with real game loop APIs)
- **Build status**: `pnpm --filter @empire/web build` passed (192 modules, 2.46s)
- **Pending issues**: None

## Quality Status
- **Build/test result**: `pnpm -r typecheck` passed (4/4 packages); `pnpm test` passed (25 files, 232 tests)
- **Lint status**: `pnpm eslint apps/web` clean (0 errors, 0 warnings); Prettier check clean
- **Tests added/modified**: Verified against existing suite including `friends-screen.test.ts`

## Loaded Skills
- None
