## 2026-09-16T11:25:28Z
You are teamwork_preview_worker_stream2.
Your working directory is: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_stream2
Your identity: teamwork_preview_worker_stream2
Authoritative User Request: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md (MUST read the entire file, especially the latest section dated 2026-09-16T11:18:25Z).
Master Project Architecture: c:\Users\Administrator\Desktop\telegram kripto oyunu\PROJECT.md
Survey & UI Blueprint: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_survey_stream2\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE FILE OWNERSHIP (Only write/modify these files; do NOT touch backend or game-core packages):
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

OBJECTIVES & IMPLEMENTATION STEPS:
1. Implement apps/web/src/game/arcade-audio.ts:
   - Web Audio API zero-asset procedural sound synthesizer (tap, merge, crit chime, decrypt pulse, crash, win fanfare, mute toggle). No external audio files.
2. Implement apps/web/src/game/arcade-haptics.ts:
   - Telegram WebApp HapticFeedback integration (impactOccurred, notificationOccurred) with non-Telegram fallback.
3. Implement pure client models & unit tests in apps/web/src/game/:
   - catizen-merge-model.ts & test: 10+ tiers, passive rates, parcel spawn, auto-merge solver.
   - notcoin-tap-model.ts & test: energy regen, tap power scaling, crit rolls, upgrade curves, TapBot offline accumulator.
   - crypto-crash-model.ts & test: candlestick generation, multiplier curve, crash point generator, payout math.
4. Implement apps/web/src/components/arcade.css:
   - Astra 6.0 theme tokens, cyberpunk terminal scanlines, 3D perspective coin squish tilt classes, floating numbers trajectory physics, merge board grid, candlestick chart canvas, mobile responsiveness ensuring 0 horizontal overflow down to 320px (`minmax(0, 1fr)`).
5. Implement interactive game components:
   - CatizenMergeGame (catizen-merge-game.tsx): 4x3 living grid (12 slots), 10+ collectible emblems, drag/drop & click merge, particle burst, mystery parcel drops (15-20s), idle DPS counters, auto-bot toggle.
   - DynastyCipherGame (dynasty-cipher-game.tsx): Cyberpunk terminal styling, audio/visual decrypt pulse, combo multipliers (1.5x-3.0x), time-attack countdown, firewall progress bar. Re-export via micro-games.tsx to preserve backward compatibility.
   - NotcoinTapGame (notcoin-tap-game.tsx): 3D tactile squish coin with tilt physics, multi-touch listener, floating numbers (+1, +5 CRIT!), animated energy bar, dual-currency upgrade drawer (Cash & Telegram Stars), TapBot offline modal.
   - CryptoCrashGame (crypto-crash-game.tsx): 60fps real-time candlestick canvas chart, rising multiplier, stake selector, Boğa / Kârı Al button, win/crash animations, round history strip.
6. Implement standalone ArcadeScreen (arcade-screen.tsx), update EmpireArcade (empire-arcade.tsx) and design-preview.tsx.
7. Implement component tests in apps/web/src/screens/arcade-screen.test.tsx.
8. Run tests:
   - pnpm --filter @empire/web test
   Verify 100% green tests!

## 2026-09-17T09:44:35Z
You are Worker 2 for Project Empire Telegram Mini App.
Your working directory is: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_stream2

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

First, read the authoritative user request at:
c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md (specifically the latest request under ## 2026-09-17T09:38:35Z)

Also read:
- c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_survey_1\handoff.md
- c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_stream2\task.md
- c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_orchestrator_11\PROJECT.md

Your exclusive write boundaries:
- apps/web/src/screens/empire-screen.tsx
- apps/web/src/screens/empire-missions.css
- apps/web/src/components/city-silhouette.tsx
DO NOT edit files outside this scope.

Implement the Stream 2 requirements:
1. Visual overhaul of 16 business cards in empire-screen.tsx and empire-missions.css: cyber-holding glassmorphism, neon borders, distinct tier visual accents across all 16 businesses, and @keyframes neonBorderPulse for recommended cards.
2. Upgrade celebration burst: momentary scale pulse, neon glow, and animated level badge pop upon upgrading a business.
3. Floating gold coin trajectory animation (+₺1.4M) on "Geliri topla" claims and periodic revenue collection.
4. Live animated city skyline in city-silhouette.tsx: rotating 3D elliptical orbits, twinkling window lights, and pulsing radio tower beacons at 60fps GPU acceleration.
5. Mobile responsive layout verification for 320px-390px screens.

Run all relevant tests and typechecks using run_command (e.g. pnpm --filter @empire/web test, or pnpm check).
When finished, write your handoff report to:
c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_stream2\handoff.md
Send a completion message to the parent orchestrator.
