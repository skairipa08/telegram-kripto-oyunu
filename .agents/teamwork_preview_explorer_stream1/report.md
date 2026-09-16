# Stream 1 Investigation Report: Telegram Stars Shop & Payment Backend (Requirement R1)

**Agent**: `teamwork_preview_explorer_stream1`  
**Working Directory**: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_stream1`  
**Isolation Scope**: `apps/api/src/shop/`, `packages/shared/src/`, with read-only inspection of `apps/api/src/index.ts` and `apps/api/src/auth/test-db.ts`  
**Date**: 2026-09-16  

---

## 1. Observation

### 1.1 Existing Files in `apps/api/src/shop/`
The directory contains four files totaling 720 lines of code and tests:

| File Path | Lines | Size | Purpose / Observations |
|---|---|---|---|
| `apps/api/src/shop/store.ts` | 106 | 2,626 B | Defines `UserPassStatus`, `CreatedInvoice`, `FulfillPaymentResult`, the `ShopStore` interface, and `SupabaseShopStore` implementation making Supabase REST RPC calls (`empire_shop_get_pass`, `empire_shop_create_invoice`, `empire_shop_fulfill_payment`). |
| `apps/api/src/shop/routes.ts` | 251 | 7,560 B | Hono router factory `createShopRoutes`. Mounts `GET /shop`, `POST /shop/invoice`, and `POST /telegram/webhook`. |
| `apps/api/src/shop/routes.test.ts` | 305 | 9,282 B | Vitest integration test suite (6 tests). Verifies catalog auth, catalog invariants, invoice generation, P2W SKU rejection, pre-checkout currency check, and payment fulfillment idempotency. |
| `apps/api/src/shop/payment-stress.test.ts` | 348 | 11,624 B | Vitest concurrency & stress suite (4 tests). Tests 10 concurrent racing webhooks, forged payload rejection, additive duration stacking (30d + 30d = 60d), and anti-P2W guardrails across 6 malicious SKUs. |

**Current Test Status**: All 10 tests across `apps/api/src/shop/` pass cleanly in Vitest (`v3.2.7`).

### 1.2 Existing DTOs and Schemas in `packages/shared/src/index.ts`
Located between lines 365 and 434:

- **`shopSkuDtoSchema`** (Lines 365–377):
  - Validates `sku` enum: `'convenience_pass_30d' | 'cosmetic_frame_gold' | 'cosmetic_emblem_founder'`.
  - Fields: `name` (string), `description` (string), `starsPrice` (positive int), `type` (`'pass' | 'cosmetic'`), `durationDays` (optional positive int).
- **`conveniencePassDtoSchema`** (Lines 379–388):
  - Fields: `isActive` (boolean), `expiresAt` (ISO datetime nullable), `offlineCapSeconds` (positive int, 43200 vs 14400), `upgradeQueueSlots` (positive int, 3 vs 1), `missionRerolls` (positive int, 3 vs 1), `autoClaimEnabled` (boolean), `seasonPointsMultiplier` (nonnegative number, locked to 1.0).
- **`shopCatalogResponseSchema`** (Lines 390–395):
  - Fields: `apiVersion: 'v1'`, `skus: ShopSkuDto[]`, `pass: ConveniencePassDto`.
- **`createInvoiceRequestSchema`** (Lines 397–403):
  - Strict schema: `sku` (string, 1–64 chars), `requestId` (UUID).
- **`createInvoiceResponseSchema`** (Lines 405–412):
  - Fields: `apiVersion: 'v1'`, `sku` (string), `starsPrice` (positive int), `invoicePayload` (string), `invoiceLink` (string).
- **`fulfillPaymentRequestSchema`** (Lines 414–422):
  - Strict schema: `telegramPaymentChargeId` (1–256 chars), `invoicePayload` (16–128 chars), `starsAmount` (positive int), `sku` (optional string).
- **`fulfillPaymentResponseSchema`** (Lines 424–433):
  - Fields: `apiVersion: 'v1'`, `success` (boolean), `duplicate` (boolean), `purchaseId` (UUID), `newPassExpiresAt` (ISO datetime nullable).

### 1.3 Database Schema & Invariants (`supabase/migrations/`)
- **`public.purchases`** (`202609140005_step7_to_11_backend.sql`, lines 23–37):
  - Columns: `id` (uuid pk), `user_id` (uuid references users), `telegram_payment_charge_id` (text unique), `invoice_payload` (text unique, 16–128 chars), `sku` (check in `'convenience_pass_30d'`, `'cosmetic_frame_gold'`, `'cosmetic_emblem_founder'`), `stars_amount` (int > 0), `status` (text check in `'pending'`, `'completed'`, `'failed'`, `'refunded'`), `metadata` (jsonb), `created_at`, `completed_at`.
- **`public.player_entitlements`** (`202609140005_step7_to_11_backend.sql`, lines 39–47):
  - Columns: `user_id` (uuid pk), `pass_type` (text default `'convenience_pass'`), `is_active` (boolean), `starts_at`, `expires_at`, `updated_at`.
- **`public.reward_ledger`** (`202609140002_economy.sql`, lines 67–79):
  - Columns: `id` (uuid pk), `user_id` (uuid), `delta_cash` (bigint), `delta_season_points` (bigint), `reason` (text 1–64 chars), `idempotency_key` (text unique, strict check `^[a-f0-9]{64}$`), `metadata` (jsonb), `created_at`.
  - **Critical Invariant**: Any ledger insert with an `idempotency_key` MUST be an exact 64-character lowercase hexadecimal string (e.g., SHA-256 hash).

### 1.4 Route Mounting & Test Database Harness
- **`apps/api/src/index.ts`** (Lines 8–9, 29, 66–73):
  - `createShopRoutes` is mounted under both `/` and `/api`:
    ```ts
    const shop = createShopRoutes(factories.makeShopStore, factories.makeAuthStore, now);
    app.route('/', shop);
    app.route('/api', shop);
    ```
- **`apps/api/src/auth/test-db.ts`** (Lines 81–98):
  - Dispatches RPCs: `empire_shop_get_pass`, `empire_shop_create_invoice`, `empire_shop_fulfill_payment`.
  - In-memory database uses PGlite executing migrations 0001 through 0010.

---

## 2. Logic Chain: Analysis of Current Implementation vs. Requirement R1

### Step 2.1: Invoice Generation Endpoint (`POST /shop/invoice`)
- **Observed Behavior**:
  - `apps/api/src/shop/routes.ts` (lines 78–130) enforces authentication (`getCurrentUserSession`), validates request with `createInvoiceRequestSchema`, and calls `validateP2WSafety(body.sku)`.
  - Store calls RPC `empire_shop_create_invoice` which sets `starsPrice` (250 from config for pass, 150 for gold frame, 500 for founder emblem), inserts `public.purchases` with `status = 'pending'`, and returns `invoicePayload` (`inv_<uuid>_<requestId>`) and `invoiceLink` (`https://t.me/$<payload>`).
- **Gaps Identified**:
  1. **Currency**: Telegram Stars requires `currency: 'XTR'`. The DB hardcodes prices in Stars, and `invoiceLink` uses Telegram Stars format (`https://t.me/$...`), but `CreateInvoiceResponse` in `@empire/shared` lacks an explicit `currency: 'XTR'` field and `invoiceId`.
  2. **Feature Gate**: The prompt specifies that Stars payments should respect the `feature.stars_payments` feature flag. If disabled, invoice creation should return 403 / 400 `FEATURE_DISABLED` (e.g. "Satışlar yakında").
  3. **Title & Description**: For mini-app / Telegram invoice link generation, SKUs have canonical titles and descriptions defined in `@empire/game-core` (`DEFAULT_SKUS`). These should be returned or saved in `purchases.metadata`.

### Step 2.2: Webhook Verification (`X-Telegram-Bot-Api-Secret-Token`)
- **Observed Behavior**:
  - `apps/api/src/shop/routes.ts` line 133 mounts `POST /telegram/webhook`.
  - It does NOT check `c.req.header('x-telegram-bot-api-secret-token')`.
  - `apps/api/.dev.vars.example` line 4 already defines `TELEGRAM_WEBHOOK_SECRET=`.
  - `apps/api/src/auth/env.ts` `Bindings` interface does NOT yet include `TELEGRAM_WEBHOOK_SECRET?: string;`.
- **Gaps Identified**:
  1. **Missing Route**: The route is mounted as `/telegram/webhook`, but Requirement R1 explicitly names `POST /shop/webhook`. Both `/shop/webhook` and `/telegram/webhook` should be supported (under both `/` and `/api`).
  2. **Missing Token Validation**: If `c.env.TELEGRAM_WEBHOOK_SECRET` is configured, incoming requests must supply `X-Telegram-Bot-Api-Secret-Token` matching this secret. If missing or mismatched, return HTTP 401 `UNAUTHORIZED`. (In testing environments where the secret is omitted, bypass validation for backwards compatibility).

### Step 2.3: `pre_checkout_query` Verification & Handler
- **Observed Behavior**:
  - `routes.ts` lines 142–156 checks `pcq.currency !== 'XTR'`. If `USD`, returns `{ ok: false, error_message: 'Currency must be XTR (Telegram Stars).' }`. If `XTR`, returns `{ ok: true }`.
- **Gaps Identified**:
  1. **Invoice Existence & State Validation**: The current handler does NOT verify whether `pcq.invoice_payload` actually exists in `public.purchases`. Anyone can send a random string and receive `ok: true`. The handler must check:
     - Does the invoice exist? (If not: `{ ok: false, error_message: 'Invoice not found or expired.' }`).
     - Is the status `'pending'`? (If already completed/refunded: `{ ok: false, error_message: 'Invoice has already been fulfilled.' }`).
     - Does `pcq.total_amount` match `purchases.stars_amount`? (If mismatch: `{ ok: false, error_message: 'Amount mismatch.' }`).
  2. **Telegram Bot API `answerPreCheckoutQuery`**:
     - When `TELEGRAM_BOT_TOKEN` is present in environment, call Telegram Bot API `https://api.telegram.org/bot<token>/answerPreCheckoutQuery` with `{ pre_checkout_query_id: pcq.id, ok: true/false, error_message }`.
     - Also return `{ ok: true }` in the HTTP response.

### Step 2.4: `successful_payment` Atomic Fulfillment & Replay Safety
- **Observed Behavior**:
  - `routes.ts` lines 189–246 extracts `telegram_payment_charge_id`, `invoice_payload`, and `total_amount` from `payloadObj.message.successful_payment` or direct DTO.
  - Calls `store.fulfillPayment`.
  - In `empire_shop_fulfill_payment` (`202609140005_step7_to_11_backend.sql`, lines 296–364):
    - Row-level lock `for update` on `telegram_payment_charge_id`. If found and completed, returns `duplicate: true` (replay-safe).
    - If new, marks purchase `completed` with timestamp.
    - If SKU is `convenience_pass_30d`, stacks 30 days onto `player_entitlements`.
- **Gaps Identified**:
  1. **Ledger Recording**: The SQL function `empire_shop_fulfill_payment` does NOT insert into `public.reward_ledger`. Requirement R1 explicitly specifies: *"ledger recording"*.
     - Must insert an entry into `public.reward_ledger`:
       - `user_id`: buyer UUID
       - `delta_cash`: 0 (strict anti-P2W)
       - `delta_season_points`: 0 (strict anti-P2W)
       - `reason`: `'stars_purchase'`
       - `idempotency_key`: 64-char lowercase hex (e.g. `encode(digest(p_charge_id, 'sha256'), 'hex')` or SHA-256 in TypeScript)
       - `metadata`: `{ sku, starsAmount, telegramPaymentChargeId, purchaseId }`
  2. **Cosmetic Badge Crediting**:
     - `empire_shop_fulfill_payment` only updates `player_entitlements` if `sku = 'convenience_pass_30d'`.
     - When `sku` is `'cosmetic_frame_gold'` or `'cosmetic_emblem_founder'`, the entitlement must be credited (storing badge in user metadata, or `purchases.metadata` with `entitlement_granted: true`).

### Step 2.5: Status Lookup Endpoint (`GET /shop/invoices/:id`)
- **Observed Behavior**:
  - There is currently **NO** `GET /shop/invoices/:id` route in `apps/api/src/shop/routes.ts`.
  - There is **NO** DTO in `@empire/shared` for invoice status response.
  - There is **NO** method in `ShopStore` for retrieving an invoice by ID.
- **Requirements for Endpoint**:
  1. Auth: Session cookie required (`getCurrentUserSession`).
  2. Parameter: `:id` (Purchase UUID or `invoice_payload`).
  3. Ownership: Must verify `user_id = session.user.id` (or superadmin).
  4. Returns 200 with `InvoiceStatusResponse` or 404 with code `'INVOICE_NOT_FOUND'`.

---

## 3. Caveats

1. **Test DB Harness Compatibility**: `apps/api/src/auth/test-db.ts` uses PGlite with mock fetcher dispatching RPC names. Any new RPC added to `ShopStore` (e.g. `empire_shop_get_invoice`) must have a corresponding case in `test-db.ts`, OR the store can execute SQL directly via Supabase PostgREST table endpoints (`GET /rest/v1/purchases?id=eq.<id>`). PostgREST direct queries require table-level permissions (`grant select on purchases to service_role`, which already exists in migration 0005 line 117).
2. **Backwards Compatibility**: Existing tests (`routes.test.ts` line 183) submit `pre_checkout_query` with `invoice_payload: 'test_payload'` without first inserting an invoice into `purchases`. If invoice payload validation is strictly enforced for all queries, `test_payload` would fail with invoice not found unless the test is updated to create an invoice first or a test bypass flag is used. The cleanest approach is to update or augment the test to create an invoice first.
3. **Telegram Bot Token in Demo Mode**: `TELEGRAM_BOT_TOKEN` in tests is a mock (`'123456:test-bot'`). Outbound calls to `https://api.telegram.org` must either check if the token is a dummy / catch network errors gracefully, or accept a mock fetcher in the route factory.

---

## 4. Conclusion & Actionable Specifications

To fulfill Requirement R1 completely and cleanly, the following additions are required across `packages/shared/src/`, `apps/api/src/shop/`, and `apps/api/src/auth/env.ts`:

### 4.1 Schema & DTO Additions in `packages/shared/src/index.ts`
```ts
// --- Invoice Status & Lookup DTOs ---
export const invoiceStatusDtoSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  sku: z.string(),
  starsAmount: z.number().int().positive(),
  status: z.enum(['pending', 'completed', 'failed', 'refunded']),
  telegramPaymentChargeId: z.string().nullable(),
  invoicePayload: z.string(),
  currency: z.literal('XTR').default('XTR'),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
});
export type InvoiceStatusDto = z.infer<typeof invoiceStatusDtoSchema>;

export const invoiceStatusResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  invoice: invoiceStatusDtoSchema,
});
export type InvoiceStatusResponse = z.infer<typeof invoiceStatusResponseSchema>;

// --- Telegram Webhook Schemas ---
export const telegramPreCheckoutQuerySchema = z.object({
  id: z.string(),
  from: z.object({
    id: z.number(),
    is_bot: z.boolean().optional(),
    first_name: z.string().optional(),
    username: z.string().optional(),
  }),
  currency: z.string(),
  total_amount: z.number().int().positive(),
  invoice_payload: z.string(),
});
export type TelegramPreCheckoutQuery = z.infer<typeof telegramPreCheckoutQuerySchema>;

export const telegramSuccessfulPaymentSchema = z.object({
  currency: z.string(),
  total_amount: z.number().int().positive(),
  invoice_payload: z.string(),
  telegram_payment_charge_id: z.string(),
  provider_payment_charge_id: z.string().optional(),
});
export type TelegramSuccessfulPayment = z.infer<typeof telegramSuccessfulPaymentSchema>;
```

### 4.2 Store Extensions in `apps/api/src/shop/store.ts`
```ts
export interface InvoiceRecord {
  id: string;
  userId: string;
  sku: string;
  starsAmount: number;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  telegramPaymentChargeId: string | null;
  invoicePayload: string;
  currency: string;
  createdAt: string;
  completedAt: string | null;
}

export interface ShopStore {
  getUserPass(userId: string): Promise<UserPassStatus>;
  createInvoice(userId: string, sku: string, requestId: string): Promise<CreatedInvoice>;
  fulfillPayment(chargeId: string, invoicePayload: string, starsAmount: number, sku?: string): Promise<FulfillPaymentResult>;
  getInvoice(userId: string, invoiceIdOrPayload: string): Promise<InvoiceRecord | null>;
  findInvoiceByPayload(invoicePayload: string): Promise<InvoiceRecord | null>;
}
```

### 4.3 Environment Additions in `apps/api/src/auth/env.ts`
```ts
export interface Bindings {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string; // Add this line
  SESSION_SECRET?: string;
  APP_ORIGIN?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  AUTH_RATE_LIMIT?: {
    limit(options: { key: string }): Promise<{ success: boolean }>;
  };
}
```

### 4.4 Route Enhancements in `apps/api/src/shop/routes.ts`
1. **Mount `/shop/webhook` and `/telegram/webhook`**:
   - Both point to the unified Telegram webhook handler.
2. **Secret Token Header Check**:
   ```ts
   const secretToken = c.env.TELEGRAM_WEBHOOK_SECRET;
   if (secretToken) {
     const incomingHeader = c.req.header('x-telegram-bot-api-secret-token');
     if (!incomingHeader || incomingHeader !== secretToken) {
       return c.json(error('UNAUTHORIZED'), 401);
     }
   }
   ```
3. **`pre_checkout_query` Verification**:
   - Currency: `if (pcq.currency !== 'XTR') return c.json({ ok: false, error_message: 'Currency must be XTR.' });`
   - Invoice lookup: `const inv = await store.findInvoiceByPayload(pcq.invoice_payload);`
   - If not found or status not `'pending'`: return `{ ok: false, error_message: 'Invoice not found or already processed.' }`
   - If amount mismatch: return `{ ok: false, error_message: 'Amount mismatch.' }`
   - Call `answerPreCheckoutQuery` via Telegram Bot API if `c.env.TELEGRAM_BOT_TOKEN` is present:
     `fetch('https://api.telegram.org/bot' + c.env.TELEGRAM_BOT_TOKEN + '/answerPreCheckoutQuery', ...)`
   - Return `{ ok: true }`
4. **`successful_payment` Ledger & Entitlements**:
   - In `fulfillPayment`:
     - If duplicate: return `{ success: true, duplicate: true, purchaseId, newPassExpiresAt }`.
     - Record immutable entry in `reward_ledger` with `idempotency_key = sha256(chargeId)` (64 hex characters), `delta_cash = 0`, `delta_season_points = 0`, `reason = 'stars_purchase'`.
     - If cosmetic badge: record badge in entitlement metadata.
5. **Add `GET /shop/invoices/:id`**:
   ```ts
   routes.get('/shop/invoices/:id', async (c) => {
     const authStore = makeAuthStore(c.env);
     const session = await getCurrentUserSession(c.req.header('Cookie'), c.env, authStore, now);
     if (!session) return c.json(error('UNAUTHORIZED'), 401);

     const id = c.req.param('id');
     const store = makeStore(c.env);
     const invoice = await store.getInvoice(session.user.id, id);
     if (!invoice) return c.json(error('INVOICE_NOT_FOUND'), 404);

     return c.json({ apiVersion: 'v1', invoice });
   });
   ```

---

## 5. Verification Method

To independently verify all observations and proposed contracts:

1. **Verify Existing Tests**:
   ```powershell
   npx vitest run apps/api/src/shop/
   ```
   *Expected Result*: 10 tests in 2 test files pass with 0 errors.

2. **Verify Typecheck**:
   ```powershell
   pnpm --filter @empire/shared typecheck
   pnpm --filter @empire/api typecheck
   ```

3. **Proposed Integration Test Cases to Add in `apps/api/src/shop/routes.test.ts`**:
   - `POST /shop/webhook`: Rejects requests missing or invalid `X-Telegram-Bot-Api-Secret-Token` when `TELEGRAM_WEBHOOK_SECRET` is configured.
   - `pre_checkout_query`: Rejects unrecorded or already completed invoice payloads with `{ ok: false }`.
   - `pre_checkout_query`: Approves existing pending invoice with `{ ok: true }`.
   - `successful_payment`: Inserts row into `reward_ledger` with valid 64-character hex `idempotency_key` and 0 cash / 0 SP delta.
   - `GET /shop/invoices/:id`: Returns 401 unauthenticated, 404 for another user's invoice, and 200 for user's own invoice.
