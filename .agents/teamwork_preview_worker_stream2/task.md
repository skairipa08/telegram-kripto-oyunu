# Worker Stream 2 Task: Empire Screen & City / Holding Experience

## Scope & Exclusive File Boundaries
You exclusively own and may edit:
- `apps/web/src/screens/empire-screen.tsx`
- `apps/web/src/screens/empire-missions.css`
- `apps/web/src/components/city-silhouette.tsx`

DO NOT modify files outside this scope.

## Context & Source of Truth
- Authoritative User Request: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md` (specifically `## 2026-09-17T09:38:35Z`)
- Explorer 1 Survey Report: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_survey_1\handoff.md`
- Master Project Blueprint: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_orchestrator_11\PROJECT.md`

## Concrete Deliverables
1. **16 Business Cards Glassmorphism & Tier Visuals (`empire-screen.tsx` & `empire-missions.css`)**:
   - Modernize card styles with cyber-holding glassmorphism: `background: linear-gradient(145deg, color-mix(in srgb, var(--surface) 92%, var(--accent) 4%), var(--surface-raised)); backdrop-filter: blur(10px); box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.06);`.
   - On `is-recommended` cards, apply `@keyframes neonBorderPulse` with continuous amber/gold aura.
   - Categorize the 16 businesses into 4 visual tiers (Local Amber/Bronze, Tech Cyan/Emerald, Quantum Violet, Space Hologram Gold) with distinct SVG silhouettes, icons, or gradient accents.
2. **Upgrade Celebration Burst & Level Badges (`empire-screen.tsx` & `empire-missions.css`)**:
   - On upgrade button click / success, trigger `.card-upgrade-burst` (momentary scale up and gold glow pulse) and animated level badge pop.
3. **Floating Gold Coin Trajectory (`empire-screen.tsx` & `empire-missions.css`)**:
   - On "Geliri topla" (claim offline cash) or periodic harvest, spawn floating gold coins traveling upwards along a Bezier trajectory towards the topbar wallet strip.
   - Display a floating text badge `+₺{formatNumber(claimedAmount, true)}` ascending with smooth opacity fade.
4. **Live Dynamic City Silhouette (`city-silhouette.tsx` & `empire-missions.css`)**:
   - Style `.city-orbit-one` and `.city-orbit-two` with rotating 3D elliptical orbits.
   - Animate skyline windows with `@keyframes windowFlicker` at staggered delays.
   - Add pulsating beacon light to radio towers at 60fps with pure CSS GPU acceleration.
   - Subtle atmospheric depth and ambient parallax.
5. **Mobile Responsiveness on 320px–390px**:
   - Ensure claim area and cards stack gracefully without horizontal scrolling or collision.

## Verification
- Run tests and lint: `pnpm check` (or packages/web test & typecheck)
- Confirm 0 errors and 0 regressions.
- Write handoff report to `.agents/teamwork_preview_worker_stream2/handoff.md`.
