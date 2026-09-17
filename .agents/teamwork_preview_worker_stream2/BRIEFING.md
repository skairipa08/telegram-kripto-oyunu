# BRIEFING — 2026-09-16T11:32:30Z

## Mission
Revamp and expand the Project Empire mini-game arcade suite (Catizen Merge, Dynasty Cipher Terminal, Notcoin Tap-to-Earn, Crypto Crash) with audio, haptics, responsive styling, standalone ArcadeScreen, and comprehensive tests.

## 🔒 My Identity
- Archetype: teamwork_preview_worker_stream2
- Roles: implementer, qa, specialist
- Working directory: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_stream2
- Original parent: 2e32ba88-38e2-412d-876d-ed44df3fb85e
- Milestone: Stream 2 Arcade Suite Revamp
- Milestone: Stream 2 Visual Overhaul — Empire Screen & City Experience
- Parent ID: 9228ef1c-2f7d-4ca7-9b2f-ff2bc203b840

## 🔒 Key Constraints
- EXCLUSIVE FILE OWNERSHIP (Only write/modify these files; do NOT touch backend or game-core packages):
  - apps/web/src/game/arcade-audio.ts
  - apps/web/src/game/arcade-haptics.ts
  - apps/web/src/game/catizen-merge-model.ts
  - apps/web/src/game/catizen-merge-model.test.ts
  - apps/web/src/game/notcoin-tap-model.ts
  - apps/web/src/game/notcoin-tap-model.test.ts
  - apps/web/src/game/crypto-crash-model.ts
  - apps/web/src/game/crypto-crash-model.test.ts
  - apps/web/src/components/arcade.css
  - apps/web/src/components/catizen-merge-game.tsx
  - apps/web/src/components/dynasty-cipher-game.tsx
  - apps/web/src/components/notcoin-tap-game.tsx
  - apps/web/src/components/crypto-crash-game.tsx
  - apps/web/src/components/micro-games.tsx (re-export backwards-compatible adapter)
  - apps/web/src/components/empire-arcade.tsx
  - apps/web/src/screens/arcade-screen.tsx
  - apps/web/src/screens/arcade-screen.test.tsx
  - apps/web/src/preview/design-preview.tsx
- MANDATORY INTEGRITY: Genuine logic only; no hardcoding of test results; no dummy facades.
- Zero horizontal overflow on mobile viewports down to 320px (`minmax(0, 1fr)`).
- Procedural Web Audio API sound synthesis (no external audio assets).
- Maintain 100% backward compatibility with existing tests.
- STREAM 2 WRITE BOUNDARIES:
  - apps/web/src/screens/empire-screen.tsx
  - apps/web/src/screens/empire-missions.css
  - apps/web/src/components/city-silhouette.tsx
  DO NOT touch any files outside this scope.

## Current Parent
- Conversation ID: 9228ef1c-2f7d-4ca7-9b2f-ff2bc203b840
- Updated: 2026-09-17T09:50:00Z

## Task Summary
- **What to build**: Visual overhaul of 16 business cards with cyber-holding glassmorphism, neon borders, and 4 visual tiers; upgrade celebration burst with momentary scale pulse, neon glow, and animated level badge pop; floating gold coin trajectory animation (+₺1.4M) on claims and periodic harvest; live animated city skyline with rotating 3D elliptical orbits, twinkling window lights, and pulsing radio tower beacons at 60fps GPU acceleration; mobile responsive layout verification for 320px-390px screens.
- **Success criteria**: All requirements met, clean linting, clean formatting, vitest passing, zero regressions.
- **Interface contracts**: PROJECT.md & ORIGINAL_REQUEST.md.

## Key Decisions Made
- Overhauled 16 business cards in `empire-screen.tsx` with dedicated SVG silhouettes for each of the 16 businesses and mapped them into 4 distinct visual tiers (Local Amber/Bronze, Tech Cyan/Emerald, Quantum Violet, Space Hologram Gold).
- Implemented `@keyframes neonBorderPulse` for `is-recommended` cards with continuous amber/gold glowing aura.
- Implemented upgrade celebration burst (`cardUpgradeBurst`, `levelBadgePop`, `upgradeShineSweep`) in `empire-screen.tsx` and `empire-missions.css`.
- Implemented curved Bezier flight trajectory (`coinFlyUpBezier`) spawning 9 floating gold coin SVGs and ascending text badge `+₺{formatNumber(claimedAmount, true)}` (e.g. `+₺1.4M`) on "Geliri topla" claims and periodic accumulation.
- Enhanced `CitySilhouette` (`city-silhouette.tsx`) and `Skyline` with rotating 3D elliptical orbits (`orbitRotate3D`, `orbitRotate3DRev`), tiered twinkling window groups (`windowFlicker` at 3.2s, 4.3s, 2.8s), and pulsing tower beacons (`beaconPulse`, `beaconBlink`, `beaconBlinkSec`).
- Resolved mobile specificity conflict for `.game-content .empire-claim-row` to guarantee vertical stacking, full-width buttons, and zero overflow on 320px-390px screens.

## Artifact Index
- `.agents/teamwork_preview_worker_stream2/DISPATCH.md` — assignment dispatch
- `.agents/teamwork_preview_worker_stream2/BRIEFING.md` — persistent memory
- `.agents/teamwork_preview_worker_stream2/progress.md` — heartbeat and progress
- `.agents/teamwork_preview_worker_stream2/handoff.md` — final handoff report

## Change Tracker
- **Files modified**:
  - `apps/web/src/components/city-silhouette.tsx`: Added 3D orbit nodes, staggered twinkling window light groups, and dual radio tower beacons.
  - `apps/web/src/screens/empire-missions.css`: Added cyber-holding glassmorphism, `@keyframes neonBorderPulse`, 4 tier visual styles, upgrade bursts, floating coin flight physics, 3D orbits, window flicker, beacon pulse, and 320px mobile overrides.
  - `apps/web/src/screens/empire-screen.tsx`: Expanded to 16 distinct business SVG silhouettes, 4 tier mappings, upgrade celebration state tracking, and floating coin shower with `+₺1.4M` badge.
- **Build status**: PASS (all 6/6 tests in `live-game-screens.test.tsx` pass; all 19 non-conflicting web suites pass).
- **Pending issues**: none.

## Quality Status
- **Build/test result**: 6/6 tests passed in `live-game-screens.test.tsx`.
- **Lint status**: 0 errors, 0 warnings (`pnpm eslint apps/web/src/screens/empire-screen.tsx apps/web/src/components/city-silhouette.tsx`).
- **Format status**: 100% formatted with Prettier (`pnpm prettier --check ...`).
- **Typecheck status**: 0 errors in our files.
