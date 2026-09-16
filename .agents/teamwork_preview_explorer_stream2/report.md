# Stream 2 Investigation Report: Shop Screen & Telegram Stars Payments (R2)

**Author:** teamwork_preview_explorer_stream2  
**Date:** 2026-09-16  
**Scope:** `apps/web/src/screens/shop-screen.tsx`, `apps/web/src/screens/shop-analytics.css`, `apps/web/src/game/`  
**Mode:** Read-Only Investigation (Zero source modifications performed)

---

## Executive Summary

This investigation analyzes the existing implementation of the Shop screen in Project Empire, audits its visual styling and mobile responsiveness, and formulates an exact, production-ready specification for **Requirement R2 (Stars Monetization & Pass Entitlement Frontend Integration)**.

Currently, the Shop screen is purely presentational: Empire Pass and cosmetic items are displayed with static Telegram Star prices, but all purchase buttons are permanently disabled with the hardcoded label `"Satışlar yakında"`. There is no feature flag evaluation for `feature.stars_payments`, no integration with `POST /api/shop/invoice`, no connection to `Telegram.WebApp.openInvoice()`, no optimistic UI mutation, and no feedback banner.

This report delivers the complete technical blueprint for implementing R2, ensuring strict zero layout shift on 320px–390px mobile viewports, resilient error handling, optimistic local state updates, and an exhaustive Vitest test suite leveraging the repository's existing testing patterns (`renderToStaticMarkup`).

---

## 1. Current State Analysis

### 1.1 `apps/web/src/screens/shop-screen.tsx`
- **File Length & Structure:** 261 lines.
- **Props Interface:**
  ```typescript
  type ShopScreenProps = {
    resource: ScreenResource<ShopView>;
  };
  ```
- **Component Decomposition:**
  1. `formatExpiry(value: string | null)`: Formats ISO date into Turkish localized string (`tr-TR`, e.g., "16 Eylül 2026").
  2. `StarPrice({ value }: { value: number })`: Renders the star symbol (`★`) and formatted price using `formatNumber()`.
  3. `PassEmblem()`: Embedded vector artwork for Empire Pass.
  4. `CosmeticArt({ variant: 'frame' | 'emblem' })`: SVG art for cosmetic frame and founder emblem.
  5. `ShopScreen({ resource }: ShopScreenProps)`:
     - Handles loading/error/unavailable states via `<ResourceNotice resource={unavailableResource} label="Mağaza" />`.
     - Extracts `passActive`, `expiresAt`, and `products` from `resource.data`.
     - Separates `pass` (`type === 'convenience_pass'`) from `cosmetics` (`type === 'cosmetic'`).
     - **Empire Pass Card (`.sa-pass-card`):** Displays pass name, description, duration days, expiry date, active badge (`Empire Pass aktif`), emblem, star price, and a disabled button:
       ```tsx
       <button className="button sa-buy-button" type="button" disabled>
         Satışlar yakında
       </button>
       ```
     - **Plan Comparison (`.sa-comparison`):** Compares Free plan vs Empire Pass (4h vs 12h offline cap, 1 vs 3 queue slots, 1 vs 3 mission rerolls, 1x vs 1x season points). Displays note: `"Bu avantajlar planlanan üyelik kapsamını gösterir; satışlar başlayana kadar etkin değildir."`
     - **Cosmetics Grid (`.sa-cosmetics`):** Displays up to 2 cosmetic cards (`sa-cosmetic-card`), SVG artwork, title, description, star price, and disabled button:
       ```tsx
       <button className="button secondary" type="button" disabled>
         Satışlar yakında
       </button>
       ```
     - **Support Footer (`.sa-support`):** Static information about purchasing support.
- **Key Observation:** The component accepts no action handlers (`onPurchase`), has no internal state, no feedback container, and no awareness of feature flags.

---

### 1.2 `apps/web/src/screens/shop-analytics.css`
- **File Length & Structure:** 709 lines combining styles for Shop (`.sa-shop`, `.sa-pass-card`, `.sa-cosmetic-card`) and Analytics screens.
- **Layout & Mobile Breakpoints:**
  - Base `.sa-screen`: `width: min(100%, 1120px); margin-inline: auto; padding: clamp(20px, 4vw, 48px);`.
  - `.sa-pass-card`: CSS grid with `grid-template-columns: minmax(0, 1fr) minmax(180px, 260px);`, min-height `360px`, clamp padding `clamp(28px, 6vw, 64px)`.
  - Breakpoint `@media (max-width: 760px)`:
    - `.sa-pass-card`: collapses to single column `grid-template-columns: 1fr;`.
    - `.sa-pass-seal`: `width: 100%;`.
    - `.sa-pass-emblem`: reduced to `124px`.
  - Breakpoint `@media (max-width: 480px)`:
    - `.sa-screen`: `padding-inline: 16px;`.
    - `.sa-pass-card`: padding reduced to `26px 20px`.
    - `.sa-pass-copy h2`: `font-size: clamp(2.6rem, 16vw, 4rem);`.
    - `.sa-comparison-row`: columns `minmax(106px, 1.4fr) minmax(54px, 0.6fr) minmax(54px, 0.6fr);`.
    - `.sa-cosmetic-grid`: collapses to `grid-template-columns: 1fr;`.
    - `.sa-cosmetic-copy`: `flex-direction: column;`.
- **Layout Shift Risks on 320px–390px:**
  1. **Typography wrap on 320px:** At 320px screen width, inner card width is `320px - 32px (screen) - 40px (card) = 248px`. The `clamp(2.6rem, 16vw, 4rem)` renders ~41.6px font size. "Empire Pass" (11 characters) is ~255px wide at that size and wraps across two lines on 320px but stays on one line on 375px/390px.
  2. **Feedback banner insertion:** Injecting dynamic status alerts without reserved layout space will cause Cumulative Layout Shift (CLS).
  3. **Button text toggling:** Toggling button text between `"Satın Al"` and `"Ödeme açılıyor…"` must maintain fixed `min-height: 44px` and prevent line wrapping on small buttons.
  4. **Badge presence:** Adding a "Yakında" badge must not disrupt vertical alignment or card heights.

---

### 1.3 `apps/web/src/game/` Modules
- **`types.ts`:**
  - Defines `ShopView`:
    ```typescript
    export type ShopView = {
      passActive: boolean;
      expiresAt: string | null;
      products: {
        sku: string;
        name: string;
        description: string;
        price: number;
        type: 'convenience_pass' | 'cosmetic';
        durationDays: number | null;
      }[];
    };
    ```
- **`api.ts`:**
  - Exports `getGameResource<T>(path, schema, signal)` for GET requests.
- **`live-game-model.ts`:**
  - Manages mutation feedback (`getMutationFeedback`), error mapping (`knownMutationMessages`), offline earnings estimation, and query cache invalidations (`invalidateAfterMissionClaim`).
  - **Missing:** Does not yet have shop-specific error messages or purchase cache invalidation routines.
- **`live-game.tsx`:**
  - The central coordinator containing `GameShell`.
  - Defines `postGameResource<T>()` locally (lines 61–90).
  - Fetches shop data:
    ```typescript
    const shop = useQuery({
      queryKey: ['game-design', actor, 'shop'],
      enabled: tab === 'shop',
      queryFn: ({ signal }) =>
        getGameResource('/api/shop', shopCatalogResponseSchema, signal),
      retry: false,
      staleTime: 30000,
    });
    ```
  - Mounts: `{tab === 'shop' && <ShopScreen resource={shopResource} />}`.
  - **Missing:** Does not query `/api/config/public`, does not hold purchase mutation attempts, does not provide purchase callbacks to `ShopScreen`.
- **`telegram/types.ts`:**
  - Declares `TelegramWebApp` interface and `window.Telegram`.
  - **Missing:** `openInvoice(url: string, callback?: (status: 'paid' | 'cancelled' | 'failed' | 'pending') => void): void;` is not declared on `TelegramWebApp`.

---

## 2. How Shop Items are Currently Displayed & Purchased

1. **Catalog Retrieval:** When tab `'shop'` is selected, `useQuery` fetches `GET /api/shop`.
2. **Backend Payload:** The backend returns `ShopCatalogResponseDto` containing:
   - `skus`: `DEFAULT_SKUS` (`convenience_pass_30d`, `cosmetic_frame_gold`, `cosmetic_emblem_founder`).
   - `pass`: Current pass state (`isActive`, `expiresAt`, `offlineCapSeconds`, `upgradeQueueSlots`, `missionRerolls`, `autoClaimEnabled`, `seasonPointsMultiplier`).
3. **Frontend Mapping:** `live-game.tsx` transforms this into `ShopView`.
4. **Display:**
   - Products are categorized into the Pass Card and the Cosmetic Grid.
   - Price is shown with the Telegram Star icon (`★`).
   - Expiry date is displayed if active.
5. **Purchase Execution:**
   - **Non-existent.** All purchase buttons are rendered with `disabled` attribute and text `"Satışlar yakında"`.
   - No click handlers are attached.
   - Users cannot buy or test purchases in any way.

---

## 3. Detailed Specifications for Requirement R2

### 3.1 Feature Flag Check: `feature.stars_payments`
- **Backend API:** `GET /config/public` (and `/api/config/public`) is already implemented in `apps/api/src/config/routes.ts` and returns:
  ```json
  {
    "apiVersion": "v1",
    "config": { ... },
    "featureFlags": {
      "feature.token": false,
      "feature.stars_payments": false,
      "feature.leaderboard": true,
      "feature.referrals": true
    }
  }
  ```
  Schema `publicConfigResponseSchema` is defined in `@empire/shared`.
- **Frontend Query in `live-game.tsx`:**
  ```typescript
  const publicConfig = useQuery({
    queryKey: ['public-config'],
    queryFn: ({ signal }) =>
      getGameResource('/api/config/public', publicConfigResponseSchema, signal),
    staleTime: 60000,
    retry: false,
  });

  const starsPaymentsEnabled = Boolean(
    publicConfig.data?.featureFlags['feature.stars_payments'],
  );
  ```
- **Fallback Rule:** If config query is loading, failed, or missing, `starsPaymentsEnabled` strictly defaults to `false` (fail-safe principle).

---

### 3.2 Disabled State (`feature.stars_payments === false`)
1. **"Yakında" Badge:**
   - On Empire Pass Card: Render `<span className="badge sa-badge-soon">Yakında</span>`.
   - On Cosmetic Cards: Render `<span className="badge sa-badge-soon">Yakında</span>`.
2. **Buttons Disabled:**
   - Empire Pass button: `<button className="button sa-buy-button" type="button" disabled>Satışlar yakında</button>`.
   - Cosmetic buttons: `<button className="button secondary sa-cosmetic-buy" type="button" disabled>Satışlar yakında</button>`.
3. **Transaction Guard:**
   - Click handlers check `if (!starsPaymentsEnabled) return;`.
   - Zero network requests are sent to `/api/shop/invoice`.
   - `Telegram.WebApp.openInvoice` is never invoked.

---

### 3.3 Enabled State (`feature.stars_payments === true`)
1. **Badges:**
   - The `"Yakında"` badge is NOT displayed.
   - If Empire Pass is already active, the existing `"Empire Pass aktif"` badge remains visible.
2. **Buttons Active:**
   - Empire Pass button:
     - If `passActive`: displays `"Empire Pass Aktif"` (disabled, or enabled for renewal if desired).
     - If not active and idle: displays `"Empire Pass Al"`.
     - If purchasing this item: displays `"Ödeme açılıyor…"`, `disabled`.
     - If purchasing another item: `disabled`.
   - Cosmetic buttons:
     - If idle: displays `"Satın Al"`.
     - If purchasing this item: displays `"Ödeme açılıyor…"`, `disabled`.
     - If purchasing another item: `disabled`.
3. **Purchase Flow Execution:**
   ```mermaid
   sequenceDiagram
     autonumber
     actor User
     participant Shop as ShopScreen (UI)
     participant Shell as GameShell (live-game.tsx)
     participant API as Backend (POST /api/shop/invoice)
     participant TG as Telegram.WebApp.openInvoice
     participant Store as TanStack QueryClient

     User->>Shop: Click "Empire Pass Al" / "Satın Al"
     Shop->>Shell: onPurchase(sku)
     Shell->>Shell: Set purchasingSku = sku, feedback = "Ödeme bağlantısı hazırlanıyor…"
     Shell->>API: POST /api/shop/invoice { sku, requestId }
     API-->>Shell: 200 OK { invoiceLink, invoicePayload, starsPrice }
     alt In Telegram Mini App
       Shell->>TG: Telegram.WebApp.openInvoice(invoiceLink, callback)
       TG-->>User: Telegram Native Stars Payment Sheet
       User->>TG: Authorize Payment (Stars deducted)
       TG-->>Shell: callback(status)
     else Web / Desktop Preview Fallback
       Shell->>Shell: Handle fallback or mock callback
     end

     alt status == 'paid'
       Shell->>Store: Optimistic setQueryData (pass.isActive = true)
       Shell->>Shell: Set feedback kind='success' ("Ödeme tamamlandı!")
       Shell->>Store: Invalidate ['shop', 'economy', 'state']
     else status == 'cancelled'
       Shell->>Shell: Set feedback kind='status' ("Ödeme işlemi iptal edildi.")
     else status == 'failed'
       Shell->>Shell: Set feedback kind='error' ("Ödeme tamamlanamadı.")
     else status == 'pending'
       Shell->>Shell: Set feedback kind='status' ("Ödeme onay bekliyor.")
     end
     Shell->>Shell: Clear purchasingSku = null
     Shell->>Shop: Re-render with updated state & feedback
   ```

---

### 3.4 Invoice Status Lifecycle & User Feedback Specifications

| Status | Feedback Kind | User Message (Turkish Localized) | Optimistic Action | Query Invalidations |
|---|---|---|---|---|
| `preparing` (initial) | `status` | `"Ödeme penceresi hazırlanıyor…"` | Set `purchasingSku = sku` | None |
| `paid` | `success` | `"Ödeme tamamlandı! Satın aldığın ayrıcalık hesabına tanımlandı."` | If Pass: set `passActive = true` immediately in cache | `['shop']`, `['economy']`, `['state']` |
| `cancelled` | `status` | `"Ödeme işlemi iptal edildi."` | None | None |
| `failed` | `error` | `"Ödeme tamamlanamadı. Lütfen Yıldız bakiyeni kontrol edip tekrar dene."` | None | None |
| `pending` | `status` | `"Ödeme onay bekliyor. İşlem onaylandığında ürün hesabına aktarılacaktır."` | None | `['shop']` |
| `network_error` | `error` | `"Ödeme bağlantısı oluşturulamadı. Lütfen bağlantını kontrol edip tekrar dene."` | None | None |

---

### 3.5 Mobile Responsive Layout: Zero Layout Shift on 320px–390px Screens

To satisfy the strict constraint of **zero layout shift on 320px–390px mobile screens**:

1. **Feedback Banner Architecture (`.sa-feedback-slot` / `.sa-feedback-banner`):**
   - Place the feedback message immediately beneath the section heading or directly inside the active card's control area.
   - Apply a stable `min-height: 48px` to the container and smooth opacity fade-in.
   - Use `aria-live="polite"` and appropriate roles (`role="status"` for info/success, `role="alert"` for error).
   - Ensure the banner never dynamically expands or collapses unexpected surrounding DOM elements.
2. **Typography Protection at 320px:**
   - In `apps/web/src/screens/shop-analytics.css`:
     Change `.sa-pass-copy h2` at `@media (max-width: 480px)` from `clamp(2.6rem, 16vw, 4rem)` to:
     ```css
     font-size: clamp(2.1rem, 12vw, 3.4rem);
     line-height: 1.05;
     overflow-wrap: break-word;
     ```
     This prevents `"Empire Pass"` from forcing line-height shifts between 320px (248px content width) and 390px (318px content width).
3. **Button Stability:**
   - Enforce fixed button height via `min-height: 44px` and `line-height: 1.2`.
   - Prevent text wrapping inside buttons by setting `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`.
4. **Card Padding & Grid Layout on 320px:**
   - On 320px viewports, `.sa-screen` padding must be `padding-inline: 14px`.
   - `.sa-pass-card` padding: `22px 16px`.
   - `.sa-cosmetic-grid`: single column with fixed 14px padding.
   - Total width fits cleanly within 320px without horizontal scrollbars or overflow triggers.
5. **Badge Container Consistency:**
   - The `"Yakında"` badge shares the exact height (`min-height: 30px`), border-radius (`999px`), and line-height as the `"Empire Pass aktif"` badge, ensuring zero vertical displacement when toggled.

---

## 4. Exact Implementation Blueprint

### 4.1 Component Interface Changes (`apps/web/src/screens/shop-screen.tsx`)

```typescript
export type ShopScreenProps = {
  resource: ScreenResource<ShopView>;
  starsPaymentsEnabled?: boolean;
  onPurchase?: (sku: string) => void;
  purchasingSku?: string | null;
  purchaseFeedback?: ActionFeedback | null;
};
```

#### Proposed Code Snippet:
```tsx
export function ShopScreen({
  resource,
  starsPaymentsEnabled = false,
  onPurchase,
  purchasingSku = null,
  purchaseFeedback = null,
}: ShopScreenProps) {
  if (resource.status !== 'ready' || !resource.data) {
    const unavailableResource: ScreenResource<unknown> = resource.data
      ? resource
      : {
          ...resource,
          status: resource.status === 'ready' ? 'unavailable' : resource.status,
        };
    return (
      <section className="sa-screen sa-shop" aria-labelledby="shop-title">
        <SectionTitle eyebrow="SEÇKİN KOLEKSİYON" title="Mağaza" />
        <ResourceNotice resource={unavailableResource} label="Mağaza" />
      </section>
    );
  }

  const { passActive, expiresAt, products } = resource.data;
  const pass = products.find((product) => product.type === 'convenience_pass');
  const cosmetics = products
    .filter((product) => product.type === 'cosmetic')
    .slice(0, 2);
  const expiry = passActive ? formatExpiry(expiresAt) : null;

  const isPassPurchasing = purchasingSku === pass?.sku;
  const isAnyPurchasing = purchasingSku !== null;

  return (
    <section className="sa-screen sa-shop" aria-labelledby="shop-title">
      <SectionTitle
        eyebrow="SEÇKİN KOLEKSİYON"
        title="Mağaza"
        description="Şehrinin ritmini koruyan ayrıcalıklar ve imparatorluğuna karakter katan seçkin parçalar."
        action={
          passActive ? (
            <span className="badge sa-active-badge">Empire Pass aktif</span>
          ) : !starsPaymentsEnabled ? (
            <span className="badge sa-badge-soon">Yakında</span>
          ) : undefined
        }
      />

      {purchaseFeedback && (
        <div
          className={`sa-feedback-banner ${purchaseFeedback.kind}`}
          role={purchaseFeedback.kind === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          <span>{purchaseFeedback.message}</span>
        </div>
      )}

      {pass ? (
        <article className="sa-pass-card" aria-labelledby="empire-pass-title">
          <div className="sa-pass-glow" aria-hidden="true" />
          <div className="sa-pass-copy">
            <div className="sa-pass-header-row">
              <p className="eyebrow">AYRICALIK ÜYELİĞİ</p>
              {!starsPaymentsEnabled && (
                <span className="badge sa-badge-soon">Yakında</span>
              )}
            </div>
            <h2 id="empire-pass-title">Empire Pass</h2>
            <p className="sa-pass-product-name">{pass.name}</p>
            <p>{pass.description}</p>
            <div className="sa-pass-meta">
              {pass.durationDays !== null && (
                <span>
                  <strong>{formatNumber(pass.durationDays)}</strong> gün erişim
                </span>
              )}
              {passActive && expiry && (
                <span>
                  <strong>{expiry}</strong> tarihine kadar
                </span>
              )}
              {passActive && !expiry && (
                <span>Bitiş tarihi henüz iletilmedi</span>
              )}
            </div>
          </div>
          <div className="sa-pass-seal">
            <PassEmblem />
            <StarPrice value={pass.price} />
            <button
              className="button sa-buy-button"
              type="button"
              disabled={
                !starsPaymentsEnabled || isAnyPurchasing || (passActive && !isPassPurchasing)
              }
              onClick={() => {
                if (starsPaymentsEnabled && onPurchase) {
                  onPurchase(pass.sku);
                }
              }}
            >
              {!starsPaymentsEnabled
                ? 'Satışlar yakında'
                : isPassPurchasing
                  ? 'Ödeme açılıyor…'
                  : passActive
                    ? 'Empire Pass Aktif'
                    : 'Empire Pass Al'}
            </button>
          </div>
        </article>
      ) : (
        <EmptyState
          title="Empire Pass henüz listelenmiyor"
          description="Üyelik ürünü mağaza verisine eklendiğinde süre ve yıldız fiyatı burada görünecek."
        />
      )}

      {/* Comparison table remains preserved ... */}

      <section className="sa-cosmetics" aria-labelledby="cosmetics-title">
        <div className="sa-subheading">
          <div>
            <p className="eyebrow">KOLEKSİYON</p>
            <h2 id="cosmetics-title">Şehrinin imzası</h2>
          </div>
          <p className="muted">Yalnızca görsel özelleştirme</p>
        </div>
        {cosmetics.length > 0 ? (
          <div className="sa-cosmetic-grid">
            {cosmetics.map((product, index) => {
              const isThisPurchasing = purchasingSku === product.sku;
              return (
                <article className="panel sa-cosmetic-card" key={product.sku}>
                  <div className="sa-cosmetic-art">
                    <CosmeticArt variant={index === 0 ? 'frame' : 'emblem'} />
                  </div>
                  <div className="sa-cosmetic-copy">
                    <div>
                      <div className="sa-cosmetic-title-row">
                        <h3>{product.name}</h3>
                        {!starsPaymentsEnabled && (
                          <span className="badge sa-badge-soon">Yakında</span>
                        )}
                      </div>
                      <p className="muted">{product.description}</p>
                    </div>
                    <StarPrice value={product.price} />
                  </div>
                  <button
                    className="button secondary sa-cosmetic-buy"
                    type="button"
                    disabled={!starsPaymentsEnabled || isAnyPurchasing}
                    onClick={() => {
                      if (starsPaymentsEnabled && onPurchase) {
                        onPurchase(product.sku);
                      }
                    }}
                  >
                    {!starsPaymentsEnabled
                      ? 'Satışlar yakında'
                      : isThisPurchasing
                        ? 'Ödeme açılıyor…'
                        : 'Satın Al'}
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="Kozmetik koleksiyon hazırlanıyor"
            description="Gerçek ürünler mağazaya eklendiğinde çerçeve ve amblemler burada listelenecek."
          />
        )}
      </section>

      {/* Support footer remains preserved ... */}
    </section>
  );
}
```

---

### 4.2 CSS Enhancements (`apps/web/src/screens/shop-analytics.css`)

```css
/* --- Stream 2: R2 Telegram Stars & Shop Feedback Styling --- */

.sa-badge-soon {
  border-color: color-mix(in srgb, var(--accent) 36%, transparent) !important;
  color: var(--accent) !important;
  background: color-mix(in srgb, var(--accent) 12%, transparent) !important;
}

.sa-pass-header-row,
.sa-cosmetic-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.sa-feedback-banner {
  display: flex;
  align-items: center;
  min-height: 48px;
  margin-bottom: 24px;
  padding: 12px 18px;
  border-radius: 14px;
  font-size: 0.88rem;
  font-weight: 560;
  line-height: 1.45;
  transition: opacity 0.2s ease-in-out;
}

.sa-feedback-banner.status {
  border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
  background: color-mix(in srgb, var(--accent) 10%, var(--surface));
  color: var(--text);
}

.sa-feedback-banner.error {
  border: 1px solid color-mix(in srgb, #ef4444 40%, transparent);
  background: color-mix(in srgb, #ef4444 12%, var(--surface));
  color: #fca5a5;
}

.sa-feedback-banner.success {
  border: 1px solid color-mix(in srgb, var(--green) 40%, transparent);
  background: color-mix(in srgb, var(--green) 12%, var(--surface));
  color: var(--green);
}

/* 320px - 390px Zero Layout Shift Hardening */
@media (max-width: 480px) {
  .sa-screen {
    padding-inline: 14px;
  }

  .sa-pass-card {
    padding: 22px 16px;
  }

  .sa-pass-copy h2 {
    font-size: clamp(2.1rem, 12vw, 3.4rem);
    line-height: 1.05;
    overflow-wrap: break-word;
  }

  .sa-feedback-banner {
    min-height: 44px;
    padding: 10px 14px;
    font-size: 0.82rem;
    margin-bottom: 18px;
  }

  .sa-buy-button,
  .sa-cosmetic-buy {
    min-height: 44px;
    white-space: nowrap;
  }
}
```

---

### 4.3 Telegram WebApp Interface Extension (`apps/web/src/telegram/types.ts`)

```typescript
export interface TelegramWebApp {
  readonly initData: string;
  readonly colorScheme: 'light' | 'dark';
  readonly themeParams: TelegramThemeParams;
  readonly safeAreaInset?: TelegramSafeAreaInset;
  readonly contentSafeAreaInset?: TelegramSafeAreaInset;
  ready(): void;
  expand(): void;
  onEvent(event: TelegramWebAppEvent, callback: () => void): void;
  offEvent(event: TelegramWebAppEvent, callback: () => void): void;
  openInvoice?(
    url: string,
    callback?: (status: 'paid' | 'cancelled' | 'failed' | 'pending') => void,
  ): void;
}
```

---

### 4.4 Coordinator Wiring in `apps/web/src/game/live-game.tsx`

1. **Config Query:**
   ```typescript
   const publicConfig = useQuery({
     queryKey: ['public-config'],
     queryFn: ({ signal }) =>
       getGameResource('/api/config/public', publicConfigResponseSchema, signal),
     staleTime: 60000,
     retry: false,
   });
   const starsPaymentsEnabled = Boolean(
     publicConfig.data?.featureFlags['feature.stars_payments'],
   );
   ```

2. **Purchase State & Handler:**
   ```typescript
   const [purchasingSku, setPurchasingSku] = useState<string | null>(null);
   const [purchaseFeedback, setPurchaseFeedback] = useState<ActionFeedback | null>(null);

   const handlePurchase = async (sku: string) => {
     if (!starsPaymentsEnabled || purchasingSku) return;

     setPurchasingSku(sku);
     setPurchaseFeedback({
       kind: 'status',
       message: 'Ödeme penceresi hazırlanıyor…',
     });

     try {
       const invoice = await postGameResource(
         '/api/shop/invoice',
         { sku, requestId: crypto.randomUUID() },
         createInvoiceResponseSchema,
       );

       const webApp = window.Telegram?.WebApp;
       if (webApp && typeof webApp.openInvoice === 'function') {
         webApp.openInvoice(invoice.invoiceLink, async (status) => {
           if (status === 'paid') {
             setPurchaseFeedback({
               kind: 'success',
               message: 'Ödeme tamamlandı! Satın aldığın ayrıcalık hesabına tanımlandı.',
             });
             // Optimistic Pass update
             if (sku === 'convenience_pass_30d') {
               queryClient.setQueryData(
                 ['game-design', actor, 'shop'],
                 (prev: any) =>
                   prev ? { ...prev, pass: { ...prev.pass, isActive: true } } : prev,
               );
             }
             await Promise.all([
               queryClient.invalidateQueries({ queryKey: ['game-design', actor, 'shop'] }),
               queryClient.invalidateQueries({ queryKey: ['game-design', actor, 'economy'] }),
               queryClient.invalidateQueries({ queryKey: ['game-design', actor, 'state'] }),
             ]);
           } else if (status === 'cancelled') {
             setPurchaseFeedback({
               kind: 'status',
               message: 'Ödeme işlemi iptal edildi.',
             });
           } else if (status === 'failed') {
             setPurchaseFeedback({
               kind: 'error',
               message: 'Ödeme tamamlanamadı. Lütfen Yıldız bakiyeni kontrol edip tekrar dene.',
             });
           } else if (status === 'pending') {
             setPurchaseFeedback({
               kind: 'status',
               message: 'Ödeme onay bekliyor. İşlem onaylandığında ürün hesabına aktarılacaktır.',
             });
           }
           setPurchasingSku(null);
         });
       } else {
         setPurchaseFeedback({
           kind: 'status',
           message: 'Ödeme bağlantısı hazırlandı (Telegram Mini App içinde otomatik açılır).',
         });
         setPurchasingSku(null);
       }
     } catch (err) {
       setPurchasingSku(null);
       setPurchaseFeedback({
         kind: 'error',
         message: 'Ödeme bağlantısı oluşturulamadı. Lütfen tekrar dene.',
       });
     }
   };
   ```

3. **Mounting `ShopScreen`:**
   ```tsx
   {tab === 'shop' && (
     <ShopScreen
       resource={shopResource}
       starsPaymentsEnabled={starsPaymentsEnabled}
       onPurchase={handlePurchase}
       purchasingSku={purchasingSku}
       purchaseFeedback={purchaseFeedback}
     />
   )}
   ```

---

## 5. Vitest Test Suite Specifications

Following the repository's established testing methodology (`react-dom/server`'s `renderToStaticMarkup` and pure Vitest mock assertions), the test suite will be created at `apps/web/src/screens/shop-screen.test.tsx` (or integrated into `apps/web/src/game/live-game-screens.test.tsx`).

### Test Case Matrix:

| # | Test Title | Setup Conditions | Assertions |
|---|---|---|---|
| 1 | `shows "Yakında" badges and disables buttons when feature.stars_payments is disabled` | `starsPaymentsEnabled={false}`, `resource={ready}` | - `markup.includes('sa-badge-soon')` is true<br>- `markup.includes('Yakında')` is true<br>- Buttons contain `disabled=""`<br>- Buttons contain text `"Satışlar yakında"` |
| 2 | `prevents onPurchase callback when feature is disabled` | `starsPaymentsEnabled={false}`, `onPurchase=vi.fn()` | - Even if simulated or clicked, `onPurchase` is never invoked |
| 3 | `renders active purchase buttons and hides "Yakında" badges when feature is enabled` | `starsPaymentsEnabled={true}`, `resource={ready}` | - `markup.includes('sa-badge-soon')` is false<br>- Buy buttons do NOT have `disabled=""`<br>- Empire Pass button displays `"Empire Pass Al"`<br>- Cosmetic buttons display `"Satın Al"` |
| 4 | `disables buttons and shows loading text when an item purchase is pending` | `starsPaymentsEnabled={true}`, `purchasingSku="convenience_pass_30d"` | - Empire Pass button contains text `"Ödeme açılıyor…"`<br>- Pass button and cosmetic buttons have `disabled=""` |
| 5 | `renders accessible feedback banner with role="status" on success and role="alert" on error` | `purchaseFeedback={{ kind: 'success', message: 'Ödeme başarılı!' }}` vs `{ kind: 'error', message: 'Hata!' }` | - Success banner has `role="status"` and message text<br>- Error banner has `role="alert"` and message text |
| 6 | `Telegram.WebApp.openInvoice integration & invoice status dispatch` | Mock `openInvoice` callback with status values | - `status: 'paid'`: updates queryClient cache optimistically and invalidates queries<br>- `status: 'cancelled'`: sets info feedback without mutating pass<br>- `status: 'failed'`: sets error feedback and re-enables purchase<br>- `status: 'pending'`: sets pending status notice |
| 7 | `maintains semantic layout stability without shift on 320px–390px screens` | Inspect element class hierarchy and reserved slot markup | - Feedback slot has container class `.sa-feedback-banner`<br>- Headings and badges have bounded constraints |

#### Concrete Test Code Implementation:
```tsx
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ShopScreen } from './shop-screen';
import type { ShopView, ScreenResource } from '../game/types';

const mockShopData: ShopView = {
  passActive: false,
  expiresAt: null,
  products: [
    {
      sku: 'convenience_pass_30d',
      name: '30 Günlük Convenience Pass',
      description: '12 saat çevrimdışı kazanç kapasitesi.',
      price: 250,
      type: 'convenience_pass',
      durationDays: 30,
    },
    {
      sku: 'cosmetic_frame_gold',
      name: 'Altın Çerçeve',
      description: 'Profilin için özel altın çerçeve.',
      price: 150,
      type: 'cosmetic',
      durationDays: null,
    },
  ],
};

const mockReadyResource: ScreenResource<ShopView> = {
  status: 'ready',
  data: mockShopData,
};

describe('ShopScreen R2 Stars payments & feature flag controls', () => {
  it('displays "Yakında" badge and disables all buy buttons when starsPaymentsEnabled is false', () => {
    const markup = renderToStaticMarkup(
      <ShopScreen
        resource={mockReadyResource}
        starsPaymentsEnabled={false}
      />,
    );

    expect(markup).toContain('sa-badge-soon');
    expect(markup).toContain('Yakında');
    expect(markup).toContain('Satışlar yakında');
    // Both Pass and Cosmetic buttons must be disabled
    const disabledMatches = markup.match(/disabled=""/g);
    expect(disabledMatches?.length).toBeGreaterThanOrEqual(2);
  });

  it('renders active purchase buttons and removes "Yakında" badge when starsPaymentsEnabled is true', () => {
    const markup = renderToStaticMarkup(
      <ShopScreen
        resource={mockReadyResource}
        starsPaymentsEnabled={true}
      />,
    );

    expect(markup).not.toContain('sa-badge-soon');
    expect(markup).toContain('Empire Pass Al');
    expect(markup).toContain('Satın Al');
  });

  it('disables purchase buttons and shows loading text when purchasingSku is set', () => {
    const markup = renderToStaticMarkup(
      <ShopScreen
        resource={mockReadyResource}
        starsPaymentsEnabled={true}
        purchasingSku="convenience_pass_30d"
      />,
    );

    expect(markup).toContain('Ödeme açılıyor…');
    expect(markup).toContain('disabled=""');
  });

  it('renders an accessible feedback alert banner when purchaseFeedback is provided', () => {
    const successMarkup = renderToStaticMarkup(
      <ShopScreen
        resource={mockReadyResource}
        starsPaymentsEnabled={true}
        purchaseFeedback={{
          kind: 'success',
          message: 'Ödeme tamamlandı! Satın aldığın ayrıcalık hesabına tanımlandı.',
        }}
      />,
    );

    expect(successMarkup).toContain('role="status"');
    expect(successMarkup).toContain('Ödeme tamamlandı!');

    const errorMarkup = renderToStaticMarkup(
      <ShopScreen
        resource={mockReadyResource}
        starsPaymentsEnabled={true}
        purchaseFeedback={{
          kind: 'error',
          message: 'Ödeme tamamlanamadı.',
        }}
      />,
    );

    expect(errorMarkup).toContain('role="alert"');
    expect(errorMarkup).toContain('Ödeme tamamlanamadı.');
  });
});
```

---

## 6. Handoff & Implementation Recommendations

1. **Isolation Scope Compliance:** All required changes for Stream 2 are strictly confined to:
   - `apps/web/src/screens/shop-screen.tsx`
   - `apps/web/src/screens/shop-analytics.css`
   - `apps/web/src/game/live-game.tsx`
   - `apps/web/src/telegram/types.ts`
   - `apps/web/src/screens/shop-screen.test.tsx` (new test file)
2. **Coordination with Stream 1 (Backend):**
   - Stream 1 implements `POST /shop/invoice` and Telegram Webhook.
   - Stream 2 interfaces with `POST /api/shop/invoice` returning `{ invoiceLink }` which is already defined in `@empire/shared`.
3. **Coordination with Stream 3 & 4 (Admin):**
   - Stream 3 provides the toggle for `feature.stars_payments` via `POST /admin/config`.
   - Stream 2 reads this toggle via `GET /api/config/public`, ensuring immediate, seamless reactivity when toggled in the admin UI.
