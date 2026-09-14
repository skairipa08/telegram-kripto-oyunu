# Project: Project Empire — Backend, Data Engineering & Game Logic (Steps 7, 8, 9, 11)

## Architecture
The project follows a 4-layer monorepo architecture:
1. **`packages/game-core`**: Pure, deterministic, zero-dependency game formulas and calculation models.
   - `src/leaderboard.ts`: Pure sorting, deterministic tie-breaking (`points DESC, updated_at ASC, user_id ASC`), cursor pagination, rank pinning, season freeze validation.
   - `src/monetization.ts`: Convenience Pass offline earning cap (12h = 43,200s vs 4h = 14,400s free), queue slots (3 vs 1), additive duration stacking (30 days), strict anti-P2W guardrails (no season points or boosts).
   - `src/remote-config.ts`: 2-tier fallback hierarchy (`DB economy_config -> in-memory DEFAULT_ECONOMY_CONFIG`), 20 canonical Blueprint Section 18 keys, feature flag evaluator (`feature.token` strictly defaulting to `false`).
   - `src/analytics.ts`: 21 canonical Section 18 event names validation, UTC-normalized retention cohorts (D1, D2, D7), activation rate, payer conversion rate, ARPPU.
2. **`packages/shared`**: Zod DTO contracts and schemas shared across frontend and backend.
   - Leaderboard DTOs (`LeaderboardEntryDto`, `LeaderboardResponseDto`, `LeaderboardQuerySchema`).
   - Monetization DTOs (`ShopSkuDto`, `ConveniencePassDto`, `ShopCatalogResponseDto`, `CreateInvoiceRequestDto`, `CreateInvoiceResponseDto`, `FulfillPaymentRequestDto`, `FulfillPaymentResponseDto`).
   - Remote Config DTOs (`EconomyConfigDto`, `ConfigAuditLogDto`, `UpdateConfigRequestDto`).
   - Analytics DTOs (`CanonicalAnalyticsEventName` 21 events enum, `TrackAnalyticsEventsRequestDto`, `RetentionCohortDto`).
3. **`supabase/migrations/`**: PostgreSQL DDL migrations tested via PGlite in-memory engine.
   - `202609140005_step7_to_11_backend.sql`:
     - Composite index: `season_scores(season_id, points DESC, updated_at ASC, user_id ASC)`.
     - `season_archives`: Historical season final rank preservation.
     - `purchases`: Unique `telegram_payment_charge_id` for idempotent webhook fulfillment.
     - `player_entitlements`: Convenience Pass status and expiration.
     - `admin_audit_logs`: Audit trail for config and season mutations.
     - `analytics_events` & `daily_metrics`: Ingestion and aggregate storage.
     - `economy_config`: Seed all 20 canonical keys from Blueprint Section 18.
4. **`apps/api`**: Cloudflare Workers / Hono API routing and store orchestration.
   - `/leaderboard`, `/leaderboard/friends`: Global and friend rank queries, pagination, rank pinning.
   - `/shop/catalog`, `/shop/invoice`, `/telegram/webhook`: Stars invoice generation and idempotent payment webhook fulfillment.
   - `/config/public`, `/admin/config`: Config retrieval with fallback and mutation with audit trail.
   - `/analytics/events`, `/analytics/retention`: Event ingestion and cohort retention calculations.
5. **Astra 6.0 Isolation Boundary**:
   - `apps/web`: Strictly untouched (0 visual components or CSS styles modified).
   - Anti-cheat / anti-fraud: Strictly untouched.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Deterministic Leaderboards | Deterministic tie-breaking (`points DESC, updated_at ASC, user_id ASC`), cursor pagination | M1 | Blueprint R6 |
| 2 | User Rank Pinning | Exact rank and score lookup for the requesting player | M1 | Blueprint R6 |
| 3 | Season Freeze & Archiving | Freeze status transition, points freeze, archive snapshot table | M1 | Blueprint R6 |
| 4 | Composite Index on Scores | Index on `season_scores(season_id, points DESC, updated_at ASC, user_id ASC)` | M1 | Blueprint R6 |
| 5 | Stars Invoicing | Telegram Stars invoice creation contract and catalog | M2 | Blueprint R7 |
| 6 | Idempotent Payment Webhook | Webhook fulfillment using unique `telegram_payment_charge_id` | M2 | Blueprint R7 |
| 7 | Convenience Pass Entitlement | 12h offline cap (43,200s), 3 queue slots, additive 30-day duration stacking | M2 | Blueprint R7 |
| 8 | Anti-P2W Guardrail | Strict zero season points multipliers, zero competitive rank boosts for Stars | M2 | Blueprint R7 |
| 9 | Remote Config Fallback | 2-tier fallback hierarchy (DB override -> in-memory defaults) for 20 Section 18 keys | M3 | Blueprint R8 |
| 10 | Feature Flag Evaluator | Safe feature flag engine (`feature.token` strictly defaulting to false) | M3 | Blueprint R8 |
| 11 | Admin Audit Logging | Mutation audit trail table `admin_audit_logs` tracking user, action, old/new values | M3 | Blueprint R8 |
| 12 | 21 Canonical Analytics Events | Zod taxonomy validating all 21 Blueprint Section 18 event names | M4 | Blueprint R10 / Sec 18 |
| 13 | Cohort Retention Calculation | Pure UTC calendar-day models for D1, D2, D7 retention cohorts | M4 | Blueprint R10 |
| 14 | KPI Calculation Models | Activation rate, payer conversion rate, ARPPU models | M4 | Blueprint R10 |
| 15 | Testing & Quality Gate | `pnpm check` exit code 0, Prettier fix, comprehensive automated tests | M5 | Workspace Gates |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Leaderboards Engine & Season Freeze | Composite index, `season_archives`, pure ranking/pagination, rank pinning, freeze | none | DONE |
| M2 | Stars Monetization & Pass Entitlement | `purchases`, `player_entitlements`, 12h cap, idempotent webhook, anti-P2W contracts | none | DONE |
| M3 | Admin Remote Config & Feature Flags | `economy_config` 20 keys, `admin_audit_logs`, 2-tier fallback, `feature.token` false | none | DONE |
| M4 | Analytics Pipeline & Cohort Models | `analytics_events`, `daily_metrics`, 21-event validator, D1/D2/D7 retention models | none | DONE |
| M5 | E2E Integration, Quality Gates & Verification | Monorepo integration, API routes, `pnpm check` exit 0, forensic audit, HANDOFF.md | M1, M2, M3, M4 | DONE |
