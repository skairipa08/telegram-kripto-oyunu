## 2026-09-16T06:08:34Z
<USER_REQUEST>
You are teamwork_preview_worker_stream4, the implementation worker for Stream 4 (Admin UI Dashboard).
Your working directory is c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_stream4.
The project root is c:\Users\Administrator\Desktop\telegram kripto oyunu.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

READ THESE FIRST:
1. c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md
2. c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_orchestrator_7\SCOPE.md
3. c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_stream4\report.md

YOUR STRICT EXCLUSIVE WRITE SCOPE:
- apps/web/src/screens/admin-screen.tsx
- apps/web/src/admin/
- apps/web/src/shell/
- apps/web/src/game/game-layout.tsx (only for mounting admin navigation entrypoint if designated admin)
- apps/web/src/game/live-game.tsx (only for admin tab/view routing)
You MUST NOT modify files outside this scope.

TASKS TO COMPLETE:
1. In apps/web/src/shell/admin-gate.ts:
   - Implement normalizeAdminUsername and isDesignatedAdmin: checks if normalized username matches 'barandnz' or 'mberked'.
   - Add unit tests in apps/web/src/shell/admin-gate.test.ts.
2. In apps/web/src/admin/:
   - Create admin-types.ts, admin-api.ts, admin-ui.tsx.
   - Create feature-flags-tab.tsx: visual switches to toggle feature.stars_payments, feature.maintenance_mode, feature.referrals with reason dialog.
   - Create fraud-review-tab.tsx: visual table/card list of flagged accounts and frozen rewards with risk score pills (Green/Amber/Red) and quick action buttons (İncele, Onayla, Dondurmayı Kaldır).
   - Create audit-log-tab.tsx: chronological feed of recent administrative changes with diff pills and reasons.
   - Create admin.css: scoped Astra 6.0 styling (.admin-*), dark/light theme tokens, zero layout shift, mobile responsive (360px+) and desktop layouts.
3. In apps/web/src/screens/admin-screen.tsx:
   - Dedicated Admin Screen view integrating the 3 tabs, header with admin handle (@Barandnz / @Mberked), live status, and "Oyuna Dön" button.
   - Defense-in-depth: if !isDesignatedAdmin(user), render 403 Forbidden alert and block all admin controls.
4. In shell/game routing:
   - In GameLayout / live-game: if isDesignatedAdmin(user), show Admin entry point (e.g. in account dialog or topbar/rail). Standard players must have ZERO visual indication of admin UI.
5. In apps/web/src/admin/admin-screen.test.tsx:
   - Author comprehensive Vitest component tests testing 403 for regular users, admin panel rendering for @Barandnz / @Mberked, tab switching, feature flag toggles, fraud review actions, and audit log display.
6. Run tests and typechecks:
   - npx vitest run apps/web/src/admin/ apps/web/src/shell/
   - pnpm --filter @empire/web typecheck
7. Write your completed handoff report to c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_stream4\handoff.md.
When finished, send a message to parent summarizing what was built, test results, and file paths.
</USER_REQUEST>
