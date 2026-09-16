## 2026-09-16T06:01:50Z

Implement Step 8 (Telegram Stars payments, pass entitlements, webhook security, pre-checkout verification) and Step 9 (Admin dashboard UI, RBAC governance for @Barandnz and @Mberked, config feature flags, and audit logging) for Project Empire.

Integrity mode: demo

Architecture & Agent Boundary Constraints (Maximum 4 Concurrent Agents):
Work MUST divide into at most 4 specialized, strictly isolated streams:
1. Stream 1 - Payment Backend & Webhook Security Agent:
   Scope: apps/api/src/shop/, packages/shared/src/
   Only reads and modifies payment routing, invoice creation, Telegram webhook verification, and entitlement store.
2. Stream 2 - Shop & Stars Mini App UI Agent:
   Scope: apps/web/src/screens/shop-screen.tsx, apps/web/src/screens/shop-analytics.css, apps/web/src/game/
   Only reads and modifies shop view rendering, Telegram openInvoice trigger, purchase status feedback, and feature flag gate.
3. Stream 3 - Admin Backend & Governance Agent:
   Scope: apps/api/src/config/, apps/api/src/fraud/, apps/api/src/admin/, supabase/migrations/
   Only reads and modifies admin endpoints, RBAC enforcement (empire_admin_check_role for @Barandnz and @Mberked), feature flag store, and audit logging.
4. Stream 4 - Admin UI Dashboard Agent:
   Scope: apps/web/src/screens/admin-screen.tsx, apps/web/src/admin/, apps/web/src/shell/
   Only reads and modifies the visual admin management interface (feature flag switches, fraud review queue, system status KPIs).
