# Stream 4 Explorer Report: Frontend Admin Panel & Shell Architecture (Requirement R4)

**Working Directory**: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_stream4`  
**Target Scope**: `apps/web/src/screens/admin-screen.tsx`, `apps/web/src/admin/`, `apps/web/src/shell/`  
**Investigation Date**: 2026-09-16  
**Role**: Teamwork Explorer (Read-Only Investigation & Architectural Specification)

---

## Executive Summary

This investigation analyzes the requirements, current state, and implementation blueprint for **Requirement R4 (Admin Web Dashboard UI)** in Project Empire (Step 9).
The Admin Web Dashboard must provide authorized administrators (`@Barandnz` and `@Mberked`) with a dedicated, real-time operations console featuring:
1. **Feature Flags Tab**: Real-time toggles for `feature.stars_payments`, `feature.maintenance_mode`, and `feature.referrals`.
2. **Fraud Review Tab**: Interactive queue of flagged suspicious accounts and frozen rewards with one-click review actions (`İncele`, `Onayla`, `Dondurmayı Kaldır`).
3. **Audit Log Tab**: Chronological audit trail documenting all administrative changes, before/after values, and justification notes.

Key findings:
- **Zero current footprint**: `apps/web/src/screens/admin-screen.tsx`, `apps/web/src/admin/`, and `apps/web/src/shell/` do not yet exist on disk, meaning Stream 4 has a greenfield implementation space within strictly isolated boundaries.
- **Strict Admin Gating**: The user's Telegram username is already available in the client session (`session.playerState.data.user.username`). Frontend gating normalizes the handle (`username.trim().toLowerCase().replace(/^@/, '')`) and matches against `{'barandnz', 'mberked'}`. Backend parity is guaranteed by database migration `202609140010_designated_admins.sql` and the `empire_admin_check_role` RPC.
- **Astra 6.0 Theme Compatibility**: Using existing CSS variables (`--bg`, `--surface`, `--surface-raised`, `--text`, `--muted`, `--accent`, `--accent-ink`, `--border`, `--green`, `--red`, `--radius`), the admin panel seamlessly supports dark/light themes without modifying or regressing player screens.
- **Zero Layout Shift & Mobile 360px+**: Responsive design specifications employ CSS `minmax()` grids, responsive touch-friendly cards, skeleton placeholders, and minimum 44px touch targets.

---

## 1. Baseline Analysis: Current Workspace & Architecture

### 1.1 Existing File Status
An inspection across `apps/web/src/` revealed:
- `apps/web/src/screens/admin-screen.tsx`: **Does not exist** (to be authored).
- `apps/web/src/admin/`: **Does not exist** (directory to be created with subcomponents, types, api, css).
- `apps/web/src/shell/`: **Does not exist** (directory to be created for admin access gate and shell navigation abstractions).
- Existing player screens in `apps/web/src/screens/`:
  - `empire-screen.tsx`: Idle empire view, business cards, cash claim, upgrades.
  - `missions-screen.tsx`: Daily/weekly missions and streak claiming.
  - `friends-screen.tsx`: Referral links, binding, and invite status.
  - `leaderboard-screen.tsx`: Infinite scrolling global and friend rankings.
  - `shop-screen.tsx`: Telegram Stars catalog and Convenience Pass entitlements.
  - `analytics-screen.tsx`: Prototype analytics screen used in design preview.

### 1.2 Shell Layout & Navigation
Currently, shell navigation and layout are contained in `apps/web/src/game/game-layout.tsx` and `apps/web/src/game/live-game.tsx`:
- **Navigation Tabs**: Defined in `apps/web/src/game/types.ts` as `export type GameTab = 'empire' | 'missions' | 'friends' | 'leaderboard' | 'shop'`.
- **Desktop Navigation**: Rendered in `GameLayout` via `aside.desktop-rail` -> `nav.desktop-navigation`.
- **Mobile Navigation**: Rendered via `nav.mobile-navigation` fixed at screen bottom with 5 tabs.
- **Topbar**: Rendered in `header.app-topbar` featuring wordmark, breadcrumb, wallet strip (Cash & Season Points), and avatar button.
- **Account Dialog**: Native `<dialog className="account-dialog">` containing avatar, user's `name`, status description, and logout button.

### 1.3 User Session & Authentication Flow
- Handled in `apps/web/src/auth/use-player-session.ts`:
  1. Retrieves Telegram WebApp `initData` via `useTelegramWebApp()`.
  2. If session cookie exists, fetches state via `GET /api/me/state`.
  3. If unauthorized (401), submits `POST /api/auth/telegram` with `initData` and `requestId`.
  4. Returns `PlayerState` adhering to `@empire/shared`'s `playerStateSchema`:
     ```ts
     export const playerStateSchema = z.object({
       apiVersion: z.literal('v1'),
       user: z.object({
         id: z.uuid(),
         telegramId: z.string().regex(/^[1-9][0-9]*$/),
         firstName: z.string(),
         username: z.string().nullable(),
         language: z.string().nullable(),
       }),
       session: z.object({ expiresAt: z.iso.datetime() }),
       game: z.union([...]),
     });
     ```
  5. Crucially, `user.username` is directly exposed on the authenticated session.

---

## 2. Admin Access Gating Mechanism

### 2.1 Authorized Personas
The blueprint and user requirements mandate access exclusively for designated superadmins:
- **@Barandnz**
- **@Mberked**
- Any user explicitly possessing the `superadmin` role in `admin_roles`.

### 2.2 Frontend Gating Specification (`apps/web/src/shell/admin-gate.ts`)
```ts
export const DESIGNATED_ADMIN_HANDLES = ['barandnz', 'mberked'] as const;

export function normalizeAdminUsername(username: string | null | undefined): string {
  if (!username) return '';
  return username.trim().toLowerCase().replace(/^@/, '');
}

export function isDesignatedAdmin(user?: { username?: string | null } | null): boolean {
  if (!user?.username) return false;
  const normalized = normalizeAdminUsername(user.username);
  return DESIGNATED_ADMIN_HANDLES.includes(
    normalized as (typeof DESIGNATED_ADMIN_HANDLES)[number]
  );
}
```

### 2.3 Defense-in-Depth Multi-Tier Protection
1. **Tier 1 — UI Concealment (Standard Players)**:
   - If `!isDesignatedAdmin(state.user)`, no admin tabs, buttons, or navigation links are rendered in either desktop rail or mobile dialog. Standard players have zero visual indication of an admin interface.
2. **Tier 2 — View Gate / Route Guard**:
   - If a non-admin client-side state is forced into the admin view, `AdminScreen` checks `isDesignatedAdmin(state.user)`:
     - Displays an accessible 403 / "Yetkisiz Erişim" screen (`role="alert"`), forbidding rendering of controls or data.
3. **Tier 3 — Network / API RBAC Enforcement**:
   - Backend routes `/api/admin/config`, `/api/admin/fraud/*`, `/api/admin/audit-logs` strictly enforce session checks via `empire_admin_check_role(session.user.id, 'admin')`.
   - Unauthorized requests immediately return HTTP 403 `FORBIDDEN` (or HTTP 401 `UNAUTHORIZED`).
4. **Tier 4 — Database Trigger & RLS**:
   - Migration `202609140010_designated_admins.sql` provides database-level enforcement:
     - Stored procedure `empire_admin_check_role` directly bypasses role table for usernames `barandnz` and `mberked`.
     - Trigger `trg_designated_admins_auto_assign` automatically syncs the `superadmin` role upon user row insertion or username update.

---

## 3. Requirement R4 Detailed Specifications

### 3.1 Admin Screen Overview (`apps/web/src/screens/admin-screen.tsx`)
The Admin Screen is a dedicated, self-contained operations cockpit:
- **Header**:
  - Eyebrow: `SİSTEM VE GÜVENLİK YÖNETİMİ`
  - Title: `Yönetici Paneli`
  - Subtitle: `Özellik bayrakları, sahtekarlık denetimi ve sistem kayıtları.`
  - Action Badge: `Süper Yönetici: @{username}` (with live connection status indicator).
  - "Oyuna Dön" (Return to Game) button allowing admins to switch seamlessly back to the player view.
- **Admin Tab Navigation**:
  - Sub-navigation bar with 3 tabs:
    1. **Özellik Bayrakları** (`flags`)
    2. **Sahtekarlık İnceleme** (`fraud`)
    3. **Denetim Günlüğü** (`audit`)

---

### 3.2 Tab 1: Özellik Bayrakları (Feature Flags Tab)
**File**: `apps/web/src/admin/feature-flags-tab.tsx`

#### Controlled Flags
1. **`feature.stars_payments`**:
   - Label: `Telegram Stars (XTR) Ödemeleri`
   - Description: `Oyuncuların mağazadan Telegram Yıldızları ile Kolaylık Bileti ve kozmetik ürün satın almasını kontrol eder.`
   - Impact: When OFF, Shop screen displays "Yakında" (Coming Soon) badges and disables `openInvoice` triggers.
2. **`feature.maintenance_mode`**:
   - Label: `Bakım Modu (Acil Durum Kilidi)`
   - Description: `Oyuncu eylemlerini (nakit toplama, yükseltmeler) geçici olarak durdurur ve genel bakım bildirimi gösterir.`
   - Impact: When ON, blocks game mutations and displays a maintenance banner across client sessions.
3. **`feature.referrals`**:
   - Label: `Davet Sistemi ve Ödülleri`
   - Description: `Yeni davet bağlantısı oluşturma, referans bağlama ve aşama bazlı ödül kazanımını aktif/pasif yapar.`
   - Impact: When OFF, disables binding of referral codes and pauses referral milestone rewards.
4. **`feature.token`**:
   - Label: `Token ve Airdrop Modülü`
   - Description: `Gelecek faz token tahsis ve airdrop hazırlık modülü (varsayılan: Devre Dışı).`

#### UI Elements & Interaction
- **Switch Component**:
  - Accessible toggle switch using native `<button role="switch" aria-checked={value}>`.
  - Visual slider track and thumb styled via CSS transitions.
  - Status indicator: Pill badge showing **"Aktif"** (green background/border) or **"Devre Dışı"** (muted neutral).
- **Update Workflow**:
  - Clicking a toggle triggers an inline confirmation or reason prompt ("Bu değişikliğin denetim gerekçesini girin").
  - Submits to `POST /api/admin/config`:
    ```json
    {
      "key": "feature.stars_payments",
      "value": false,
      "reason": "Geçici ödeme sağlayıcı bakımı",
      "requestId": "uuid"
    }
    ```
  - **Optimistic Update**: Toggle flips immediately in the UI; if the network call fails, reverts to previous state and displays a floating error toast (`role="alert"`).
  - **In-flight Mutex**: Switch is disabled while mutation is pending (`disabled={isPending}`).

---

### 3.3 Tab 2: Sahtekarlık İnceleme (Fraud Review Tab)
**File**: `apps/web/src/admin/fraud-review-tab.tsx`

#### Data Sources
- `GET /api/admin/fraud/flags`: Paginated list of flagged events with risk scores and reason codes.
- `GET /api/admin/fraud/frozen`: List of currently frozen player rewards pending admin decision.

#### Layout & Presentation
- **Filters & Summary KPIs**:
  - KPI Cards: Top summary metrics:
    - *Bekleyen İncelemeler*: Count of status = `frozen` / `pending`.
    - *Yüksek Riskli Hesaplar*: Count of flags with risk score >= 70.
    - *Toplam Dondurulan Nakit*: Sum of `amountCash`.
    - *Toplam Dondurulan SP*: Sum of `amountSeasonPoints`.
  - Filter Bar: Status selector (`Tümü`, `Dondurulmuş`, `Onaylanmış`, `Reddedilmiş`), Severity filter (`Tümü`, `Kritik`, `Yüksek`, `Orta`, `Düşük`), Search input (by username or telegram ID).
- **Responsive Table / Card List**:
  - Desktop: Structured tabular view with headers:
    - `Oyuncu`: First name, `@username`, Telegram ID.
    - `Risk Skoru`: Visual score meter (0–100) with color badge:
      - 0–30: Yeşil (Düşük Risk)
      - 31–69: Kehribar (Orta Risk)
      - 70–100: Kırmızı (Yüksek/Kritik Risk)
    - `Neden Kodları`: Badges for detected signals (`RAPID_BURST_REQUESTS`, `VELOCITY_CAP_EXCEEDED`, `DEVICE_CLUSTER_DETECTED`, `CIRCULAR_REFERRAL_SUSPECT`).
    - `Dondurulan Miktar`: Amount of Cash and Season Points quarantined.
    - `Tarih`: Formatted freeze timestamp (`tr-TR`).
    - `İşlemler`: Quick action button group.
  - Mobile (360px+): Transforms into a clean vertical card list, avoiding horizontal scroll clipping and preserving layout hierarchy.

#### Quick Actions & Workflow
1. **İncele (Inspect)**:
   - Opens a detail modal `<dialog>` displaying user profile, fraud flag metadata, velocity measurements, and trigger timestamps.
2. **Onayla (Approve)**:
   - Opens review confirmation with required/optional reason input.
   - Submits `POST /api/admin/fraud/review`:
     ```json
     {
       "rewardId": "uuid",
       "decision": "approve",
       "reason": "Yönetici onayı: Oyuncu oyunu normal oynamış."
     }
     ```
   - On success: Unfreezes reward, credits player balance atomically, updates row status to `approved`.
3. **Dondurmayı Kaldır / Reddet (Reject / Dismiss)**:
   - Submits `POST /api/admin/fraud/review`:
     ```json
     {
       "rewardId": "uuid",
       "decision": "reject",
       "reason": "Makro/otomasyon tespit edildi."
     }
     ```
   - On success: Permanently cancels frozen reward, updates row status to `rejected`.
- Buttons reflect `loading` state during mutation, preventing double-submission.

---

### 3.4 Tab 3: Denetim Günlüğü (Audit Log Tab)
**File**: `apps/web/src/admin/audit-log-tab.tsx`

#### Data Sources
- `GET /api/admin/audit-logs` (or `/admin/audit-logs`): Chronological feed of administrative operations from `public.admin_audit_logs`.

#### UI Elements
- **Chronological Timeline Feed**:
  - Newest entries displayed at top.
  - Entry structure:
    - **Header**: Relative/absolute timestamp (e.g. `16 Eyl 2026 09:15`) + Admin badge (`@Barandnz` or Admin ID).
    - **Action Badge**: Type of change (`update_config`, `set_feature_flag`, `fraud_review_approve`, `fraud_review_reject`, `freeze_season`).
    - **Target**: Entity changed (e.g. `feature.stars_payments`, `reward_id: ...`).
    - **Diff Box**: Visual comparison showing:
      - `Eski Değer`: Formatted old value pill (e.g. `true`).
      - `Yeni Değer`: Formatted new value pill (e.g. `false`).
    - **Gerekçe (Reason)**: Italicized explanation note provided by the admin during mutation.
- **Filters & Search**:
  - Filter by action type (`Tümü`, `Bayrak Ayarları`, `Sahtekarlık İncelemeleri`).
  - Search by admin username or target key.
- **Auto-Refresh**:
  - "Yenile" button with spinner, enabling instant re-fetch without reloading the page.

---

## 4. Astra 6.0 Theme Integration & Zero Layout Shift

### 4.1 Theme Token Adherence
The admin interface exclusively consumes the project's CSS design tokens defined in `apps/web/src/styles.css`:

| CSS Token | Dark Theme (Default) | Light Theme (`data-design-theme="light"`) | Usage in Admin UI |
|---|---|---|---|
| `--bg` | `#10141d` | `#f4f2ed` | Background canvas |
| `--surface` | `#181e29` | `#fffefa` | Panels, card containers, dialogs |
| `--surface-raised` | `#202736` | `#ece9e2` | Switches, table headers, hovered rows |
| `--text` | `#f4f0e8` | `#222735` | Primary headings, table text |
| `--muted` | `#a8b0bf` | `#616574` | Descriptions, secondary metadata |
| `--accent` | `#e1b47e` | `#946125` | Active tab indicators, switch handles, focus rings |
| `--accent-ink` | `#352416` | `#fffaf2` | Text inside primary buttons |
| `--border` | `rgba(150, 160, 180, 0.18)` | `rgba(90, 80, 65, 0.18)` | Table borders, card outlines |
| `--green` | `#7ed2ad` | `#29755b` | Active badges, low-risk scores, approvals |
| `--red` | `#ff9e9e` | `#a73242` | Disabled badges, high-risk scores, rejections |
| `--radius` | `20px` | `20px` | Card corners and modals |

### 4.2 Non-Interference Guardrail
- **Namespace Scoping**: All admin stylesheet rules are strictly prefixed with `.admin-` or scoped under `.admin-screen` within `apps/web/src/admin/admin.css`.
- Player screens (`EmpireScreen`, `MissionsScreen`, `FriendsScreen`, `LeaderboardScreen`, `ShopScreen`) and their respective styles (`shop-analytics.css`, `empire-missions.css`, `social.css`) are completely untouched and isolated.

### 4.3 Zero Layout Shift (CLS = 0)
- **Pre-Allocated Geometry**:
  - Metric cards and switch cards specify minimum heights (`min-height: 84px`).
  - Table rows employ fixed skeleton loaders (`.skeleton-line`) matching the exact row height (48px) during data loading.
  - Tab panels maintain continuous container min-height, preventing layout jumps when switching between Feature Flags, Fraud Review, and Audit Log tabs.
- **Font Display**:
  - System font stack (`'Segoe UI', ui-sans-serif, system-ui, sans-serif`) with `font-synthesis: none` eliminates font-loading layout shifts.

### 4.4 Mobile 360px+ Responsiveness
- **Fluid Layout**:
  - `clamp(16px, 4vw, 32px)` used for screen padding and section margins.
  - Feature flag rows use CSS flexbox with `flex-wrap: wrap` to allow text and switch controls to stack naturally on narrow 360px viewports without horizontal clipping.
- **Adaptive Data Presentation**:
  - On screens `< 640px`, the fraud review table collapses into vertical cards with labeled rows.
  - Action buttons retain minimum `44px x 44px` touch target dimensions conforming to mobile accessibility standards.
- **Desktop (768px - 1440px+)**:
  - Utilizes full workspace width up to `1120px` max-width.
  - Multi-column grid for metrics (2 to 4 columns).
  - High-density table layout with sticky headers for scrolling through fraud queues and audit logs.

---

## 5. Component Architecture & Implementation Blueprint

### 5.1 Directory & File Layout
The following files are mapped out for Stream 4 implementation:

```
apps/web/src/
├── screens/
│   └── admin-screen.tsx              # Top-level Admin Screen entry point
├── shell/
│   ├── admin-gate.ts                 # Admin username normalization & gating logic
│   └── shell-state.ts                # View routing state ('game' vs 'admin')
└── admin/
    ├── admin-types.ts                # DTOs, view models, and tab types
    ├── admin-api.ts                  # Fetchers and mutation callers for admin routes
    ├── admin-ui.tsx                  # Reusable components: Switch, RiskBadge, ReasonTag, Modal
    ├── feature-flags-tab.tsx         # Tab 1: Real-time feature flag switches
    ├── fraud-review-tab.tsx          # Tab 2: Flagged accounts & frozen rewards table
    ├── audit-log-tab.tsx             # Tab 3: Chronological audit log feed
    ├── admin.css                     # Scoped Astra 6.0 styling for admin panel
    └── admin-screen.test.tsx         # Comprehensive Vitest suite for admin UI
```

### 5.2 TypeScript Interfaces (`apps/web/src/admin/admin-types.ts`)
```ts
export type AdminTab = 'flags' | 'fraud' | 'audit';

export interface FeatureFlagItem {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  isUpdating?: boolean;
}

export interface FraudFlagView {
  id: string;
  userId: string;
  telegramId: string;
  username: string | null;
  firstName: string;
  riskScore: number;
  reasonCodes: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed';
  createdAt: string;
}

export interface FrozenRewardView {
  id: string;
  userId: string;
  telegramId: string;
  username: string | null;
  firstName: string;
  rewardType: string;
  amountCash: number;
  amountSeasonPoints: number;
  status: 'frozen' | 'approved' | 'rejected';
  freezeReason: string;
  frozenAt: string;
}

export interface AuditLogView {
  id: string;
  adminUsername: string;
  action: string;
  targetType: string;
  targetKey: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string | null;
  createdAt: string;
}
```

### 5.3 API Client Integration (`apps/web/src/admin/admin-api.ts`)
Using standard fetch wrappers with error translation matching `apps/web/src/api/client.ts`:
- `getAdminConfig(signal?: AbortSignal)`: `GET /api/config/public`
- `updateAdminConfig(key: string, value: unknown, reason: string)`: `POST /api/admin/config`
- `getFraudFlags(params?: { status?: string; limit?: number })`: `GET /api/admin/fraud/flags`
- `getFrozenRewards(params?: { status?: string; limit?: number })`: `GET /api/admin/fraud/frozen`
- `reviewReward(rewardId: string, decision: 'approve' | 'reject', reason: string)`: `POST /api/admin/fraud/review`
- `getAuditLogs(limit?: number)`: `GET /api/admin/audit-logs`

### 5.4 State Management Strategy
- **React Query (`@tanstack/react-query`)**:
  - `queryKey: ['admin', 'flags']` (staleTime: 15s)
  - `queryKey: ['admin', 'fraud-flags']` (staleTime: 30s)
  - `queryKey: ['admin', 'frozen-rewards']` (staleTime: 30s)
  - `queryKey: ['admin', 'audit-logs']` (staleTime: 15s)
- **Mutations**:
  - `useMutation` for `updateConfig` -> invalidates `['admin', 'flags']` and `['admin', 'audit-logs']`.
  - `useMutation` for `reviewReward` -> invalidates `['admin', 'frozen-rewards']`, `['admin', 'fraud-flags']`, and `['admin', 'audit-logs']`.
- **Local State**:
  - Active tab selection (`tab: AdminTab`).
  - Search queries and status filters.
  - Confirmation dialog open state and active selected item.
  - Reason input text state.

---

## 6. Test Cases & Verification Suite Plan

Following the monorepo's established test patterns (`vitest` + `react-dom/server` + component testing):

### 6.1 Admin Access Gate Tests (`apps/web/src/shell/admin-gate.test.ts`)
1. `isDesignatedAdmin` returns `true` for `"Barandnz"`, `"barandnz"`, `"@Barandnz"`, `"@BARANDNZ"`.
2. `isDesignatedAdmin` returns `true` for `"Mberked"`, `"mberked"`, `"@Mberked"`.
3. `isDesignatedAdmin` returns `false` for standard players (e.g. `"crypto_whale"`, `null`, `undefined`, `""`).
4. Handles edge cases: whitespace padding (`"  @barandnz  "`), special characters, and missing username.

### 6.2 Admin Screen Rendering Tests (`apps/web/src/admin/admin-screen.test.tsx`)
1. **Access Control**:
   - Renders 403 Forbidden alert when non-admin user is passed.
   - Renders full admin panel with header badge when `@Barandnz` or `@Mberked` is passed.
2. **Feature Flags Tab**:
   - Renders toggle switches for `feature.stars_payments`, `feature.maintenance_mode`, and `feature.referrals`.
   - Verified that switches render valid ARIA roles (`role="switch"`, `aria-checked="true"` / `false`).
   - Verified disabled states during pending mutations.
3. **Fraud Review Tab**:
   - Renders table/cards for flagged users and frozen rewards.
   - Verifies risk score pill styling (Green/Amber/Red bands).
   - Verifies quick action buttons ("İncele", "Onayla", "Dondurmayı Kaldır") with accessible labels.
4. **Audit Log Tab**:
   - Renders chronological log entries with admin handle, action badge, target, diff pills, and reasons.
   - Renders empty state gracefully when no audit logs exist.
5. **Astra 6.0 Theme Compatibility**:
   - Checks that all elements render without layout shift or broken classes under both light and dark theme context.

---

## 7. Quality Gates & Risk Assessment

| Risk / Consideration | Mitigation Strategy |
|---|---|
| Accidental leakage of admin views to normal players | Dual-layer gate: Strict client-side check (`isDesignatedAdmin`) suppresses all triggers; API endpoints strictly reject with 403. |
| Inadvertent layout shift on mobile devices | Strict min-height constraints on cards and switches; CSS layout containment; skeleton loaders for asynchronous tables. |
| Player screen CSS pollution | Complete isolation of admin styles into `admin.css` with scoped prefixes (`.admin-*`). No modifications to shared player CSS. |
| Stale configuration in multi-admin scenarios | React Query query invalidation on every mutation + explicit "Yenile" button for real-time synchronization. |

---

## 8. Conclusion

All prerequisites, file boundaries, access policies, and UI specifications for **Requirement R4 (Admin Web Dashboard UI)** are fully investigated, mapped out, and aligned with monorepo standards. The implementation stream can proceed directly into creating the isolated modules in `apps/web/src/screens/admin-screen.tsx`, `apps/web/src/admin/`, and `apps/web/src/shell/` with 100% confidence.
