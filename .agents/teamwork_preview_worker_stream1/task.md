# Worker Stream 1 Task: Global Design System, Micro-Interactions & Navigation

## Scope & Exclusive File Boundaries
You exclusively own and may edit:
- `apps/web/src/styles.css`
- `apps/web/src/game/game-layout.tsx`
- `apps/web/src/app.tsx`
- `apps/web/src/components/animated-counter.tsx` (or other files in `apps/web/src/components/` needed for shared navigation/stats)

DO NOT modify files outside this scope.

## Context & Source of Truth
- Authoritative User Request: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md` (specifically `## 2026-09-17T09:38:35Z`)
- Explorer 1 Survey Report: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_survey_1\handoff.md`
- Master Project Blueprint: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_orchestrator_11\PROJECT.md`

## Concrete Deliverables
1. **Global CSS Animation System (`styles.css`)**:
   - Add keyframes: `@keyframes screenSlideFadeIn`, `@keyframes neonBorderPulse`, `@keyframes shimmerSweep`, `@keyframes balanceBump`, `@keyframes goldSpark`, `@keyframes haloBreathe`.
   - Add tactile spring feedback to all interactive elements (`.button`, `.primary-action`, `.secondary-action`, `.mobile-nav-item`, cards): `:active { transform: scale(0.96); transition: transform 0.1s cubic-bezier(0.34, 1.56, 0.64, 1); }`.
   - Ensure GPU acceleration (use `transform` and `opacity` only).
2. **Zero-CLS Screen Transitions (`game-layout.tsx` & `styles.css`)**:
   - On screen switch, animate `.game-content > *` with `screenSlideFadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;` (`translateY(6px) -> 0`, `opacity: 0 -> 1`).
   - Zero layout shift, no reflow.
3. **Active Tab Halo & Under-Bar (`styles.css` & `game-layout.tsx`)**:
   - Ensure `.mobile-nav-item` has `position: relative;`.
   - Upgrade active tab indicator with a bottom-curved neon under-bar and an ambient radial glow aura.
4. **Header Animated Number Counter (Odometer) & Gold Sparks (`game-layout.tsx` & `animated-counter.tsx`)**:
   - Implement `AnimatedCounter` component using `requestAnimationFrame` with a smooth 400-600ms ease-out curve.
   - On balance increase (`value > prevValue`), attach `.balance-bump` and spawn gold spark particles.
   - Calculate and display total empire level badge (`Lv.X`) in `.wallet-strip`.
5. **Mobile Specificity & CLS Fix on 320px screens (`styles.css`)**:
   - Fix specificity conflict with `.game-content .empire-claim-row` (reset `margin-right: 0` and allow vertical column stacking at `max-width: 420px`).
   - Topbar brand abbreviation (`E.`), compact avatar, and safe padding on screens `<= 359px` to eliminate horizontal scroll.

## Verification
- Run tests and lint: `pnpm check` (or packages/web test & typecheck)
- Confirm 0 errors and 0 regressions.
- Write handoff report to `.agents/teamwork_preview_worker_stream1/handoff.md`.
