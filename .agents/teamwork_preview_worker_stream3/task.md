# Worker Stream 3 Task: Arcade Suite "Game Juice" & Particle FX

## Scope & Exclusive File Boundaries
You exclusively own and may edit:
- `apps/web/src/components/arcade.css`
- `apps/web/src/components/catizen-merge-game.tsx`
- `apps/web/src/components/crypto-crash-game.tsx`
- `apps/web/src/components/notcoin-tap-game.tsx`
- `apps/web/src/components/dynasty-cipher-game.tsx`

DO NOT modify files outside this scope.

## Context & Source of Truth
- Authoritative User Request: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md` (specifically `## 2026-09-17T09:38:35Z`)
- Explorer 2 Survey Report: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_survey_2\handoff.md`
- Master Project Blueprint: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_orchestrator_11\PROJECT.md`

## Concrete Deliverables
1. **Notcoin Tap Game (`notcoin-tap-game.tsx` & `arcade.css`)**:
   - 3D Dynamic Squish Tilt: Calculate perspective tilt from touch offset relative to coin center (`perspective(600px) rotateX(...) rotateY(...) scale3d(...)`), spring rebound on release.
   - Multi-Touch & "CRIT! +50" Sparks: Handle multi-finger tapping cleanly. Implement a lightweight Canvas particle pool or GPU CSS particles for normal sparks and 360-degree critical hit sparks.
   - Neon Flow Wave Energy Bar: Add travelling gradient `@keyframes neonEnergyWave` with glowing photon tip and low-energy pulsing warning.
2. **Catizen Merge Game (`catizen-merge-game.tsx` & `arcade.css`)**:
   - Merge Confetti & Star Explosion: When two items merge, emit a burst of stars/confetti and a ripple shockwave on the destination slot.
   - Box Drop Shake & Rumble: When a parcel lands, animate an entry drop, slot rumble impact (`@keyframes parcelRumble`), and unboxing glow.
   - Distinct Cyber-Luxe Gradients for 100 Levels: Implement dynamic hue cycling / prestige eras for tiers so every level up to 100 has distinct gradient styling and glow aura.
3. **Crypto Crash Game (`crypto-crash-game.tsx` & `arcade.css`)**:
   - Rocket Thruster / Plasma Trail: Draw an animated rocket icon or fiery plasma particle trail following the climbing chart curve on the Canvas.
   - Tension Heartbeat Pulse: As the multiplier escalates, pulse the HUD border / background with an accelerating heartbeat rhythm.
   - Screen Shake & FX: Trigger screen shake and dramatic red mist on crash, and celebratory victory flash & confetti on cashout.
4. **Dynasty Cipher Game (`dynasty-cipher-game.tsx` & `arcade.css`)**:
   - Matrix Character Streams: Render subtle falling digital rain / streaming hex glyphs in the background.
   - Glitch & Decode Surge: Add chromatic aberration / terminal glitch effect on keystrokes and an intense neon decode sweep across the terminal upon solving a sequence.
5. **Performance & Responsiveness**:
   - 60fps GPU acceleration, DPR-clamped canvas, clean up loops and event listeners on unmount. Ensure full mobile responsiveness on 320px-390px screens.

## Verification
- Run tests and lint: `pnpm vitest run apps/web/src/screens/arcade-screen.test.tsx` and monorepo checks.
- Confirm 0 errors and 0 regressions.
- Write handoff report to `.agents/teamwork_preview_worker_stream3/handoff.md`.
