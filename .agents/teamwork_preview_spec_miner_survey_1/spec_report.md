# Project Empire — Specification Mining Report
**Focus**: Blueprint R6 (Leaderboards & Freeze), Blueprint R7 (Stars & Entitlement), Blueprint R8 (Remote Config & Feature Flags), Blueprint R10 / Section 18 (Analytics Event Pipeline & Cohort Models)
**Miner**: `teamwork_preview_spec_miner_survey_1`
**Date**: 2026-09-14
**Source Document**: `Project_Empire_Master_Blueprint_v1.0.docx` & `ORIGINAL_REQUEST.md`

---

## Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Blueprint R6 | Global Leaderboard Query | Fetches paginated top season scores with deterministic tie-breaking and rank calculation | `seasonId: UUID`, `limit: number (1..100)`, `cursor?: string (base64 points+updatedAt+userId)` | Paginated list of entries (`rank, userId, username, points, isCurrentUser`), next cursor, total count | 400 on invalid cursor/limit, 404 if season not found | Blueprint R6, Sec 4, Sec 10, Sec 11 |
| 2 | Blueprint R6 | Friends Leaderboard Query | Ranks user and all bound referral connections (invitees + referrer) for the active season | `seasonId: UUID`, `currentUserId: UUID`, `limit: number` | Sub-leaderboard entries filtered to friend graph with local ranks, next cursor | 404 if season not found, returns user rank 1 if no friends | Blueprint R6, Sec 4, Sec 6, Sec 11 |
| 3 | Blueprint R6 | User Rank Pinning | Deterministically computes and attaches the querying user's exact global and friend rank | `seasonId: UUID`, `currentUserId: UUID` | Current player's exact rank (`rank: number, points: number`) regardless of pagination page | Returns rank `null` / unranked if user has 0 points and no score record | Blueprint R6, Sec 4, Sec 10, Sec 14 |
| 4 | Blueprint R6 | Deterministic Tie-Breaking | Pure ranking and sorting algorithm resolving identical season points | `entries: Array<{ userId, points, updatedAt }>` | Sorted array with deterministic unique ranks `1..N` | Deterministic fallback: `points DESC`, then `updatedAt ASC`, then `userId ASC` | Blueprint R6, Sec 10, Acceptance Criteria |
| 5 | Blueprint R6 | Season Freeze Routine | Locks an active season when ended; transitions status to `frozen` and blocks score mutations | `seasonId: UUID`, `adminUserId?: UUID`, `reason?: string` | Updated season record (`status: 'frozen'`, `frozenAt: string`, `archivedCount: number`) | 400 if season already frozen/ended, 403 if unauthorized | Blueprint R6, Sec 5, Sec 10, Sec 13 |
| 6 | Blueprint R6 | Season Score Archival & Snapshot | Creates immutable final ranking snapshot in `season_archives` and preserves past season records | `seasonId: UUID` | Archive snapshot rows containing `(season_id, user_id, final_rank, final_points, archived_at)` | Rejects duplicate archival if already archived (idempotent) | Blueprint R6, Sec 5, Sec 10, Sec 14 |
| 7 | Blueprint R6 | Season Score Reset & Lifetime Preservation | Resets active season scores for a new season while preserving lifetime cash and veteran profile badge | `newSeasonId: UUID`, `previousSeasonId: UUID` | Initialized season score records, lifetime stats intact, veteran badge assigned | Rejects carryover of Season Points or point multipliers (anti-P2W) | Blueprint R6, Sec 5, Sec 10 |
| 8 | Blueprint R7 | Shop SKU & Pricing Catalog | Returns sellable items with remote config Stars pricing (Convenience Pass, cosmetics) | None (or user session) | Array of SKUs (`sku, name, description, starsPrice, type, passDurationDays`) | Returns empty catalog or default pricing if remote config uninitialized | Blueprint R7, Sec 7, Sec 11, Sec 18 |
| 9 | Blueprint R7 | Telegram Stars Invoice Creation | Generates Telegram payment invoice link for Convenience Pass or cosmetics | `sku: string`, `userId: UUID`, `requestId: UUID` | `invoiceLink: string`, `invoicePayload: string`, `starsPrice: number` | 400 on invalid or non-sellable SKU (e.g., Season Points/Cash), 403 on disabled payments | Blueprint R7, Sec 7, Sec 10, Sec 11 |
| 10 | Blueprint R7 | Pre-Checkout Validation Webhook | Validates Telegram `pre_checkout_query` before payment capture | `preCheckoutQuery: { id, from, currency, total_amount, invoice_payload }` | `{ ok: true }` or `{ ok: false, error_message: string }` | Rejects non-XTR currency, mismatched amount, or unknown payload | Blueprint R7, Sec 7, Sec 11, Telegram S9 |
| 11 | Blueprint R7 | Idempotent Payment Fulfillment | Processes `successful_payment` from Telegram, logs purchase, and grants pass entitlement | `telegramPaymentChargeId: string`, `invoicePayload: string`, `starsAmount: number` | `{ success: true, duplicate: boolean, purchaseId: UUID, expiresAt: string }` | Duplicate charge returns success without re-fulfilling; unknown payload errors | Blueprint R7, Sec 10, Sec 11, Acceptance Criteria |
| 12 | Blueprint R7 | Convenience Pass Offline Cap Expansion | Expands offline earning calculation from 4h (14,400s) to 12h (43,200s) for active pass holders | `secondsSinceLastClaim: number`, `passExpiresAt: Date | null`, `baseProductionPerSec: number` | `offlineEarned: number`, `offlineCapSec: number (14400 or 43200)` | Never alters base production rate or multipliers; purely convenience | Blueprint R7, Sec 7, Sec 18 |
| 13 | Blueprint R7 | Convenience Pass Entitlement Stacking | Extends pass expiration additively if purchased while an existing pass is still active | `currentExpiresAt: Date | null`, `durationDays: number (default 30)` | `newExpiresAt: Date` (stacks on top of remaining time if active; else `now() + 30d`) | Rejects negative or zero duration | Blueprint R7, Sec 7, Sec 18 |
| 14 | Blueprint R7 | Convenience Pass Feature Entitlements | Grants 3 upgrade queue slots, 3 mission rerolls/day, auto-claim/reinvest flags | `userId: UUID`, `isPassActive: boolean` | Entitlement object (`upgradeQueueSlots: 3, missionRerolls: 3, autoClaim: true`) | Reverts to free defaults (1 slot, 1 reroll, no auto-claim) when expired | Blueprint R7, Sec 7, Sec 18 |
| 15 | Blueprint R7 | Anti-P2W Purchase Guardrail | Strict contract validator ensuring Stars cannot buy Season Points, SRU multipliers, or Cash | `sku: string` | Validation boolean or throws `P2WViolationError` | Explicitly rejects any request attempting to purchase competitive advantage | Blueprint R7, Sec 1, Sec 5, Sec 7 |
| 16 | Blueprint R8 | Remote Config Fallback Getter | Resolves configuration key from DB `economy_config` with safe in-memory default fallback | `key: string`, `fallbackValue: T` | Resolved value of type `T` (DB override if valid, else default) | Never crashes on missing key or DB connection failure; safely logs warning | Blueprint R8, Sec 10, Sec 18, Acceptance Criteria |
| 17 | Blueprint R8 | Remote Economy Parameters | Provides dynamic runtime tuning for offline caps, cost growth (1.18), production growth (1.07), SRU constants | `key: EconomyConfigKey` | Number / string / boolean config value | Validates type constraints before applying overrides | Blueprint R8, Sec 3, Sec 5, Sec 18 |
| 18 | Blueprint R8 | Feature Flag Evaluation Engine | Evaluates boolean feature toggles (`feature.token`, `feature.stars_payments`, etc.) | `flagKey: string`, `context?: { userId?: UUID }` | `boolean` (default `false` for token, explicit opt-in required) | Missing or corrupted flag strictly defaults to `false` | Blueprint R8, Sec 10, Sec 18, Acceptance Criteria |
| 19 | Blueprint R8 | Public Versioned Config Endpoint | Exposes safe, non-sensitive economy constants and enabled feature flags to client | None (or client version header) | Public config JSON (`apiVersion, offlineCapFreeSec, offlineCapPassSec, featureFlags`) | Masks internal secrets and admin configurations | Blueprint R8, Sec 11, Sec 18 |
| 20 | Blueprint R8 | Admin Config Mutation & Audit Log | Allows authorized admins to mutate config/flags and atomically records audit trail | `adminUserId: UUID`, `key: string`, `newValue: unknown`, `reason: string` | Updated config row and inserted `admin_audit_logs` record | 400 on invalid type/schema, 401/403 if not admin, aborts transaction if audit fails | Blueprint R8, Sec 10, Sec 13, Sec 14 |
| 21 | Blueprint R10 | Canonical Event Validation Schema | Zod schema validating incoming analytics events against Blueprint Section 18 taxonomy | `event: { eventName: string, properties: object, timestamp?: string }` | Validated event DTO with typed payload | 400 Bad Request on unknown event name or malformed payload | Blueprint R10, Sec 18, Acceptance Criteria |
| 22 | Blueprint R10 | Analytics Event Ingestion Pipeline | Ingests, decorates (user context, server timestamp), and stores structured analytics events | `userId: UUID | null`, `eventName: CanonicalEventName`, `properties: JSON`, `sessionId?: UUID` | Stored `analytics_events` record ID, HTTP 202 Accepted | Silently logs and isolates malformed non-critical events to prevent game disruption | Blueprint R10, Sec 9, Sec 10, Sec 18 |
| 23 | Blueprint R10 | User Activation Cohort Model | Calculates activation rate (`tutorial_complete` + first `business_upgrade` / total signups) | `cohortStartDate: Date`, `cohortEndDate: Date` | `{ totalSignups: number, activatedUsers: number, activationRate: number }` | Div-by-zero safe (returns 0.0 if totalSignups == 0) | Blueprint R10, Sec 13, Acceptance Criteria |
| 24 | Blueprint R10 | D1 / D2 / D7 Retention Cohort Model | Identifies qualifying active players on day 1, day 2, and day 7 post-signup from session logs | `cohortDate: Date` (UTC) | `{ cohortSize: number, d1Count: number, d1Rate: number, d2Count: number, d2Rate: number, d7Count: number, d7Rate: number }` | Correctly differentiates day boundaries using UTC date truncation | Blueprint R10, Sec 13, Acceptance Criteria |
| 25 | Blueprint R10 | Referral Retention Evaluation Model | Evaluates rolling 7-day window for invitees (>=4 active days) to trigger `retained_d7` | `inviteeUserId: UUID`, `boundDate: Date`, `activeDates: Date[]` | `{ isD2Qualified: boolean, isD7Qualified: boolean, distinctActiveDays: number }` | Disregards duplicate sessions on the same calendar day | Blueprint R10, Sec 6, Sec 13 |
| 26 | Blueprint R10 | Payer Conversion & Monetization KPIs | Computes payer conversion rate, ARPPU (Stars per payer), and total Stars revenue | `startDate: Date`, `endDate: Date` | `{ totalUsers: number, payingUsers: number, conversionRate: number, totalStarsRevenue: number, arppu: number }` | Div-by-zero safe (returns 0.0 if payingUsers == 0) | Blueprint R10, Sec 13 |

---

## Edge Cases

| # | Feature | Input | Observed / Expected Behavior |
|---|---------|-------|------------------------------|
| 1 | Global Leaderboard | Season with 0 registered players | Returns `{ entries: [], currentUser: { rank: null, points: 0 }, nextCursor: null, totalParticipants: 0 }` with HTTP 200 |
| 2 | Global Leaderboard | Two players with identical points (e.g. 500) and identical `updated_at` | Tie broken deterministically by `user_id ASC`; rank 1 and rank 2 assigned uniquely with no non-deterministic shuffling |
| 3 | User Rank Pinning | User ranked #50,420 requesting page 1 (limit 20) | Entries contain ranks 1..20; `currentUser` object contains `{ rank: 50420, points: 120 }` correctly calculated |
| 4 | Friends Leaderboard | User with 0 referrals and no referrer | Returns only 1 entry containing the current user at rank 1 |
| 5 | Season Freeze | Score mutation attempted on a season where `status = 'frozen'` | Mutation rejected with 409 Conflict / `SEASON_FROZEN` error; points unchanged |
| 6 | Stars Payment | Duplicate delivery of `successful_payment` webhook with same `telegram_payment_charge_id` | Database unique constraint or handler lookup detects existing record; returns `{ success: true, duplicate: true }` without adding 30 more days |
| 7 | Stars Payment | Request to purchase Season Points or direct Cash via `/shop/invoice` | Validation rejects request with 400 Bad Request (`FORBIDDEN_P2W_SKU`); no invoice created |
| 8 | Convenience Pass | User with 10 days remaining on active pass purchases 30-day pass | Expiration extended to `now() + 10 days + 30 days` (40 days total); stacking is additive |
| 9 | Convenience Pass | User whose pass expired 4 days ago purchases 30-day pass | Expiration set to `now() + 30 days` (does not resurrect expired gap) |
| 10 | Offline Earning Cap | Pass holder claims offline earnings after 16 hours offline | Earnings capped at 12 hours (43,200s); excess 4 hours yields 0 Cash |
| 11 | Remote Config | Key queried is absent from `economy_config` database table | Getter returns in-memory default (e.g. 14,400 for `economy.offline_cap_free_sec`) without error |
| 12 | Feature Flags | `feature.token` flag not present in DB or DB unreachable | Evaluator strictly returns `false`; prevents experimental Web3 features from ever leaking |
| 13 | Admin Config Mutation | Admin updates config without providing change reason or with invalid JSON format | Mutation rejected; database transaction rolled back; no orphaned audit log entry created |
| 14 | Event Schema Validation | Client posts analytics event with non-canonical name (e.g. `user_clicked_button`) | Validation fails with Zod schema error; returns 400 Bad Request with allowed enum list |
| 15 | Retention Cohort Model | User signs up at 23:59 UTC and logs in at 00:05 UTC (6 minutes later) | Calendar date changes across midnight UTC; counts as D1 active because session date = signup date + 1 day |
| 16 | Retention Cohort Model | User logs in 12 times on D1 | Distinct day count logic deduplicates timestamps; user counted exactly once towards D1 retention |
| 17 | Referral D7 Window | Invitee logs in 3 days during the 7-day window and 2 days on day 8 and 9 | `retained_d7` condition requires >= 4 active days within the first 7 days; milestone remains false |
| 18 | Payer Conversion | Zero paying users in database | `conversionRate` returns 0.0 and `arppu` returns 0.0 without division-by-zero exception |

---

## Detailed Specifications by Blueprint

### 1. Blueprint R6: Leaderboards Engine & Season Freeze

#### 1.1 Mathematical & Algorithmic Specifications
- **Deterministic Ranking Order**:
  $$\text{Order} = (\text{points DESC}, \text{updated\_at ASC}, \text{user\_id ASC})$$
  - Primary sort: `points DESC` (higher Season Points rank higher).
  - Secondary tie-breaker: `updated_at ASC` (player who achieved the score earlier ranks higher).
  - Tertiary tie-breaker: `user_id ASC` (lexicographical UUID order guarantees 100% deterministic uniqueness).
- **Exact Rank Calculation Formula**:
  $$\text{Rank}(u) = 1 + \left| \{ v \in \text{Scores} \mid v.\text{points} > u.\text{points} \lor (v.\text{points} = u.\text{points} \land (v.\text{updated\_at} < u.\text{updated\_at} \lor (v.\text{updated\_at} = u.\text{updated\_at} \land v.\text{user\_id} < u.\text{user\_id}))) \} \right|$$
- **Cursor Pagination Encoding**:
  - `cursor = base64(JSON.stringify({ points: number, updatedAt: string, userId: string }))`
  - SQL Keyset Filter:
    ```sql
    WHERE (points < :cursor_points)
       OR (points = :cursor_points AND updated_at > :cursor_updated_at)
       OR (points = :cursor_points AND updated_at = :cursor_updated_at AND user_id > :cursor_user_id)
    ```
- **Friend Leaderboard Graph**:
  - A user's friend network consists of:
    1. All invitees: `SELECT invitee_user_id FROM referrals WHERE referrer_user_id = :current_user_id`
    2. The referrer: `SELECT referrer_user_id FROM referrals WHERE invitee_user_id = :current_user_id`
    3. The user themselves: `:current_user_id`
  - Filter `season_scores` to this set of UUIDs and apply the identical deterministic ranking function.

#### 1.2 Season State Machine & Freeze Flow
```
[upcoming] ---> [active] ---> [frozen] ---> [ended]
```
1. When `now() >= ends_at` or admin calls freeze:
   - Season status transitions to `'frozen'`.
   - All mutations to `season_scores` for this `season_id` are rejected by triggers or application logic.
2. Final Ranks Snapshot:
   - Calculate final ranks for all participants.
   - Insert rows into `season_archives`:
     - `(season_id, user_id, final_rank, final_points, referral_points, mission_points, archived_at)`.
3. New Season Initialization:
   - Create new season with status `'upcoming'` or `'active'`.
   - Player profiles carry over lifetime cash and earn veteran cosmetic badge if top-tier; Season Points start at 0.

#### 1.3 Database Columns & Indexing Requirements
- Table `season_scores`:
  - Columns: `season_id UUID`, `user_id UUID`, `points BIGINT DEFAULT 0 CHECK (points >= 0)`, `mission_points BIGINT DEFAULT 0`, `referral_points BIGINT DEFAULT 0`, `updated_at TIMESTAMPTZ DEFAULT now()`.
  - Composite Index: `CREATE INDEX season_scores_leaderboard_idx ON public.season_scores(season_id, points DESC, updated_at ASC, user_id ASC);`
- Table `season_archives`:
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

---

### 2. Blueprint R7: Stars Monetization & Pass Entitlement Backend

#### 2.1 Convenience Pass Specifications
- **Offline Earnings Accumulation Formula**:
  $$\text{offlineEarned} = \text{productionPerSecond} \times \min(\text{secondsSinceLastClaim}, \text{offlineCapSeconds})$$
  - Free Tier: $\text{offlineCapSeconds} = 14,400\text{ s}$ (4 hours).
  - Convenience Pass Tier: $\text{offlineCapSeconds} = 43,200\text{ s}$ (12 hours).
  - Invariant: $\text{productionPerSecond}$ is identical across both tiers. Pass only grants convenience/less frequent logins.
- **Pass Entitlement Parameters**:
  | Feature | Free Tier | Convenience Pass Tier | Anti-P2W Constraint |
  |---------|-----------|-----------------------|---------------------|
  | Offline Cap | 4 hours (14,400s) | 12 hours (43,200s) | No change to production rate |
  | Upgrade Queue | 1 slot | 3 slots | Upgrade costs identical |
  | Auto-claim / Reinvest | Disabled | Enabled | Automates manual claims |
  | Mission Rerolls | 1 / day | 3 / day | Mission reward caps unchanged |
  | Season Points Multiplier | $\times 1$ | $\times 1$ | **STRICTLY FORBIDDEN TO CHANGE** |
  | Price | - | 250 Telegram Stars | Configurable via remote config |
  | Duration | - | 30 Days (2,592,000s) | Additive stacking on renewal |

#### 2.2 Payment Idempotency & State Machine
```
[User clicks Buy] -> API: POST /shop/invoice
                     -> Generates unique invoice_payload (UUID)
                     -> Calls Telegram createInvoiceLink
[Telegram Pre-checkout] -> API: POST /telegram/webhook (pre_checkout_query)
                           -> Validates currency == 'XTR', payload exists
                           -> Returns { ok: true }
[Telegram Payment Success] -> API: POST /telegram/webhook (successful_payment)
                              -> Extract telegram_payment_charge_id
                              -> BEGIN TRANSACTION:
                                   SELECT * FROM purchases WHERE telegram_payment_charge_id = :charge_id FOR UPDATE;
                                   IF FOUND AND status == 'completed' THEN RETURN { duplicate: true };
                                   UPDATE purchases SET status = 'completed', completed_at = now();
                                   EXTEND player pass entitlement;
                                   INSERT INTO reward_ledger (idempotency_key = hash(charge_id));
                                   FIRE payment_success & pass_activated events;
                              -> COMMIT;
```

#### 2.3 Database Schema & Invariants
- Table `purchases`:
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
- Pass state tracking:
  - Add `pass_expires_at TIMESTAMPTZ` to player profile / entitlement table.
  - Active check: `pass_expires_at IS NOT NULL AND pass_expires_at > now()`.

---

### 3. Blueprint R8: Admin Remote Config & Feature Flags

#### 3.1 Remote Config Architecture & Safe Fallbacks
- **Fallback Hierarchy**:
  1. Check database table `economy_config` for the given key.
  2. If present and valid, parse and return the value.
  3. If missing from DB, corrupt, or DB query throws an error, return in-memory hardcoded constant from `DEFAULT_ECONOMY_CONFIG`.
  4. System NEVER crashes or throws uncaught exceptions due to missing configuration keys.

#### 3.2 Canonical Configuration Keys & Defaults (Blueprint Section 18)
| Key | Type | Default Value | Description |
|-----|------|---------------|-------------|
| `economy.offline_cap_free_sec` | integer | `14400` | Free tier offline accumulation cap (4h) |
| `economy.offline_cap_pass_sec` | integer | `43200` | Convenience Pass offline cap (12h) |
| `economy.upgrade_cost_growth` | number | `1.18` | Exponential growth base for upgrade costs |
| `economy.production_level_growth` | number | `1.07` | Production scaling multiplier per level |
| `season.sru_base` | integer | `500` | Base Standard Reward Unit for Season Points |
| `season.sru_reference_qap` | integer | `100` | Reference Qualified Active Players for SRU |
| `season.sru_exponent` | number | `-0.10` | Diminishing exponent for SRU curve |
| `season.sru_min` | integer | `100` | Minimum SRU floor |
| `season.sru_max` | integer | `500` | Maximum SRU cap |
| `referral.bind_window_min` | integer | `30` | Minutes after signup referral code can be bound |
| `referral.diminish_after_qualified` | integer | `20` | Qualified invites before whale diminishing factor kicks in |
| `referral.diminish_floor` | number | `0.25` | Minimum diminishing factor floor for referral points |
| `pass.price_stars` | integer | `250` | Default price in Telegram Stars for 30-day pass |
| `pass.duration_days` | integer | `30` | Duration of Convenience Pass in days |
| `mission.daily_slots` | integer | `3` | Number of daily mission slots assigned |
| `mission.free_rerolls` | integer | `1` | Free mission rerolls per day |
| `mission.pass_rerolls` | integer | `3` | Convenience Pass mission rerolls per day |
| `feature.token` | boolean | `false` | Web3 / token module toggle (**strictly false**) |
| `feature.stars_payments` | boolean | `false` | Telegram Stars payments (**false until bot connected**) |
| `feature.leaderboard` | boolean | `true` | Leaderboard feature toggle |
| `feature.referrals` | boolean | `true` | Referral system feature toggle |

#### 3.3 Audit Logging Schema
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

---

### 4. Blueprint R10 & Section 18: Analytics Event Pipeline & Cohort Models

#### 4.1 Canonical Event Taxonomy (21 Events)
Every event must validate against this exact canonical list from Blueprint Section 18:

| # | Event Name | Trigger Context | Required / Canonical Properties |
|---|------------|-----------------|---------------------------------|
| 1 | `app_open` | Client Mini App mounted | `platform: 'ios'|'android'|'desktop'|'unknown'`, `version: string` |
| 2 | `auth_success` | Telegram initData verified & session opened | `is_new_user: boolean`, `auth_date: number` |
| 3 | `tutorial_complete` | Player finishes initial guide | `duration_seconds?: number`, `first_business: string` |
| 4 | `business_upgrade` | Player upgrades a business level | `business_slug: string`, `new_level: number`, `cost: number` |
| 5 | `cash_claim` | Player claims accumulated production | `claimed_amount: number`, `seconds_accumulated: number`, `is_capped: boolean` |
| 6 | `mission_assigned` | Daily/weekly missions generated | `mission_key: string`, `difficulty: string`, `assigned_date: string` |
| 7 | `mission_complete` | In-game action satisfies mission target | `mission_key: string`, `progress: number`, `target: number` |
| 8 | `mission_claim` | Player claims Season Points for mission | `mission_key: string`, `reward_points: number`, `sru_snapshot: number` |
| 9 | `streak_claim` | Player claims daily streak bonus | `streak_days: number`, `reward_points: number`, `is_cycle_bonus: boolean` |
| 10 | `referral_link_copy` | Player copies or shares invite link | `referral_code: string`, `share_channel?: string` |
| 11 | `referral_bound` | New player binds referral code | `referrer_id: string`, `code: string`, `bound_within_minutes: number` |
| 12 | `referral_milestone_qualified`| Invitee satisfies milestone requirement | `invitee_id: string`, `milestone: 'activation'|'retained_d2'|'retained_d7'|'progression'`, `reward_points: number` |
| 13 | `referral_reward_claim` | Referrer claims points for qualified milestone | `event_id: string`, `milestone: string`, `reward_points: number` |
| 14 | `leaderboard_view` | Player navigates to Leaderboard screen | `season_id: string`, `type: 'global'|'friends'`, `user_rank?: number` |
| 15 | `shop_view` | Player opens Shop screen | `source?: string`, `is_pass_active: boolean` |
| 16 | `invoice_created` | Player initiates checkout for SKU | `sku: string`, `stars_amount: number`, `invoice_payload: string` |
| 17 | `payment_success` | Telegram Stars payment completed | `sku: string`, `stars_amount: number`, `charge_id: string` |
| 18 | `payment_refund` | Stars purchase refunded by support/admin | `charge_id: string`, `stars_amount: number`, `reason?: string` |
| 19 | `fraud_flag_created` | Anti-fraud rule triggered on account | `reason: string`, `severity: 'low'|'medium'|'high'`, `score_delta: number` |
| 20 | `reward_frozen` | Account or referral rewards frozen | `reason: string`, `frozen_amount?: number` |
| 21 | `pass_activated` | Convenience Pass entitlement applied | `sku: string`, `duration_days: number`, `expires_at: string` |

#### 4.2 Cohort & Retention Mathematical Models
- **Calendar Day Normalization (UTC)**:
  $$\text{day}(t) = \lfloor t / 86400 \rfloor \quad (\text{UTC Date})$$
- **User Cohort Date**:
  $$\text{CohortDate}(u) = \text{date\_trunc}('day', u.\text{created\_at})$$
- **D1 Retention**:
  $$\text{Active}(u, N) = \exists e \in \text{Events}(u) \mid \text{date\_trunc}('day', e.\text{created\_at}) = \text{CohortDate}(u) + N \text{ days}$$
  $$\text{D1\_Rate}(\text{Cohort}) = \frac{\left| \{ u \in \text{Cohort} \mid \text{Active}(u, 1) \} \right|}{\left| \text{Cohort} \right|}$$
- **D2 Retention**:
  $$\text{D2\_Rate}(\text{Cohort}) = \frac{\left| \{ u \in \text{Cohort} \mid \text{Active}(u, 2) \} \right|}{\left| \text{Cohort} \right|}$$
- **D7 Classic Retention**:
  $$\text{D7\_Rate}(\text{Cohort}) = \frac{\left| \{ u \in \text{Cohort} \mid \text{Active}(u, 7) \} \right|}{\left| \text{Cohort} \right|}$$
- **Referral Qualified Retention Models (Blueprint Section 6)**:
  - `retained_d2`: Invitee has active sessions on at least 2 distinct calendar days.
  - `retained_d7`: Invitee has active sessions on $\ge 4$ distinct calendar days within the 7-day window $[T_{\text{bind}}, T_{\text{bind}} + 7\text{ days}]$.
- **Activation Rate Model (Blueprint Section 13)**:
  $$\text{IsActivated}(u) = \exists e_1 \in \text{Events}(u) [\text{type} = \text{'tutorial\_complete'}] \land \exists e_2 \in \text{Events}(u) [\text{type} = \text{'business\_upgrade'} \land \text{level} \ge 1]$$
  $$\text{ActivationRate} = \frac{\sum_{u} \mathbf{1}_{\text{IsActivated}(u)}}{\text{Total Signups}}$$
- **Payer Conversion & Monetization Metrics**:
  $$\text{PayerConversionRate} = \frac{\left| \{ u \mid \exists p \in \text{Purchases}(u) \text{ with status} = \text{'completed'} \} \right|}{\text{Total Registered Users}}$$
  $$\text{ARPPU} = \frac{\sum_{\text{completed}} \text{stars\_amount}}{\left| \text{Unique Paying Users} \right|}$$

#### 4.3 Analytics Storage Schema
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

---

## Strict Domain Boundaries (Astra 6.0 Isolation)
Per user instructions in `ORIGINAL_REQUEST.md`:
1. **NO UI/UX Changes**: Do not generate, touch, or alter React visual components, styles, or layout in `apps/web/src/components` or CSS files. All visual presentations for Leaderboards, Shop, and Admin screens are strictly reserved for Astra 6.0.
2. **NO Anti-Cheat / Penetration Modding**: Do not modify bot fraud graph analysis, Honeypot checks, or penetration defenses (reserved for Astra 6.0).
3. **Pure Logic & Data Boundaries**: Implementations must be restricted to:
   - Pure, deterministic calculation functions in `packages/game-core`.
   - Zod contracts and DTO schemas in `packages/shared`.
   - Idempotent, transaction-safe SQL migrations in `supabase/migrations/`.
   - Backend API routes and webhook handlers in `apps/api`.
