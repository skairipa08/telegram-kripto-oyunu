# Handoff Report: Survey 6 — Qualified Referral Progression & Referrer Rewards (R3)

## 1. Observation

### 1.1 Existing Game-Core Logic (`packages/game-core`)
- **File**: `packages/game-core/src/referral.ts`
  - **Milestone Definitions & Multipliers** (lines 8–46):
    ```typescript
    export type ReferralMilestone = 'activation' | 'retained_d2' | 'retained_d7' | 'progression';
    export const REFERRAL_MILESTONES: Record<ReferralMilestone, ReferralMilestoneDefinition> = {
      activation: { milestone: 'activation', title: 'Aktivasyon', description: 'İlk işletme yükseltmesi tamamlandı', sruMultiplier: 0.5 },
      retained_d2: { milestone: 'retained_d2', title: 'D2 Sadakat', description: 'En az 2 ayrı günde aktif oturum', sruMultiplier: 1.0 },
      retained_d7: { milestone: 'retained_d7', title: 'D7 Sadakat', description: '7 günlük pencerede en az 4 aktif gün', sruMultiplier: 2.0 },
      progression: { milestone: 'progression', title: 'İmparatorluk Ölçeği', description: 'Toplam işletme seviyesi 10 veya üzerine ulaştı', sruMultiplier: 1.5 },
    };
    ```
  - **Constants** (lines 48–49):
    ```typescript
    export const REFERRAL_STARTER_CASH_BOOST = 500;
    export const REFERRAL_BIND_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
    ```
  - **Invitee Stats Interface** (lines 51–58):
    ```typescript
    export interface InviteeStats {
      readonly hasCompletedTutorial: boolean;
      readonly highestBusinessLevel: number;
      readonly totalEmpireLevels: number;
      readonly distinctActiveDays: number;
      readonly registrationTimestampMs: number;
      readonly currentTimestampMs: number;
    }
    ```
  - **Whale Diminishing Multiplier** (`packages/game-core/src/formulas.ts`, lines 183–193 & `referral.ts`, lines 150–159):
    ```typescript
    export function calculateReferralReward(milestone: ReferralMilestone, currentSRU: number, qualifiedCount: number): number {
      const definition = REFERRAL_MILESTONES[milestone];
      const whaleFactor = calculateReferralWhaleFactor(qualifiedCount);
      const rawPoints = definition.sruMultiplier * currentSRU * whaleFactor;
      return Math.round(rawPoints);
    }
    ```
    Where `calculateReferralWhaleFactor(qualifiedCount)` returns `1.0` for `Q <= 20`, and `Math.max(0.25, Math.sqrt(20 / qualifiedCount))` for `Q > 20`.
  - **Pure Milestones Evaluation** (lines 164–193):
    Evaluates `'activation'` when `hasCompletedTutorial && highestBusinessLevel >= 1`.
    Evaluates `'retained_d2'` when `distinctActiveDays >= 2`.
    Evaluates `'retained_d7'` when `elapsedDays <= 7.5 && distinctActiveDays >= 4`.
    Evaluates `'progression'` when `totalEmpireLevels >= 10`.
  - **Tier Badges Definition** (lines 66–98):
    1: `badge_early_connector`, 3: `preset_extra_automation`, 5: `pass_7d`, 10: `frame_exclusive_referral`, 25: `emblem_custom_slot`, 50: `cosmetic_founder_set`, 100: `ambassador_eligibility`.
- **File**: `packages/game-core/src/fraud.ts` (lines 102–148):
  Contains graph fraud detection `evaluateReferralGraphAndAbuse(...)` detecting self-referral, reciprocal 2-hop loops (`RECIPROCAL_REFERRAL_SUSPECT`), and circular rings (`CIRCULAR_REFERRAL_SUSPECT`).

### 1.2 Shared DTOs & Contracts (`packages/shared/src/index.ts`)
- **Referral Milestone Schema** (lines 242–248):
  ```typescript
  export const referralMilestoneSchema = z.enum(['activation', 'retained_d2', 'retained_d7', 'progression']);
  ```
- **Overview Schema** (lines 250–259):
  ```typescript
  export const playerReferralOverviewSchema = z.object({
    referralCode: z.string(),
    deepLink: z.string(),
    totalInvites: z.number().int().nonnegative(),
    qualifiedCount: z.number().int().nonnegative(),
    totalEarnedPoints: z.number().int().nonnegative(),
    unlockedBadges: z.array(z.string()),
  });
  ```
- **Binding Request & Response** (lines 262–275):
  `bindReferralRequestSchema` (`referralCode`, `requestId`), `bindReferralResponseSchema` (`apiVersion: 'v1'`, `success: boolean`, `starterCashBoost: number`).
- **Referral Event Item Schema** (lines 277–285):
  ```typescript
  export const referralEventItemSchema = z.object({
    id: z.uuid(),
    milestone: referralMilestoneSchema,
    rewardAmount: z.number().int().positive(),
    qualifiedAt: z.iso.datetime(),
    status: z.enum(['pending', 'claimed', 'frozen']),
    claimedAt: z.iso.datetime().nullable(),
  });
  ```
- **Claim Request & Response Schemas** (lines 287–306):
  ```typescript
  export const claimReferralRewardRequestSchema = z.object({
    eventId: z.uuid(),
    requestId: z.uuid(),
  }).strict();
  export const claimReferralRewardResponseSchema = z.object({
    apiVersion: z.literal('v1'),
    eventId: z.uuid(),
    rewardPoints: z.number().int().positive(),
    newSeasonPoints: z.number().int().nonnegative(),
    claimedAt: z.iso.datetime(),
  });
  ```
- **Canonical Analytics Events** (lines 525–528):
  `'referral_link_copy'`, `'referral_bound'`, `'referral_milestone_qualified'`, `'referral_reward_claim'`.

### 1.3 Database Schemas (`supabase/migrations/`)
- **`202609140004_referrals.sql`**:
  - `public.users.referral_code`: `text unique check (referral_code ~ '^[a-zA-Z0-9_-]{4,32}$')`.
  - `public.referrals`:
    ```sql
    create table public.referrals (
      id uuid primary key default gen_random_uuid(),
      invitee_user_id uuid not null unique references public.users(id) on delete cascade,
      referrer_user_id uuid not null references public.users(id) on delete cascade,
      code text not null check (length(code) between 4 and 32),
      bound_at timestamptz not null default now(),
      status text not null default 'bound' check (status in ('bound', 'qualified', 'flagged')),
      created_at timestamptz not null default now(),
      check (invitee_user_id <> referrer_user_id)
    );
    ```
    *Observation*: `is_qualified` and `qualified_at` are **NOT** in migration `0004`.
  - `public.referral_events`:
    ```sql
    create table public.referral_events (
      id uuid primary key default gen_random_uuid(),
      referral_id uuid not null references public.referrals(id) on delete cascade,
      milestone text not null check (milestone in ('activation', 'retained_d2', 'retained_d7', 'progression')),
      reward_amount integer not null check (reward_amount > 0),
      qualified_at timestamptz not null default now(),
      status text not null default 'pending' check (status in ('pending', 'claimed', 'frozen')),
      claimed_at timestamptz,
      unique (referral_id, milestone),
      check ((status = 'claimed' and claimed_at is not null) or (status <> 'claimed' and claimed_at is null))
    );
    ```
- **`202609140002_economy.sql` & `202609140006_economy_starter_and_roi.sql`**:
  - `public.player_balances`: `user_id uuid primary key`, `cash bigint not null default 100`, `season_points bigint not null default 0`, `updated_at timestamptz`.
  - `public.reward_ledger`: `id uuid`, `user_id uuid`, `delta_cash bigint`, `delta_season_points bigint`, `reason text`, `idempotency_key text unique`, `metadata jsonb`.
- **`202609140003_seasons_missions.sql`**:
  - `public.season_scores`: `season_id uuid`, `user_id uuid`, `points bigint`, `mission_points bigint`, `referral_points bigint`, `updated_at timestamptz`, `primary key (season_id, user_id)`.
  - `public.player_streaks`: `user_id uuid primary key`, `current_streak integer (0..7)`, `longest_streak integer`, `last_claim_date date`.
- **`202609140005_step7_to_11_backend.sql`**:
  - `public.analytics_events`: stores audit events.
  - `public.daily_metrics`: stores `qualified_referrals integer not null default 0`.
  - `public.empire_leaderboard_get_friends(p_user_id uuid)` (lines 169–176): joins `referrals` via `referrer_user_id` and `invitee_user_id`.
- **`202609140008_anti_fraud.sql`**:
  - `public.frozen_rewards`: quarantines rewards flagged as fraud.
  - Check constraint allows `reward_type = 'referral_bonus'` (lines 37–43).

### 1.4 Test-DB Compatibility Patches (`apps/api/src/auth/test-db.ts`)
- In `apps/api/src/auth/test-db.ts` (lines 35–89):
  Because previous developers had column name confusion (`referrer_id`/`invitee_id` vs `referrer_user_id`/`invitee_user_id`) and needed `is_qualified` and `qualified_at`, they appended in-memory DDL:
  ```sql
  alter table public.referrals add column if not exists referrer_id uuid;
  alter table public.referrals add column if not exists invitee_id uuid;
  alter table public.referrals add column if not exists is_qualified boolean default false;
  alter table public.referrals add column if not exists qualified_at timestamptz;
  ```
  However, `apps/api/src/economy/game-loop.integration.test.ts` (lines 94–110) explicitly verifies:
  ```typescript
  expect(forbiddenColumns.rows).toEqual([]);
  ```
  Where `forbiddenColumns` flags any test-hack columns (`referrer_id`, `invitee_id`, `is_qualified`, `qualified_at`) when run against fresh migrations!
  Therefore, any official additions (`is_qualified`, `qualified_at`) must be added canonically via a sequential migration (e.g. `202609140009_missions_and_launch.sql`), and tests must be aligned with canonical column names (`referrer_user_id`, `invitee_user_id`).

### 1.5 Existing API Routes & Store Methods (`apps/api/src/economy/`)
- **`apps/api/src/economy/routes.ts`**:
  - Line 527: `routes.post('/referral/bind', ...)` -> validates session, body with `bindReferralRequestSchema`, calls `economyStore.bindReferral(userId, code)`.
  - Line 567: `routes.get('/referral/status', ...)` -> validates session, calls `economyStore.getReferralStatus(userId)`, returns `PlayerReferralOverview`.
  - **Missing**: No route for claiming referral milestone rewards (e.g. `POST /referral/claim`), despite `@empire/shared` having `claimReferralRewardRequestSchema` and `claimReferralRewardResponseSchema`.
  - **Missing**: No event hooks in `POST /economy/upgrade` or `POST /economy/claim` to trigger milestone evaluations.
- **`apps/api/src/economy/store.ts`**:
  - Line 236: `bindReferral(userId, referralCode)` -> calls RPC `empire_bind_referral`.
  - Line 260: `getReferralStatus(userId)` -> calls RPC `empire_get_referral_status`.
  - **Missing**: No store method for `claimReferralReward` or `evaluateReferralMilestones`.

---

## 2. Logic Chain

### 2.1 Existing Routes, Models, Schemas, and Event Hooks (Question 1)
- *Premise*: From Observation 1.1 and 1.2, `packages/game-core` contains complete pure logic (`calculateReferralReward`, `evaluateInviteeMilestones`, `getUnlockedReferralBadges`, `calculateReferralWhaleFactor`), and `packages/shared` exports complete Zod schemas and TypeScript DTOs.
- *Premise*: From Observation 1.5, `apps/api/src/economy/routes.ts` only implements `POST /referral/bind` and `GET /referral/status`.
- *Inference*: The missing API endpoint is `POST /referral/claim` (and dual-mounted `/api/referral/claim`). It must take `{ eventId: uuid, requestId: uuid }`, invoke store method `claimReferralReward`, credit `player_balances.season_points` and active `season_scores.referral_points`, and return typed `ClaimReferralRewardResponse`.
- *Inference*: Event hooks are currently absent in `POST /economy/upgrade` and player activity handlers. When an invitee upgrades or logs in, a progression evaluator must run to test milestone qualification.

### 2.2 Database Tables Assessment (Question 2)
- *Premise*: From Observation 1.3, `public.referrals` and `public.referral_events` were created in `202609140004_referrals.sql`.
- *Premise*: In `0004`, `referrals` contains `(id, invitee_user_id, referrer_user_id, code, bound_at, status, created_at)`.
- *Inference*: Columns `is_qualified boolean default false` and `qualified_at timestamptz` specified by user request R3 are **not yet in any migration file**. They must be added in `202609140009_missions_and_launch.sql`.
- *Premise*: `public.season_scores` (created in `0003`) already has `referral_points bigint not null default 0 check (referral_points >= 0)`.
- *Premise*: `public.reward_ledger` (created in `0002`) already tracks `delta_season_points` with reason and metadata.
- *Premise*: There is **NO `badges` table** in PostgreSQL. In Project Empire, badges are derived dynamically from `qualifiedCount` via `getUnlockedReferralBadges(qualifiedCount)` and returned in `PlayerReferralOverview.unlockedBadges`.

### 2.3 Invitee Milestone Evaluation Triggering (Question 3)
The 4 milestones defined in R3 map to distinct player actions:
1. **`activation`** (0.5x SRU):
   - *Condition*: Invitee completes first business upgrade (`highestBusinessLevel >= 1`).
   - *Trigger Point*: Triggered during `POST /economy/upgrade` (or within the DB function `empire_upgrade_business`).
   - *Logic*: Check if the player has a referrer in `public.referrals`. If so, check if `'activation'` is already in `public.referral_events`. If not and `highestBusinessLevel >= 1`, calculate reward amount (`0.5 * currentSRU * whaleFactor`) and insert a pending `referral_events` row.
2. **`retained_d2`** (1.0x SRU):
   - *Condition*: Invitee logs in / is active across $\ge 2$ distinct calendar days (UTC).
   - *Trigger Point*: Triggered on daily activity / login / state access (`POST /auth/telegram`, `GET /game/state`, `POST /economy/claim`, `POST /streak/claim`).
   - *Logic*: Count distinct calendar days from `auth_sessions` (or `analytics_events`):
     `select count(distinct date(issued_at at time zone 'UTC')) from public.auth_sessions where user_id = invitee_id`.
     If count $\ge 2$ and `'retained_d2'` not yet in `referral_events`, insert pending event with `1.0 * currentSRU * whaleFactor`.
3. **`retained_d7`** (2.0x SRU):
   - *Condition*: Invitee active on $\ge 4$ distinct days within 7 days of registration.
   - *Trigger Point*: Same as `retained_d2`.
   - *Logic*: Check if `now() <= invitee.created_at + interval '7 days'` (or within 7.5 days) and distinct calendar active days $\ge 4$. If satisfied and `'retained_d7'` not yet in `referral_events`, insert pending event with `2.0 * currentSRU * whaleFactor`.
4. **`progression`** (1.5x SRU):
   - *Condition*: Invitee total empire levels $\ge 10$.
   - *Trigger Point*: Triggered during `POST /economy/upgrade` (or within `empire_upgrade_business`).
   - *Logic*: Sum levels across all businesses: `select coalesce(sum(level), 0) from public.player_businesses where user_id = invitee_id`. If sum $\ge 10$ and `'progression'` not yet in `referral_events`, insert pending event with `1.5 * currentSRU * whaleFactor`.

### 2.4 Status Updates: `referrals.status = 'qualified'`, `is_qualified = true`, `qualified_at = now()` (Question 4)
- *Premise*: According to Blueprint Section 6 and R3, an invitee becomes a "qualified referral" as soon as they complete their first qualification milestone (`activation`).
- *Inference*: When the `activation` milestone is verified and inserted into `referral_events`:
  ```sql
  update public.referrals
  set status = 'qualified',
      is_qualified = true,
      qualified_at = coalesce(qualified_at, now())
  where id = v_referral_id and (status <> 'qualified' or is_qualified = false);
  ```
- *Inference*: Increment `daily_metrics.qualified_referrals` for `current_date` (or insert on conflict update).
- *Inference*: Emit structured analytics event `'referral_milestone_qualified'` into `public.analytics_events`.

### 2.5 Recording `referral_events` & Claiming / Crediting Rewards (Question 5)
- *Recording*:
  ```sql
  insert into public.referral_events (referral_id, milestone, reward_amount, status, qualified_at)
  values (v_referral_id, v_milestone, v_reward_amount, 'pending', now())
  on conflict (referral_id, milestone) do nothing;
  ```
  The table's unique constraint `unique(referral_id, milestone)` prevents duplicate reward records.
- *Claiming via `POST /referral/claim`*:
  1. Authenticate referrer via session cookie.
  2. Parse body with `claimReferralRewardRequestSchema` (`eventId`, `requestId`).
  3. Query `referral_events` with `FOR UPDATE` join on `referrals`:
     ```sql
     select re.id, re.reward_amount, re.status, re.milestone, r.referrer_user_id
     from public.referral_events re
     join public.referrals r on r.id = re.referral_id
     where re.id = p_event_id
     for update of re;
     ```
  4. Security checks:
     - If not found or `referrer_user_id <> session.user.id`: return 404 / 403 `EVENT_NOT_FOUND`.
     - If `status = 'claimed'`: return idempotent 200 (or reject with `ALREADY_CLAIMED`).
     - If `status = 'frozen'`: return 403 `REWARD_FROZEN`.
  5. State transitions:
     - `update public.referral_events set status = 'claimed', claimed_at = now() where id = p_event_id`.
     - `update public.player_balances set season_points = season_points + re.reward_amount, updated_at = now() where user_id = session.user.id`.
     - If active season exists:
       `insert into public.season_scores (season_id, user_id, points, referral_points, updated_at) values (v_season.id, session.user.id, re.reward_amount, re.reward_amount, now()) on conflict (season_id, user_id) do update set points = season_scores.points + excluded.points, referral_points = season_scores.referral_points + excluded.referral_points, updated_at = now()`.
     - Insert into `public.reward_ledger`:
       `delta_cash = 0`, `delta_season_points = re.reward_amount`, `reason = 'referral_reward_claim'`, `idempotency_key = sha256(requestId)`, `metadata = jsonb_build_object('event_id', re.id, 'milestone', re.milestone)`.
     - Insert into `public.analytics_events`: `event_name = 'referral_reward_claim'`.
  6. Return `ClaimReferralRewardResponse`.

### 2.6 Updating Invite Counts, Badges, and Referrer Tier Stats (Question 6)
- *Total Invites*: `select count(*) from public.referrals where referrer_user_id = p_user_id`.
- *Qualified Count*: `select count(*) from public.referrals where referrer_user_id = p_user_id and (status = 'qualified' or is_qualified = true)`.
- *Total Earned Points*: `select coalesce(sum(re.reward_amount), 0) from public.referral_events re join public.referrals r on r.id = re.referral_id where r.referrer_user_id = p_user_id and re.status = 'claimed'`.
- *Badges*: Derived dynamically from `qualifiedCount`.
  - In `packages/game-core/src/referral.ts`:
    `getUnlockedReferralBadges(qualifiedCount)` checks thresholds [1, 3, 5, 10, 25, 50, 100].
  - In `apps/web/src/screens/friends-screen.tsx`:
    Milestone bar checks thresholds [1, 3, 5, 10, 25, 50].

---

## 3. Caveats

1. **Badge Naming Harmonization**:
   - `packages/game-core/src/referral.ts` defines badges: `badge_early_connector` (1), `preset_extra_automation` (3), `pass_7d` (5), `frame_exclusive_referral` (10), `emblem_custom_slot` (25), `cosmetic_founder_set` (50), `ambassador_eligibility` (100).
   - `apps/api/src/economy/game-loop.integration.test.ts` line 1312 expects `'recruiter'`.
   - *Recommendation*: The status endpoint should include both or map keys so that both `recruiter` (and other legacy keys) and `badge_early_connector` are returned, preventing test regressions.
2. **Canonical Column Names (`referrer_user_id` vs `referrer_id`)**:
   - Canonical migration `202609140004_referrals.sql` uses `referrer_user_id` and `invitee_user_id`.
   - Any new SQL function or trigger should use the canonical `referrer_user_id` and `invitee_user_id`.
   - Migration `202609140009_missions_and_launch.sql` should canonically add `is_qualified boolean not null default false` and `qualified_at timestamptz` to `public.referrals`.
3. **Tracking Distinct Active Days for D2 and D7**:
   - Project Empire records sessions in `public.auth_sessions` with `issued_at timestamptz`.
   - Distinct active days can be counted via `count(distinct date(issued_at at time zone 'UTC')) from public.auth_sessions where user_id = invitee_id`.
   - If offline earnings are claimed without a new session, `analytics_events` or `reward_ledger` can also serve as an activity source.

---

## 4. Conclusion

The referrals and milestone architecture is well-specified and partially implemented:
1. **Mathematical Engine**: 100% complete and tested in `packages/game-core/src/referral.ts`.
2. **DTO & Contract Layer**: 100% complete in `@empire/shared`.
3. **Database Schema**: Tables `referrals` and `referral_events` exist in `0004`, but require adding `is_qualified` and `qualified_at` columns in the upcoming migration `202609140009_missions_and_launch.sql`.
4. **Backend Progression & Claim Flow (To Be Implemented)**:
   - Implement `POST /referral/claim` (and `/api/referral/claim`) in `apps/api/src/economy/routes.ts`.
   - Add RPC / helper `empire_evaluate_referral_milestones(p_invitee_user_id uuid)` and hook it into `POST /economy/upgrade` and daily session/claim actions.
   - Implement row locking (`FOR UPDATE`) in `empire_claim_referral_reward` to ensure atomic balance crediting, duplicate claim prevention, and idempotency.

---

## 5. Verification Method

### 5.1 Static Verification
1. Verify game-core referral formulas and milestone tests:
   ```bash
   pnpm --filter @empire/game-core test src/referral.test.ts
   ```
2. Verify shared DTO typechecking:
   ```bash
   pnpm --filter @empire/shared typecheck
   ```

### 5.2 Test Harness & Integration Verification
1. Ensure test-db harness loads canonical migrations without missing file errors:
   ```bash
   pnpm --filter @empire/api test src/fraud/routes.test.ts
   ```
2. Once implemented in migration `0009` and `apps/api`:
   - Run referral binding and status test:
     ```bash
     pnpm vitest run apps/api/src/economy/game-loop.integration.test.ts -t "POST /referral/bind"
     pnpm vitest run apps/api/src/economy/game-loop.integration.test.ts -t "GET /referral/status"
     ```
   - Add integration tests verifying:
     - Invitee first upgrade (`highestBusinessLevel >= 1`) generates `activation` event and marks `is_qualified = true`.
     - Invitee multiple active days generate `retained_d2` and `retained_d7`.
     - Invitee 10 empire levels generates `progression`.
     - `POST /referral/claim` claims reward, adds Season Points to `player_balances` and `season_scores`, and rejects double claims.
