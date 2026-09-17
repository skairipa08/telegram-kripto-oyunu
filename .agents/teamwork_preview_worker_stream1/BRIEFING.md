# BRIEFING — 2026-09-17T09:54:00Z

## Mission
Deliver Stream 1 for Project Empire: Global CSS animation system, zero-CLS GPU screen slide/fade transitions, active tab halo/under-bar upgrade, topbar animated counter (odometer) with balance bump & gold spark bursts and total empire level badge, and 320px mobile layout fixes.

## 🔒 My Identity
- Archetype: Worker 1 (Stream 1)
- Roles: implementer, qa, specialist
- Working directory: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_stream1
- Original parent: 9228ef1c-2f7d-4ca7-9b2f-ff2bc203b840
- Milestone: M1 (Stream 1)

## 🔒 Key Constraints
- Exclusive write boundaries:
  - apps/web/src/styles.css
  - apps/web/src/game/game-layout.tsx
  - apps/web/src/app.tsx
  - apps/web/src/components/animated-counter.tsx (and other shared nav/stats in components/ if needed)
- DO NOT edit files outside this scope!
- Integrity Mandate: genuine implementations only, no hardcoded cheats/facades.
- Maintain full TypeScript & test compatibility (SSR safety with react-dom/server).

## Current Parent
- Conversation ID: 9228ef1c-2f7d-4ca7-9b2f-ff2bc203b840
- Updated: 2026-09-17T09:54:00Z

## Task Summary
- **What to build**: Global keyframes & spring tactile feedback in styles.css; zero-CLS screenSlideFadeIn transitions; active tab indicator with neon under-bar and halo glow; animated number odometer with rAF ease-out, balance-bump, and gold sparks; total empire level badge in wallet-strip; specificity & mobile fix for .empire-claim-row on 320px.
- **Success criteria**: pnpm check (or pnpm test/build) passes with 0 errors; no regressions; zero horizontal overflow on 320px screens.
- **Interface contracts**: PROJECT.md & ORIGINAL_REQUEST.md
- **Code layout**: apps/web/src/

## Change Tracker
- **Files modified**:
  - pps/web/src/styles.css: Global keyframes, spring tactile feedback, active tab under-bar/halo, animated counter/sparks, wallet pills, 420px claim-row specificity fix, 359px overflow prevention.
  - pps/web/src/game/game-layout.tsx: Wired AnimatedCounter for cash/points, total empire level badge, screen-transition-pane container on tab change, active tab indicators.
  - pps/web/src/components/animated-counter.tsx: Lightweight rAF ease-out odometer component with balance-bump & gold spark particles.
  - pps/web/src/components/animated-counter.test.tsx: 9 comprehensive unit tests verifying SSR rendering, compact values, null handling, level badge, screen transitions, and active nav indicators.
- **Build status**: PASS (Vite build in 6.23s, 66 test suites & 770 vitest tests passing)
- **Pending issues**: None

## Quality Status
- **Build/test result**: All 770 tests pass (0 failures, 0 regressions)
- **Lint status**: Clean (eslint exits code 0, prettier check on Stream 1 files exits code 0)
- **Tests added/modified**: 9 new unit tests in pps/web/src/components/animated-counter.test.tsx

## Loaded Skills
None

## Key Decisions Made
- Used requestAnimationFrame with SSR-safe checks in AnimatedCounter.
- Implemented GPU-accelerated CSS transforms and opacities for all transitions and spring tactile animations.
- Bound total empire level cleanly with fallback derivation from season points when level prop is omitted.
- Used specificity override !important at @media (max-width: 420px) to defeat desktop/tablet flex overrides on .empire-claim-row.
