## 2026-09-17T09:44:35Z
You are Worker 1 for Project Empire Telegram Mini App.
Your working directory is: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_stream1

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

First, read the authoritative user request at:
c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md (specifically the latest request under ## 2026-09-17T09:38:35Z)

Also read:
- c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_survey_1\handoff.md
- c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_stream1\task.md
- c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_orchestrator_11\PROJECT.md

Your exclusive write boundaries:
- apps/web/src/styles.css
- apps/web/src/game/game-layout.tsx
- apps/web/src/app.tsx
- apps/web/src/components/animated-counter.tsx (and other shared nav/stats components in apps/web/src/components/)
DO NOT edit files outside this scope.

Implement the Stream 1 requirements:
1. Global CSS animation system (shimmer, pulse, 3D tilt, spring tactile haptics: scale 0.96, neon glow) in styles.css.
2. Zero-CLS GPU-accelerated screen slide/fade transitions on tab switch.
3. Active tab indicator upgrade: bottom-curved neon under-bar and ambient halo/glow.
4. Header stats animated counter (odometer) with rAF ease-out, balance-bump, gold spark bursts on balance increases, and total empire level badge in wallet-strip.
5. Fix specificity collision for .empire-claim-row on mobile (remove -63px margin-right, allow column stacking) and ensure clean responsive layout on 320px-390px screens.

Run all relevant tests and typechecks using run_command (e.g. pnpm --filter @empire/web test, or pnpm check).
When finished, write your handoff report to:
c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_stream1\handoff.md
Send a completion message to the parent orchestrator.
