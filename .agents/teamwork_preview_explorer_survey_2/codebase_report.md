# Project Empire — Comprehensive Codebase Survey Report
**Agent**: `teamwork_preview_explorer_survey_2`  
**Role**: Teamwork Explorer (Codebase & Architecture Survey)  
**Date**: 2026-09-14  
**Target Scope**: Steps 7, 8, 9, 11 (Blueprint R6, R7, R8, R10) across `packages/game-core`, `packages/shared`, `apps/api`, and `supabase/migrations/`  
**Boundary Constraints**: Strictly NO UI changes (`apps/web`), NO anti-cheat/exploit modifications (Astra 6.0 reserved).

---

## 1. Executive Summary

A comprehensive investigation of the Project Empire monorepo was conducted across all four requested architectural tiers:
1. `packages/game-core`: Pure TypeScript calculation library.
2. `packages/shared`: Shared Zod DTO contracts and schemas.
3. `apps/api`: Cloudflare Workers runtime powered by Hono.
4. `supabase/migrations/`: Version-controlled PostgreSQL migrations.

### Current Implementation State (Steps 1–6 Complete)
- **Step 1 (R0)**: Monorepo workspace (pnpm 9.1, TypeScript 5.9, ESLint 10, Prettier 3, Vitest 3), `/health` endpoint.
- **Step 2 (R1)**: Telegram WebApp `initData` HMAC validation, 300s window, replay mitigation, cookie session (`__Host-empire_session`), `apps/api/src/auth/` routes and PGlite test harness.
- **Step 3 (R2)**: Core economy deterministic formulas (upgrade cost, milestone multipliers, production rate, offline earnings, SRU curve, referral whale factor), canonical 6 businesses, `202609140002_economy.sql`.
- **Step 4 (R3)**: Empire UI (reserved for Astra 6.0).
- **Step 5 (R4)**: Seasons & Missions logic (`packages/game-core/src/missions.ts`), 9 canonical missions, streak evaluation, `202609140003_seasons_missions.sql`.
- **Step 6 (R5)**: Referral engine (`packages/game-core/src/referral.ts`), deep links, 30m bind window, self-referral prevention, 4-stage milestone lifecycle (`activation`, `retained_d2`, `retained_d7`, `progression`), `202609140004_referrals.sql`.

Currently, **83/83 unit tests pass** across the repository.

---

## 2. Monorepo Anatomy & Architecture Patterns

### 2.1 `packages/game-core`
- **Package Config**: Pure ESM module (`"type": "module"`, `"exports": "./src/index.ts"`).
- **Current Files**:
  - `src/index.ts`: Re-exports `config.ts`, `formulas.ts`, `missions.ts`, `referral.ts`.
  - `src/config.ts`: Contains `DEFAULT_BUSINESSES` (6 canonical businesses: Street Stand, Cafe, Delivery Hub, Factory, Tech Company, Global Holding) and `DEFAULT_ECONOMY_CONFIG` (all default economy numbers, offline caps, growth rates, SRU baseline, and feature flag defaults).
  - `src/formulas.ts`: Pure formulas for upgrade costs, milestone multipliers (2x at 10, 25, 50, 100; +50 levels x1.5), production/sec, total production, offline earnings (with configurable `capSeconds`), SRU emission formula, and referral whale diminishing factor.
  - `src/missions.ts`: Mission definitions, SRU difficulty multipliers (`easy`: 0.75x, `normal`: 1.00x, `hard`: 1.25x, `weekly`: 5.00x), streak rewards (0.25x daily, 1.00x cycle bonus on day 7), UTC consecutive day streak evaluation.
  - `src/referral.ts`: Referral code parsing (`ref_<code>`), deep link generator, 30-minute bind window check, self-referral check, 4-stage milestone reward evaluation (5.00x total SRU), whale diminishing factor application, and 7 cosmetic/non-P2W tier badges.
- **Conventions & Constraints**:
  - 100% side-effect free, deterministic, no network/database/filesystem imports.
  - Strict mathematical guarantees with floating point precision rounding (e.g. `Math.round`, `toFixed(4)`).

### 2.2 `packages/shared`
- **Package Config**: ESM module exporting Zod schemas and derived TypeScript types. Zod version: `^4.1.12`.
- **Current Schemas**:
  - Health: `healthResponseSchema`.
  - Auth: `telegramLoginSchema`.
  - Economy: `playerBusinessSchema`, `playerEconomyStateSchema`, `playerStateSchema`, `claimCashRequestSchema`, `claimCashResponseSchema`, `upgradeBusinessRequestSchema`, `upgradeBusinessResponseSchema`.
  - Seasons & Missions: `seasonStatusSchema`, `seasonDtoSchema`, `missionDifficultySchema`, `playerMissionInstanceSchema`, `playerStreakDtoSchema`, `claimMissionRequestSchema`, `claimMissionResponseSchema`, `claimStreakRequestSchema`, `claimStreakResponseSchema`.
  - Referrals: `referralMilestoneSchema`, `playerReferralOverviewSchema`, `bindReferralRequestSchema`, `bindReferralResponseSchema`, `referralEventItemSchema`, `claimReferralRewardRequestSchema`, `claimReferralRewardResponseSchema`.
- **Conventions & Constraints**:
  - Request schemas enforce `.strict()` to reject extraneous payload properties.
  - DateTime strings are standardized via `z.iso.datetime()`.
  - UUIDs validated via `z.uuid()`.

### 2.3 `apps/api`
- **Runtime & Framework**: Hono (`^4.10.0`) running on Cloudflare Workers (configured in `wrangler.jsonc`).
- **Structure**:
  - `src/index.ts`: Application factory `createApp(makeStore?, now?)`. Registers `/health`, `/api/health`, mounts auth routes at `/` and `/api`, handles 404.
  - `src/auth/env.ts`: `Bindings` interface (`TELEGRAM_BOT_TOKEN`, `SESSION_SECRET`, `APP_ORIGIN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_RATE_LIMIT`) and `authConfig` parser.
  - `src/auth/crypto.ts`: Web Crypto HMAC SHA-256 for Telegram initData validation and session signing (`__Host-empire_session`).
  - `src/auth/store.ts`: `AuthStore` interface and `SupabaseAuthStore` implementation communicating via PostgREST RPC (`/rest/v1/rpc/*`) using `fetch`.
  - `src/auth/routes.ts`: Security middleware (Cache-Control, X-Content-Type-Options, Referrer-Policy, bodyLimit 20KB, Origin check, Content-Type check), `/auth/telegram`, `/me/state`, `/auth/logout`.
  - `src/auth/test-db.ts`: In-memory Postgres test harness using `@electric-sql/pglite`. Automatically executes raw SQL migrations from `supabase/migrations/` and mocks PostgREST RPC endpoints in unit tests.
- **Key Architectural Pattern**:
  - All endpoints are stateless and server-authoritative.
  - Handlers accept dependency-injected stores/fetchers, enabling seamless testing with PGlite without running external services.

### 2.4 `supabase/migrations/`
- **202609140001_auth.sql**:
  - Tables: `users` (telegram_user_id unique, risk_score, status), `auth_sessions` (fingerprint unique, 30m expiry).
  - RPCs: `empire_auth_session`, `empire_auth_login`, `empire_auth_logout`.
  - RLS enabled; public access revoked; granted to `service_role`.
- **202609140002_economy.sql**:
  - Tables: `economy_config` (key PK, value jsonb), `businesses` (6 canonical businesses), `player_balances` (cash, season_points), `player_businesses` (levels, last_claim_at), `reward_ledger` (idempotency_key unique, immutable transaction log).
- **202609140003_seasons_missions.sql**:
  - Tables: `seasons` (status, starts_at, ends_at, sru_snapshot, qap_snapshot), `season_scores` (season_id, user_id, points, mission_points, referral_points, PK (season_id, user_id)), `missions` (9 canonical missions), `mission_instances` (daily assignment, unique per date), `player_streaks` (current_streak, longest_streak, last_claim_date).
  - Index: `season_scores_leaderboard_idx on public.season_scores(season_id, points desc)`.
- **202609140004_referrals.sql**:
  - Tables: `users.referral_code` column, `referrals` (invitee_user_id unique, referrer_user_id, check invitee <> referrer), `referral_events` (unique (referral_id, milestone), status).

---

## 3. Detailed Gap Analysis & Requirements Mapping

### Domain 1: Leaderboards Engine & Season Freeze (R1 / Blueprint R6)

#### What Already Exists
1. `supabase/migrations/202609140003_seasons_missions.sql`:
   - `seasons` table with status enum (`upcoming`, `active`, `frozen`, `ended`).
   - `season_scores` table with `points`, `mission_points`, `referral_points`.
   - Index on `season_scores(season_id, points desc)`.
2. `packages/shared/src/index.ts`:
   - `seasonStatusSchema` and `seasonDtoSchema`.

#### What Is Missing & Needs to Be Created
1. **Database Tier (`supabase/migrations/`)**:
   - **Composite Index for Deterministic Tie-Breaking**: The existing index `(season_id, points desc)` does NOT index tie-breaking columns. Needs:
     ```sql
     CREATE INDEX season_scores_ranking_idx ON public.season_scores(season_id, points DESC, updated_at ASC, user_id ASC);
     ```
   - **Season Final Rank Archive Table (`season_archives`)**: When a season freezes, final ranks must be permanently preserved:
     ```sql
     CREATE TABLE public.season_archives (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
       user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
       final_rank INTEGER NOT NULL CHECK (final_rank > 0),
       final_points BIGINT NOT NULL CHECK (final_points >= 0),
       mission_points BIGINT NOT NULL DEFAULT 0,
       referral_points BIGINT NOT NULL DEFAULT 0,
       archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
       UNIQUE (season_id, user_id)
     );
     CREATE INDEX season_archives_rank_idx ON public.season_archives(season_id, final_rank ASC);
     ```
   - **Season Freeze Score Mutation Guardrail**: Function or trigger preventing updates to `season_scores` when `seasons.status IN ('frozen', 'ended')`.
2. **Game Logic Tier (`packages/game-core`)**:
   - Create `packages/game-core/src/leaderboard.ts`:
     - `rankLeaderboardEntries(scores)`: Pure function sorting by `points DESC`, `updated_at ASC`, `user_id ASC`, assigning deterministic ranks `1..N`.
     - `calculateUserRank(scores, userId)`: Exact rank determination.
     - `paginateLeaderboard(rankedEntries, { limit, offset, cursor })`: Deterministic cursor and offset pagination with keyset encoding.
     - `filterFriendsLeaderboard(scores, currentUserId, friendUserIds)`: Filters scores to friends network and applies identical ranking.
     - `isSeasonActive(season)` and `canMutateSeasonScore(seasonStatus)`: Freeze state rules.
3. **Contracts Tier (`packages/shared`)**:
   - `leaderboardScopeSchema`: `'global' | 'friends'`.
   - `leaderboardEntryDtoSchema`: `{ rank, userId, username, firstName, points, missionPoints, referralPoints, isCurrentUser }`.
   - `leaderboardQuerySchema`: `{ seasonId?, scope, limit (1..100, default 20), offset, cursor? }`.
   - `leaderboardResponseSchema`: `{ apiVersion, season, entries, currentUser, totalCount, nextCursor, hasMore }`.
   - `freezeSeasonRequestSchema` / `freezeSeasonResponseSchema`.
4. **Backend API Tier (`apps/api`)**:
   - Route `GET /leaderboard` (and `/api/leaderboard`):
     - Authenticates user session.
     - Fetches paginated entries (global or friends).
     - Pins current user's exact rank and score regardless of current page.
   - Route `POST /admin/seasons/:id/freeze`:
     - Transitions season status to `'frozen'`.
     - Freezes scores, computes final ranks, and inserts into `season_archives`.

---

### Domain 2: Stars Monetization & Pass Entitlement Backend (R2 / Blueprint R7)

#### What Already Exists
1. `supabase/migrations/202609140002_economy.sql`:
   - `economy_config` seeds for `economy.offline_cap_free_sec` (14400 / 4h), `economy.offline_cap_pass_sec` (43200 / 12h), `feature.stars_payments` (false).
2. `packages/game-core/src/config.ts`:
   - `DEFAULT_ECONOMY_CONFIG` contains `passPriceStars: 250`, `passDurationDays: 30`, `offlineCapFreeSec: 14400`, `offlineCapPassSec: 43200`.
3. `packages/game-core/src/formulas.ts`:
   - `calculateOfflineEarnings` already accepts `capSeconds` parameter.

#### What Is Missing & Needs to Be Created
1. **Database Tier (`supabase/migrations/`)**:
   - **Purchases Table (`purchases`)**:
     ```sql
     CREATE TABLE public.purchases (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
       telegram_payment_charge_id TEXT UNIQUE CHECK (telegram_payment_charge_id IS NULL OR length(telegram_payment_charge_id) > 0),
       invoice_payload TEXT NOT NULL UNIQUE CHECK (length(invoice_payload) BETWEEN 16 AND 128),
       sku TEXT NOT NULL CHECK (sku IN ('convenience_pass_30d', 'cosmetic_frame_gold', 'cosmetic_emblem_founder')),
       stars_amount INTEGER NOT NULL CHECK (stars_amount > 0),
       status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
       metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
       created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
       completed_at TIMESTAMPTZ
     );
     CREATE INDEX purchases_user_id_idx ON public.purchases(user_id);
     ```
   - **Player Entitlements / Convenience Pass Table (`player_entitlements`)**:
     ```sql
     CREATE TABLE public.player_entitlements (
       user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
       pass_type TEXT NOT NULL DEFAULT 'convenience_pass',
       is_active BOOLEAN NOT NULL DEFAULT true,
       starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
       expires_at TIMESTAMPTZ NOT NULL,
       updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
     );
     CREATE INDEX player_entitlements_expires_idx ON public.player_entitlements(expires_at);
     ```
2. **Game Logic Tier (`packages/game-core`)**:
   - Create `packages/game-core/src/monetization.ts`:
     - `calculateConveniencePassEntitlements(isPassActive)`:
       - Returns `{ offlineCapSeconds: 43200 | 14400, upgradeQueueSlots: 3 | 1, missionRerolls: 3 | 1, autoClaimEnabled: boolean, seasonPointsMultiplier: 1.0 }`.
       - **Anti-P2W Invariant**: `seasonPointsMultiplier` strictly locked to `1.0`. Base production rates remain untouched.
     - `calculatePassExpiry(currentExpiresAt, durationDays, now)`:
       - If currently active, stacks additively (`currentExpiresAt + durationDays * 86400s`).
       - If expired or new, sets to `now + durationDays * 86400s`.
     - `isPassActive(expiresAt, now)`: Checks if pass is unexpired.
     - `validateP2WRestrictions(sku, effects)`: Asserts SKU never provides Season Points, SRU multipliers, or direct Cash.
     - Canonical SKUs: `DEFAULT_SKUS` (`convenience_pass_30d`, 250 Stars).
3. **Contracts Tier (`packages/shared`)**:
   - `shopSkuDtoSchema`: `{ sku, name, description, starsPrice, category: 'pass' | 'cosmetic', durationDays? }`.
   - `conveniencePassDtoSchema`: `{ isActive, expiresAt, offlineCapSeconds, upgradeQueueSlots, missionRerolls, autoClaimEnabled }`.
   - `shopCatalogResponseSchema`: `{ apiVersion, skus: ShopSkuDto[], passStatus: ConveniencePassDto }`.
   - `createInvoiceRequestSchema`: `{ sku, requestId }`.
   - `createInvoiceResponseSchema`: `{ apiVersion, sku, starsPrice, invoiceLink, invoicePayload }`.
   - `fulfillPaymentRequestSchema`: `{ telegramPaymentChargeId, invoicePayload, starsAmount }`.
   - `fulfillPaymentResponseSchema`: `{ apiVersion, success, duplicate, purchaseId, newPassExpiresAt }`.
4. **Backend API Tier (`apps/api`)**:
   - Route `GET /shop` (and `/api/shop`): Returns catalog and current user pass entitlement status.
   - Route `POST /shop/invoice` (and `/api/shop/invoice`): Validates SKU (rejecting forbidden/P2W SKUs), returns invoice payload and link.
   - Route `POST /telegram/webhook` (and `/api/telegram/webhook`):
     - Handles Telegram `pre_checkout_query` (validates currency `XTR`, returns `{ ok: true }`).
     - Handles `successful_payment`: Idempotent fulfillment using `telegram_payment_charge_id`. If duplicate, acknowledges without re-extending pass. Extends `player_entitlements` and logs to `reward_ledger`.

---

### Domain 3: Admin Remote Config & Feature Flags (R3 / Blueprint R8)

#### What Already Exists
1. `supabase/migrations/202609140002_economy.sql`:
   - `economy_config` table (`key`, `value`, `description`, `updated_at`).
   - 13 initial keys seeded.
2. `packages/game-core/src/config.ts`:
   - `DEFAULT_ECONOMY_CONFIG` with all 18 Section 18 keys.

#### What Is Missing & Needs to Be Created
1. **Database Tier (`supabase/migrations/`)**:
   - **Missing Section 18 Seed Keys**:
     - `pass.price_stars` (250)
     - `pass.duration_days` (30)
     - `mission.daily_slots` (3)
     - `mission.free_rerolls` (1)
     - `mission.pass_rerolls` (3)
     - `feature.leaderboard` (true)
     - `feature.referrals` (true)
   - **Admin Audit Log Table (`admin_audit_logs`)**:
     ```sql
     CREATE TABLE public.admin_audit_logs (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       admin_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
       action TEXT NOT NULL CHECK (action IN ('update_config', 'set_feature_flag', 'freeze_season', 'ban_user', 'refund_purchase')),
       target_type TEXT NOT NULL CHECK (target_type IN ('economy_config', 'feature_flag', 'season', 'user', 'purchase')),
       target_key TEXT NOT NULL,
       old_value JSONB,
       new_value JSONB NOT NULL,
       reason TEXT CHECK (reason IS NULL OR length(reason) <= 256),
       created_at TIMESTAMPTZ NOT NULL DEFAULT now()
     );
     CREATE INDEX admin_audit_logs_target_idx ON public.admin_audit_logs(target_type, target_key);
     CREATE INDEX admin_audit_logs_created_at_idx ON public.admin_audit_logs(created_at DESC);
     ```
2. **Game Logic Tier (`packages/game-core`)**:
   - Create `packages/game-core/src/remote-config.ts`:
     - `resolveEconomyConfig(dbOverrides)`: Pure merge of DB key/values over `DEFAULT_ECONOMY_CONFIG`. Handles snake_case to camelCase conversion, validates number bounds, falls back safely to default on missing/corrupt values.
     - `isFeatureEnabled(flags, flagKey)`: Evaluates feature flags. `feature.token` strictly defaults to `false`.
     - `formatAuditEntry(...)`: Helper for consistent audit entry payloads.
3. **Contracts Tier (`packages/shared`)**:
   - `economyConfigDtoSchema`: Zod schema for full 18-parameter config.
   - `publicConfigResponseSchema`: `{ apiVersion, config: EconomyConfigDto, featureFlags: Record<string, boolean> }`.
   - `configAuditLogDtoSchema`: `{ id, action, targetType, targetKey, oldValue, newValue, reason, createdAt }`.
   - `updateConfigRequestSchema`: `{ key, value, reason, requestId }`.
   - `updateConfigResponseSchema`: `{ apiVersion, success, key, updatedValue, auditLogId }`.
4. **Backend API Tier (`apps/api`)**:
   - Route `GET /config/public` (and `/api/config/public`): Returns client-facing economy constants and active feature flags (masking admin internals).
   - Route `POST /admin/config` (and `/api/admin/config`): Atomically updates `economy_config` and creates an `admin_audit_logs` entry in a single transaction.

---

### Domain 4: Analytics Event Pipeline & Cohort Models (R4 / Blueprint R10 & Section 18)

#### What Already Exists
- No analytics files, schemas, or migrations currently exist in the repository.
- Blueprint Section 18 specifies the 21 canonical events.

#### What Is Missing & Needs to Be Created
1. **Database Tier (`supabase/migrations/`)**:
   - **Analytics Events Table (`analytics_events`)**:
     ```sql
     CREATE TABLE public.analytics_events (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
       event_name TEXT NOT NULL CHECK (event_name IN (
         'app_open', 'auth_success', 'tutorial_complete', 'business_upgrade', 'cash_claim',
         'mission_assigned', 'mission_complete', 'mission_claim', 'streak_claim',
         'referral_link_copy', 'referral_bound', 'referral_milestone_qualified', 'referral_reward_claim',
         'leaderboard_view', 'shop_view', 'invoice_created', 'payment_success', 'payment_refund',
         'fraud_flag_created', 'reward_frozen', 'pass_activated'
       )),
       properties JSONB NOT NULL DEFAULT '{}'::jsonb,
       session_id UUID,
       created_at TIMESTAMPTZ NOT NULL DEFAULT now()
     );
     CREATE INDEX analytics_events_name_date_idx ON public.analytics_events(event_name, created_at);
     CREATE INDEX analytics_events_user_date_idx ON public.analytics_events(user_id, created_at);
     ```
   - **Daily Metrics Aggregation Table (`daily_metrics`)**:
     ```sql
     CREATE TABLE public.daily_metrics (
       date DATE PRIMARY KEY,
       qap INTEGER NOT NULL DEFAULT 0,
       sru INTEGER NOT NULL DEFAULT 500,
       dau INTEGER NOT NULL DEFAULT 0,
       new_users INTEGER NOT NULL DEFAULT 0,
       qualified_referrals INTEGER NOT NULL DEFAULT 0,
       revenue_stars INTEGER NOT NULL DEFAULT 0,
       updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
     );
     ```
2. **Game Logic Tier (`packages/game-core`)**:
   - Create `packages/game-core/src/analytics.ts`:
     - `CANONICAL_ANALYTICS_EVENTS`: Const array of the 21 Section 18 events.
     - `calculateActivationRate(signupsCount, activatedCount)`: Safe division returning activation percentage.
     - `calculateRetentionCohorts(userSessions)`:
       - Inputs: `{ userId, signupDate (UTC YYYY-MM-DD), activeDates: string[] }[]`.
       - Computes D1 (active on `signupDate + 1d`), D2 (active on `signupDate + 2d`), D7 (active on `signupDate + 7d` or >= 4 active days in 7-day window).
       - Zero-safe rates.
     - `calculateReferralRetention(activeDates, signupDate)`: Validates `retained_d2` (>= 2 distinct active days) and `retained_d7` (>= 4 active days in first 7 days).
     - `calculatePaymentConversion(uniqueUsersCount, payingUsersCount, totalStarsRevenue)`: Computes conversion rate and ARPPU (Average Revenue Per Paying User).
3. **Contracts Tier (`packages/shared`)**:
   - `canonicalAnalyticsEventSchema`: Zod enum of the 21 events.
   - `trackAnalyticsEventItemSchema`: `{ eventName, properties, timestamp?, sessionId? }`.
   - `trackAnalyticsEventsRequestSchema`: `{ events: TrackAnalyticsEventItem[], requestId }`.
   - `trackAnalyticsEventsResponseSchema`: `{ apiVersion, trackedCount, acceptedAt }`.
   - `retentionCohortDtoSchema`: `{ cohortDate, totalSignups, d1Count, d1Rate, d2Count, d2Rate, d7Count, d7Rate }`.
   - `analyticsMetricsResponseSchema`: `{ apiVersion, activationRate, payerConversionRate, totalStarsRevenue, arppu, cohorts }`.
4. **Backend API Tier (`apps/api`)**:
   - Route `POST /analytics/events` (and `/api/analytics/events`): Validates incoming events against Section 18 taxonomy and persists to `analytics_events`.
   - Route `GET /analytics/metrics` (and `/api/analytics/metrics`): Queries aggregated metrics, runs cohort retention calculation, and returns report.

---

## 4. Master Implementation Checklist & Blueprint Matrix

| Area | Packages / Apps | File to Create / Modify | Purpose |
|------|-----------------|-------------------------|---------|
| **R1 Leaderboards** | `packages/game-core` | `src/leaderboard.ts`, `src/leaderboard.test.ts` | Deterministic ranking, tie-breaking, pagination, rank pinning, season freeze check |
| | `packages/shared` | `src/index.ts` | `LeaderboardEntryDto`, `LeaderboardResponseDto`, query schemas, freeze schemas |
| | `supabase/migrations` | `202609140005_step7_to_11_backend.sql` | `season_scores` tie-breaker index, `season_archives` table, RLS |
| | `apps/api` | `src/leaderboard/routes.ts`, `src/leaderboard/store.ts` | `GET /leaderboard`, `POST /admin/seasons/:id/freeze` |
| **R2 Stars & Pass** | `packages/game-core` | `src/monetization.ts`, `src/monetization.test.ts` | Convenience Pass entitlements (12h cap), additive stacking, anti-P2W guardrail |
| | `packages/shared` | `src/index.ts` | `ShopSkuDto`, `ConveniencePassDto`, invoice and webhook fulfillment schemas |
| | `supabase/migrations` | `202609140005_step7_to_11_backend.sql` | `purchases` table, `player_entitlements` table, RLS |
| | `apps/api` | `src/shop/routes.ts`, `src/shop/store.ts` | `GET /shop`, `POST /shop/invoice`, `POST /telegram/webhook` |
| **R3 Remote Config** | `packages/game-core` | `src/remote-config.ts`, `src/remote-config.test.ts` | Safe fallback resolver, feature flag evaluator (`feature.token` false) |
| | `packages/shared` | `src/index.ts` | `PublicConfigDto`, `FeatureFlagsDto`, audit log DTOs |
| | `supabase/migrations` | `202609140005_step7_to_11_backend.sql` | Section 18 config seeds, `admin_audit_logs` table, RLS |
| | `apps/api` | `src/config/routes.ts`, `src/config/store.ts` | `GET /config/public`, `POST /admin/config` |
| **R4 Analytics** | `packages/game-core` | `src/analytics.ts`, `src/analytics.test.ts` | Section 18 taxonomy validator, D1/D2/D7 retention models, conversion models |
| | `packages/shared` | `src/index.ts` | 21 canonical event enum, track event request/response, cohort DTOs |
| | `supabase/migrations` | `202609140005_step7_to_11_backend.sql` | `analytics_events` table, `daily_metrics` table, RLS |
| | `apps/api` | `src/analytics/routes.ts`, `src/analytics/store.ts` | `POST /analytics/events`, `GET /analytics/metrics` |
| **Integration** | `packages/game-core` | `src/index.ts` | Export `leaderboard`, `monetization`, `remote-config`, `analytics` |
| | `apps/api` | `src/index.ts` | Mount leaderboard, shop, config, and analytics route modules |
| | `apps/api` | `src/auth/test-db.ts` | Run `202609140005_step7_to_11_backend.sql` in PGlite test harness |

---

## 5. Strict Boundary Enforcement
- **No UI Changes**: Visual interfaces for Leaderboards, Shop, Admin, and Friends remain completely untouched in `apps/web`.
- **No Anti-Cheat / Exploit Alterations**: Sybil clustering, bot graph analysis, and Honeypot rate limiting remain isolated for Astra 6.0.
- **Pure Functional Isolation**: All gameplay math is purely deterministic within `packages/game-core`, with zero side effects.
