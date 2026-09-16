# Scope: Step 8 (Telegram Stars Payments) & Step 9 (Admin Dashboard & Governance)

## Architecture

The system divides into 4 specialized, strictly isolated streams:

### Stream 1: Payment Backend & Webhook Security
- **Scope**: `apps/api/src/shop/`, `packages/shared/src/`
- **Key Modules**:
  - `apps/api/src/shop/store.ts`: `ShopStore` interface and `SupabaseShopStore` implementation (`getUserPass`, `createInvoice`, `fulfillPayment`, `getInvoice`, `findInvoiceByPayload`).
  - `apps/api/src/shop/routes.ts`: `createShopRoutes` handling:
    - `POST /shop/invoice`: Generate Stars invoice link with XTR currency, title, description, payload. Respects `feature.stars_payments` feature flag.
    - `POST /shop/webhook` & `POST /telegram/webhook`: Webhook handler validating `X-Telegram-Bot-Api-Secret-Token` (against `TELEGRAM_WEBHOOK_SECRET`).
    - `pre_checkout_query`: Validates payload, currency (`XTR`), invoice existence in `public.purchases`, pending state, and returns `answerPreCheckoutQuery` with `ok: true`.
    - `successful_payment`: Atomically marks invoice as paid, credits entitlements (Empire Pass, cosmetic badges), records transaction in `public.reward_ledger` (with 64-char hex SHA256 idempotency key, delta cash 0, delta SP 0), replay-safe via `telegram_payment_charge_id`.
    - `GET /shop/invoices/:id`: Status lookup endpoint returning `InvoiceStatusResponse`.
  - `packages/shared/src/index.ts`: DTO schemas (`invoiceStatusDtoSchema`, `invoiceStatusResponseSchema`, `telegramPreCheckoutQuerySchema`, `telegramSuccessfulPaymentSchema`).
  - `apps/api/src/shop/routes.test.ts` & `apps/api/src/shop/payment-stress.test.ts`: Integration and concurrency tests.

### Stream 2: Shop & Stars Mini App UI
- **Scope**: `apps/web/src/screens/shop-screen.tsx`, `apps/web/src/screens/shop-analytics.css`, `apps/web/src/game/`
- **Key Modules**:
  - `apps/web/src/screens/shop-screen.tsx`: Renders Telegram Stars shop items. If `feature.stars_payments` enabled, triggers purchase handler; if disabled, displays "Yakında" badge (`.sa-badge-soon`) and disables buy button ("Satışlar yakında").
  - `apps/web/src/game/live-game.tsx`: Evaluates `feature.stars_payments` via `GET /api/config/public`. Provides `handlePurchase` calling `POST /api/shop/invoice` and triggering `Telegram.WebApp.openInvoice(invoiceLink, callback)`.
  - Callback updates UI optimistically on `paid` status (activating pass locally, invalidating queries) and provides clear Turkish feedback on `cancelled`, `failed`, `pending`.
  - `apps/web/src/screens/shop-analytics.css`: Responsive styling with zero layout shift on 320px–390px mobile screens (min-height feedback banner, button clamps, badge height consistency).
  - `apps/web/src/telegram/types.ts`: Declares `openInvoice` on `TelegramWebApp`.

### Stream 3: Admin Backend & Governance
- **Scope**: `apps/api/src/config/`, `apps/api/src/fraud/`, `apps/api/src/admin/`, `supabase/migrations/`
- **Key Modules**:
  - Strict RBAC on all admin routes: Requires session belonging to `@Barandnz` or `@Mberked` or role = `superadmin`. Rejects unauthorized users with 403 `FORBIDDEN` and unauthenticated users with 401 `UNAUTHORIZED`.
  - `apps/api/src/config/routes.ts`: Enforces RBAC on `POST /admin/config`.
  - `apps/api/src/admin/routes.ts` & `store.ts`:
    - `GET /admin/feature-flags` & `POST /admin/feature-flags`: Dynamic toggles for `feature.stars_payments`, `feature.maintenance_mode`, `feature.referrals`, `economy.multiplier`. Idempotent updates with audit logging to `public.admin_audit_logs`.
    - `GET /admin/audit-logs`: Chronological feed of admin audit logs with diffs, usernames, timestamps, reasons.
    - `GET /admin/fraud/accounts`: Lists flagged suspicious accounts with risk scores.
    - `POST /admin/fraud/accounts/:id/unfreeze`: Unfreeze / resolve flagged accounts.
  - `supabase/migrations/`: Migration `202609140011_admin_governance.sql` if required for governance stored procedures or audit constraints.

### Stream 4: Admin UI Dashboard
- **Scope**: `apps/web/src/screens/admin-screen.tsx`, `apps/web/src/admin/`, `apps/web/src/shell/`
- **Key Modules**:
  - `apps/web/src/shell/admin-gate.ts`: Frontend admin access gating (`isDesignatedAdmin` normalizing username for `@Barandnz` and `@Mberked`). Hides admin UI completely from standard players.
  - `apps/web/src/screens/admin-screen.tsx`: Dedicated responsive operations console with:
    - Feature Flags Tab (`apps/web/src/admin/feature-flags-tab.tsx`): Real-time switches for `feature.stars_payments`, `feature.maintenance_mode`, `feature.referrals`.
    - Fraud Review Tab (`apps/web/src/admin/fraud-review-tab.tsx`): Queue of flagged accounts and frozen rewards with action buttons ("İncele", "Onayla", "Dondurmayı Kaldır").
    - Audit Log Tab (`apps/web/src/admin/audit-log-tab.tsx`): Chronological log feed with before/after diffs and reason notes.
  - `apps/web/src/admin/admin.css`: Scoped styling (`.admin-*`) utilizing Astra 6.0 CSS tokens without affecting player screens, mobile-responsive (360px+) and zero layout shift.

---

## Feature Inventory

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Invoice Generation API | `POST /shop/invoice` returns XTR currency invoice link & payload | Stream 1 | R1 Spec |
| 2 | Webhook Secret Verification | Validate `X-Telegram-Bot-Api-Secret-Token` header against `TELEGRAM_WEBHOOK_SECRET` | Stream 1 | R1 Spec |
| 3 | Pre-checkout Verification | `pre_checkout_query` verifies XTR, price, invoice existence & pending status | Stream 1 | R1 Spec |
| 4 | Atomic Payment Fulfillment & Ledger | `successful_payment` credits pass/badge, inserts `reward_ledger` with 64-hex SHA256 key, replay-safe | Stream 1 | R1 Spec |
| 5 | Invoice Status API | `GET /shop/invoices/:id` status lookup endpoint | Stream 1 | R1 Spec |
| 6 | Shop UI Feature Flag Gating | `ShopScreen` displays "Yakında" badge and disables purchase when `feature.stars_payments` is false | Stream 2 | R2 Spec |
| 7 | Telegram openInvoice Integration | Clicking purchase invokes `Telegram.WebApp.openInvoice` and handles `paid`, `cancelled`, `failed`, `pending` | Stream 2 | R2 Spec |
| 8 | Zero Layout Shift Mobile Shop | 320px–390px mobile layout stability with pre-reserved feedback banner and clamp styling | Stream 2 | R2 Spec |
| 9 | Strict Superadmin RBAC | Verify `@Barandnz`, `@Mberked`, or `role = 'superadmin'` on all admin endpoints (403 FORBIDDEN for non-admins) | Stream 3 | R3 Spec |
| 10 | Dynamic Feature Flag Management API | Toggles for `feature.stars_payments`, `feature.maintenance_mode`, `feature.referrals`, `economy.multiplier` with audit logs | Stream 3 | R3 Spec |
| 11 | Fraud Queue Review API | Endpoints to list flagged accounts with risk scores and approve, reject, or unfreeze accounts | Stream 3 | R3 Spec |
| 12 | Admin Web Dashboard UI | Dedicated responsive Admin Panel in `apps/web` with Feature Flags, Fraud Review, and Audit Log tabs | Stream 4 | R4 Spec |
| 13 | Admin UI Gating & Astra Theme | Admin screen hidden from standard players, styled with Astra 6.0 tokens, zero layout shift | Stream 4 | R4 Spec |
| 14 | Monorepo Quality Gate | Unit & integration tests for all 4 streams, `pnpm check` passes with 0 errors | QA / Gate | AC |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| S1 | Stream 1: Payment Backend & Webhook Security | `apps/api/src/shop/`, `packages/shared/src/` | Survey | IN_PROGRESS |
| S2 | Stream 2: Shop & Stars Mini App UI | `apps/web/src/screens/shop-screen.tsx`, `apps/web/src/screens/shop-analytics.css`, `apps/web/src/game/` | Survey | IN_PROGRESS |
| S3 | Stream 3: Admin Backend & Governance | `apps/api/src/config/`, `apps/api/src/fraud/`, `apps/api/src/admin/`, `supabase/migrations/` | Survey | IN_PROGRESS |
| S4 | Stream 4: Admin UI Dashboard | `apps/web/src/screens/admin-screen.tsx`, `apps/web/src/admin/`, `apps/web/src/shell/` | Survey | IN_PROGRESS |
| S5 | Quality Verification & Gate | Reviewers, Challengers, Forensic Auditor, Monorepo Check | S1, S2, S3, S4 | PLANNED |

---

## Interface Contracts

### Stream 1: Shop & Payments
- `POST /shop/invoice` & `POST /api/shop/invoice`:
  - Request: `{ sku: string, requestId: UUID }`
  - Response: `{ apiVersion: 'v1', sku: string, starsPrice: number, invoicePayload: string, invoiceLink: string }`
  - Errors: 400 `FEATURE_DISABLED` (when stars payments disabled), 400 `INVALID_SKU`, 401 `UNAUTHORIZED`
- `POST /shop/webhook` & `POST /telegram/webhook`:
  - Headers: `X-Telegram-Bot-Api-Secret-Token` (must match `TELEGRAM_WEBHOOK_SECRET` if set)
  - `pre_checkout_query`: checks `currency === 'XTR'`, invoice exists & pending -> `{ ok: true }`
  - `successful_payment`: credits pass / cosmetic, records in `public.reward_ledger` with 64-hex SHA256 key, idempotent on `telegram_payment_charge_id` -> `{ ok: true }`
- `GET /shop/invoices/:id` & `GET /api/shop/invoices/:id`:
  - Session auth required. Verifies invoice ownership.
  - Response: `InvoiceStatusResponse` (`{ apiVersion: 'v1', invoice: InvoiceStatusDto }`)

### Stream 3: Admin & Governance
- RBAC Guard: Session user must have `lower(username) in ('barandnz', 'mberked')` or `superadmin` role. Returns 403 `FORBIDDEN` if not authorized.
- `GET /admin/feature-flags` & `POST /admin/feature-flags`:
  - Request: `{ key: string, value: boolean | number, reason: string, requestId: UUID }`
  - Response: `{ apiVersion: 'v1', success: true, key: string, updatedValue: any, auditLogId: string }`
- `GET /admin/audit-logs`:
  - Query: `limit`, `offset`, `targetKey`
  - Response: `{ apiVersion: 'v1', logs: AdminAuditLogDto[], total: number }`
- `GET /admin/fraud/accounts`:
  - Response: `{ apiVersion: 'v1', accounts: FraudAccountDto[] }`
- `POST /admin/fraud/accounts/:id/unfreeze`:
  - Request: `{ reason: string }`
  - Response: `{ apiVersion: 'v1', success: true, userId: UUID }`
