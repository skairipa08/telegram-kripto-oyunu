# Handoff Report: Stream 2 — Shop Screen & Telegram Stars Payments Investigation

**Agent:** teamwork_preview_explorer_stream2  
**Timestamp:** 2026-09-16T06:06:00Z  
**Type:** Hard Handoff (Investigation Complete)

---

## 1. Observation

1. **`apps/web/src/screens/shop-screen.tsx`**:
   - Lines 10–12:
     ```tsx
     type ShopScreenProps = {
       resource: ScreenResource<ShopView>;
     };
     ```
   - Line 158–160 (Empire Pass buy button):
     ```tsx
     <button className="button sa-buy-button" type="button" disabled>
       Satışlar yakında
     </button>
     ```
   - Line 232–234 (Cosmetics buy button):
     ```tsx
     <button className="button secondary" type="button" disabled>
       Satışlar yakında
     </button>
     ```
   - No `onPurchase` handler, no feature flag check, no loading state, and no feedback banner currently exist in `shop-screen.tsx`.
2. **`apps/web/src/screens/shop-analytics.css`**:
   - Lines 628–644 (`@media (max-width: 760px)`): Pass card collapses to single column, seal width 100%.
   - Lines 646–702 (`@media (max-width: 480px)`): Screen padding becomes 16px, pass card padding 26px 20px, cosmetic grid collapses to 1 column.
   - Line 665: Font size of `h2` is `clamp(2.6rem, 16vw, 4rem)`. On 320px viewport, this computes to 41.6px in a 248px container, risking word wrap layout instability.
   - No `.sa-badge-soon` or `.sa-feedback-banner` classes exist.
3. **`apps/web/src/game/live-game.tsx`**:
   - Lines 370–377: Queries `/api/shop` into `shopResource`.
   - Line 696: Mounts `{tab === 'shop' && <ShopScreen resource={shopResource} />}` without purchase handlers or feature flag props.
   - Does not query `/api/config/public` (which exposes `featureFlags['feature.stars_payments']`).
4. **`apps/web/src/telegram/types.ts`**:
   - Lines 23–33: `TelegramWebApp` interface lacks declaration of `openInvoice(url: string, callback?: (status: 'paid' | 'cancelled' | 'failed' | 'pending') => void): void;`.
5. **`packages/shared/src/index.ts` & `apps/api/src/shop/routes.ts`**:
   - `createInvoiceRequestSchema`, `createInvoiceResponseSchema`, and `POST /shop/invoice` are already defined and functional on the backend, returning `{ apiVersion, sku, starsPrice, invoicePayload, invoiceLink }`.
6. **Test Infrastructure Execution**:
   - Ran command: `pnpm vitest run apps/web/src/game/live-game-screens.test.tsx`
   - Result: Exit code 0, 6 passed in 39ms.
   - Existing screen tests use `renderToStaticMarkup` from `react-dom/server` with no `@testing-library/react` dependency.

---

## 2. Logic Chain

1. **Feature Flag Resolution (Observation 3 & 5):**
   `apps/api/src/config/routes.ts` already returns `featureFlags['feature.stars_payments']` on `GET /config/public` (validated by `publicConfigResponseSchema` in `@empire/shared`). By introducing `useQuery` for `/api/config/public` in `live-game.tsx`, `GameShell` can deterministically evaluate `starsPaymentsEnabled`.
2. **Disabled State Enforcement (Observation 1):**
   When `starsPaymentsEnabled` is `false`, displaying a visual `"Yakında"` badge (`.sa-badge-soon`) and keeping buttons `disabled` with label `"Satışlar yakında"` satisfies the requirement to prevent transaction submission while communicating upcoming availability.
3. **Purchase Flow & Telegram Integration (Observation 1, 4, 5):**
   When `starsPaymentsEnabled` is `true`, clicking purchase will dispatch `POST /api/shop/invoice` with `{ sku, requestId }`. The response contains `invoiceLink`. Extending `TelegramWebApp` in `apps/web/src/telegram/types.ts` with `openInvoice(url, callback)` allows invoking the native payment modal.
4. **Optimistic UI & Cache Invalidation (Observation 1 & 3):**
   When `openInvoice` callback returns `status === 'paid'`, TanStack Query's `queryClient.setQueryData(['game-design', actor, 'shop'])` can immediately flip `pass.isActive = true` for instant visual response, followed by invalidation of `shop`, `economy` (reflecting the 12h offline cap), and `state`.
5. **Feedback & Zero Layout Shift (Observation 2):**
   Dynamic error/status messages without a stable container create CLS. Introducing `.sa-feedback-banner` with `min-height: 48px`, `aria-live="polite"`, and clamp adjustments on `h2` at 320px viewport guarantees zero layout shift.
6. **Test Suitability (Observation 6):**
   Vitest tests using `renderToStaticMarkup` provide fast, deterministic, zero-dependency validation for rendered badges, button states, and accessible alert roles.

---

## 3. Caveats

1. **Non-Telegram Fallback:** When running in standard desktop browser during development, `window.Telegram.WebApp.openInvoice` is undefined. The implementation must provide a clean fallback (e.g. simulated dialog or informative banner).
2. **Backend Webhook Timing:** The optimistic update in frontend assumes payment success immediately upon Telegram client callback `paid`. The backend webhook fulfills the database asynchronously. Cache invalidation reconciles any discrepancies.
3. **Scope Discipline:** Zero source files were modified during this explorer phase.

---

## 4. Conclusion

Requirement R2 is fully specified and ready for implementation by the Stream 2 Developer:
- Component: `apps/web/src/screens/shop-screen.tsx` updated with `starsPaymentsEnabled`, `onPurchase`, `purchasingSku`, and `purchaseFeedback` props.
- CSS: `apps/web/src/screens/shop-analytics.css` extended with `.sa-badge-soon`, `.sa-feedback-banner`, and 320px mobile stability rules.
- Wiring: `apps/web/src/game/live-game.tsx` queries `/api/config/public`, orchestrates invoice creation, connects `openInvoice`, handles status events (`paid`, `cancelled`, `failed`, `pending`), and triggers optimistic updates.
- Telegram Types: `apps/web/src/telegram/types.ts` extended with `openInvoice`.
- Tests: Vitest suite specified using `renderToStaticMarkup` for comprehensive unit and regression testing.

---

## 5. Verification Method

To independently verify this investigation:
1. View report: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_stream2\report.md`.
2. Inspect target screen: `c:\Users\Administrator\Desktop\telegram kripto oyunu\apps\web\src\screens\shop-screen.tsx`.
3. Inspect styles: `c:\Users\Administrator\Desktop\telegram kripto oyunu\apps\web\src\screens\shop-analytics.css`.
4. Inspect live game coordinator: `c:\Users\Administrator\Desktop\telegram kripto oyunu\apps\web\src\game\live-game.tsx`.
5. Run test command:
   ```bash
   pnpm vitest run apps/web/src/game/live-game-screens.test.tsx
   ```
   Invalidation condition: If `pnpm vitest` fails or if `shop-screen.tsx` contains uninspected payment logic.
