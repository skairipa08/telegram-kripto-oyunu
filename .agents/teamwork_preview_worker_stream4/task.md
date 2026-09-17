# Worker Stream 4 Task: Social, Missions, Shop & Celebration Modals

## Scope & Exclusive File Boundaries
You exclusively own and may edit:
- `apps/web/src/screens/friends-screen.tsx`
- `apps/web/src/screens/missions-screen.tsx`
- `apps/web/src/screens/shop-screen.tsx`
- `apps/web/src/screens/clans-screen.tsx`
- `apps/web/src/screens/social.css`
- `apps/web/src/screens/shop-analytics.css`
- `apps/web/src/components/celebration-modal.tsx` (new component for universal celebrations)

DO NOT modify files outside this scope.

## Context & Source of Truth
- Authoritative User Request: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md` (specifically `## 2026-09-17T09:38:35Z`)
- Explorer 3 Survey Report: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_survey_3\handoff.md`
- Master Project Blueprint: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_orchestrator_11\PROJECT.md`

## Concrete Deliverables
1. **Streak & Milestones (`missions-screen.tsx`, `social.css`, `arcade.css`)**:
   - Render a glowing neon energy ribbon / path connecting milestone nodes (7d, 30d, 90d, 180d, 365d).
   - Wire up daily streak claim action with chest unlock celebration animation and particle burst.
   - Preserve all existing CSS classes (`missions-milestones-track`, `milestone-card`, `is-achieved`, `is-target`, `is-locked`) and labels for test compatibility.
2. **Referral / Partnership ("Kasaya Aktar" & Badges in `friends-screen.tsx`, `social.css`)**:
   - Upgrade "Kasaya Aktar" button with `.kickback-claim-glow`, gold radial gradient, continuous light sweep, and celebratory reward trigger.
   - Add metallic shimmer to the ‰1 (1/1000) partnership badge and milestone tier chips.
3. **Clans / Cartels Podium & Auras (`clans-screen.tsx`, `social.css`)**:
   - Transform clan leaderboard to include an Olympic 3-pedestal podium (#1 Gold with crown, #2 Silver, #3 Bronze) with metallic glowing auras.
   - Add clan level-up progress bar and visual flare in my_clan view.
4. **Stars Shop Hologram & Cyber-Gold Shine (`shop-screen.tsx`, `shop-analytics.css`)**:
   - Add luxury cyber-gold shine sweep and iridescent holographic reflection on Empire Pass and cosmetic item cards.
   - Preserve all existing button classes and test labels (`sa-pass-card`, `sa-buy-button`, `sa-cosmetic-card`).
5. **Universal Celebration Modal (`celebration-modal.tsx`)**:
   - Build a lightweight, reusable celebration modal with HTML5 Canvas confetti engine (50-70 physics particles, 60fps, self-terminating, zero memory leaks).
   - Trigger it on streak claim, referral cash transfer, or mission completion.
6. **Mobile Responsiveness on 320px–390px**:
   - Ensure clean wrapping, touch targets >= 44px, zero horizontal overflow.

## Verification
- Run tests and lint: `pnpm vitest run apps/web/src/screens/missions-milestones.test.tsx apps/web/src/screens/shop-screen.test.tsx` and monorepo checks.
- Confirm 0 errors and 0 regressions.
- Write handoff report to `.agents/teamwork_preview_worker_stream4/handoff.md`.
