# Survey 4: Project Empire API & Economy Store Investigation Report
**Requirements**: R1 (Economy Game Loop Routes) & R2 (Game State, Mission, Referral & Streak Routes)  
**Target Workspace**: `apps/api`, `packages/shared`, `supabase/migrations`  
**Date**: 2026-09-14  
**Status**: COMPLETE  

---

## 1. Executive Summary

This report delivers a thorough investigation of requirements **R1** and **R2** for Project Empire.
The underlying database migration (`supabase/migrations/202609140007_game_loop_apis.sql`), the backend store layer (`apps/api/src/economy/store.ts`), and the shared DTO/Zod schemas (`packages/shared/src/index.ts`) already exist on disk. They provide a unified foundation across 8 game loop operations:
1. `claimOfflineEarnings`
2. `upgradeBusiness`
3. `getGameState`
4. `bindReferral`
5. `getReferralStatus`
6. `getActiveMissions`
7. `claimMission`
8. `getStreak`

Currently, `apps/api/src/economy/routes.ts` only exposes the analytics and simulation endpoints (`GET /economy/roi` and `GET /economy/simulation`). The live game loop HTTP endpoints (`POST /economy/claim`, `POST /economy/upgrade`, `GET /game/state`, `GET /missions/active`, `POST /missions/:id/claim`, `GET /streak`, `POST /referral/bind`, `GET /referral/status`) are not yet implemented.

This document details:
- The exact RPC definitions, parameter bindings, return shapes, and error semantics from `202609140007_game_loop_apis.sql`.
- The `EconomyStore` and `SupabaseEconomyStore` interfaces and method implementations in `apps/api/src/economy/store.ts`.
- The corresponding Zod request/response schemas in `@empire/shared`.
- Session cookie validation, user ID extraction, and API error formatting conventions in `apps/api`.
- Concrete, drop-in implementations for `POST /economy/claim` and `POST /economy/upgrade` in `apps/api/src/economy/routes.ts`.
- Modular routing architecture and dual-prefix mounting (`/` and `/api`) in `apps/api/src/index.ts` for all R2 routes.
- The test harness extension pattern for `apps/api/src/auth/test-db.ts` and an integration test matrix.

---

## 2. Database RPC Layer (`202609140007_game_loop_apis.sql`)

The migration defines 8 PostgreSQL functions in schema `public` with `SECURITY DEFINER` and `SET search_path = ''`. All 8 functions are revoked from `public`, `anon`, and `authenticated`, and granted exclusively to `service_role`.

| RPC Name | Parameters | Return Shape | Key Behaviors & Error Codes |
| :--- | :--- | :--- | :--- |
| `empire_claim_offline_earnings` | `p_user_id uuid`, `p_offline_cap_seconds integer default 14400` | `jsonb` | 1. Determines elapsed seconds since `min(last_claim_at)`.<br>2. Returns `{ claimedAmount: 0, newBalance, claimedAt, isCapped: false }` if no businesses owned or debounce < 1s.<br>3. Caps seconds at `p_offline_cap_seconds`.<br>4. Computes earned cash via `base_income * level * 1.07^(level - 1)`.<br>5. Updates `player_balances.cash`, resets `player_businesses.last_claim_at`, inserts `reward_ledger` entry.<br>6. Returns `{ claimedAmount, newBalance, claimedAt, isCapped }`. |
| `empire_upgrade_business` | `p_user_id uuid`, `p_business_slug text`, `p_request_id uuid default null` | `jsonb` | 1. Looks up business slug; returns `{ error: 'BUSINESS_NOT_FOUND' }` if missing.<br>2. Auto-initializes `player_businesses` row at level 0 if not yet present.<br>3. Calculates upgrade cost: `base_cost` if level <= 0, else `round(base_cost * 1.18^level)`.<br>4. Takes row lock on `player_balances` (`FOR UPDATE`); returns `{ error: 'PLAYER_NOT_FOUND' }` or `{ error: 'INSUFFICIENT_CASH' }`.<br>5. Atomically deducts cash, increments level, updates `last_claim_at`, inserts ledger row.<br>6. Returns `{ business: { slug, name, level, baseCost, baseIncome, upgradeCost, productionPerSecond, lastClaimAt }, remainingCash, totalProductionPerSecond }`. |
| `empire_get_game_state` | `p_user_id uuid` | `jsonb` | 1. Stable read of player balances (default 100 cash, 0 SP).<br>2. Checks active `convenience_pass` entitlement; sets cap to 43200 (12h) if pass active, else 14400 (4h).<br>3. Aggregates all 6 businesses with level, upgradeCost, productionPerSecond.<br>4. Computes `totalProductionPerSecond`.<br>5. Includes active season summary (`id, name, status, startsAt, endsAt, sruSnapshot`).<br>6. Includes referral summary (`referralCode, totalInvites, qualifiedCount, totalEarnedPoints`). |
| `empire_bind_referral` | `p_user_id uuid`, `p_referral_code text` | `jsonb` | 1. Checks if user already referred; returns `{ success: false, error: 'ALREADY_REFERRED', starterCashBoost: 0 }`.<br>2. Resolves referrer by `referral_code`; returns `{ success: false, error: 'INVALID_CODE', starterCashBoost: 0 }` if not found.<br>3. Self-referral check; returns `{ success: false, error: 'SELF_REFERRAL', starterCashBoost: 0 }`.<br>4. Checks 30-minute bind window; returns `{ success: false, error: 'BIND_WINDOW_EXPIRED', starterCashBoost: 0 }`.<br>5. Inserts into `referrals`, adds +500 cash to `player_balances`, logs `referral_boost_grant` in ledger.<br>6. Returns `{ success: true, starterCashBoost: 500 }`. |
| `empire_get_referral_status` | `p_user_id uuid` | `jsonb` | 1. Fetches user referral code and deep link `https://t.me/EmpireBot?start=ref_...`.<br>2. Counts `totalInvites` and `qualifiedCount`.<br>3. Sums `totalEarnedPoints` from claimed `referral_events`.<br>4. Computes unlocked tier badges: `recruiter` (>=1), `networker` (>=5), `influencer` (>=10), `ambassador` (>=25), `whale` (>=50). |
| `empire_get_active_missions` | `p_user_id uuid` | `jsonb` (array) | 1. Joins `mission_instances` and `missions`.<br>2. Filters `user_id = p_user_id`, `assigned_date = current_date`, `status in ('in_progress', 'completed')`.<br>3. Returns ordered array of `{ id, key, difficulty, title, description, progress, target, status, rewardPoints, assignedDate, claimedAt }`. |
| `empire_claim_mission` | `p_user_id uuid`, `p_mission_instance_id uuid` | `jsonb` | 1. Verifies mission instance ownership.<br>2. Validates errors: `{ error: 'MISSION_NOT_FOUND' }`, `{ error: 'ALREADY_CLAIMED' }`, `{ error: 'NOT_COMPLETED' }`.<br>3. Sets `status = 'claimed'`, `claimed_at = now()`.<br>4. Credits SP to `player_balances` and `season_scores` (if active season exists).<br>5. Logs to `reward_ledger`.<br>6. Returns `{ missionInstanceId, rewardPoints, newSeasonPoints, claimedAt }`. |
| `empire_get_streak` | `p_user_id uuid` | `jsonb` | 1. Reads `current_streak`, `longest_streak`, `last_claim_date` from `player_streaks`.<br>2. Evaluates `canClaimToday = (last_claim_date != current_date)`.<br>3. Base reward 50 SP + 10 SP per streak day.<br>4. 7-day cycle bonus detection (`(current_streak + 1) % 7 == 0`).<br>5. Returns `{ currentStreak, longestStreak, lastClaimDate, canClaimToday, todayRewardPoints, isCycleBonusToday }`. |

---

## 3. Store Layer (`apps/api/src/economy/store.ts`)

The interface `EconomyStore` is defined as follows:

```typescript
export interface EconomyStore {
  getPlayerState(userId: string): Promise<EconomyPlayerState>;
  initPlayerEconomy(
    userId: string,
    isReferred?: boolean,
  ): Promise<{ success: boolean; cash: number; isReferred: boolean }>;
  claimOfflineEarnings(
    userId: string,
    offlineCapSeconds?: number,
  ): Promise<{
    claimedAmount: number;
    newBalance: number;
    claimedAt: string;
    isCapped: boolean;
  }>;
  upgradeBusiness(
    userId: string,
    businessSlug: string,
    requestId?: string,
  ): Promise<{
    error?: string | undefined;
    business?:
      | {
          slug: string;
          name: string;
          level: number;
          baseCost: number;
          baseIncome: number;
          upgradeCost: number;
          productionPerSecond: number;
          lastClaimAt: string;
        }
      | undefined;
    remainingCash?: number | undefined;
    totalProductionPerSecond?: number | undefined;
  }>;
  getGameState(userId: string): Promise<Record<string, unknown>>;
  bindReferral(
    userId: string,
    referralCode: string,
  ): Promise<{
    success: boolean;
    error?: string | undefined;
    starterCashBoost: number;
  }>;
  getReferralStatus(userId: string): Promise<Record<string, unknown>>;
  getActiveMissions(userId: string): Promise<unknown[]>;
  claimMission(
    userId: string,
    missionInstanceId: string,
  ): Promise<Record<string, unknown>>;
  getStreak(userId: string): Promise<Record<string, unknown>>;
}
```

The concrete implementation `SupabaseEconomyStore` executes standard Supabase PostgREST RPC requests (`POST ${url}/rest/v1/rpc/${name}`) using `Authorization: Bearer ${serviceKey}` and handles serialization:
- All 8 methods are implemented in `SupabaseEconomyStore`.
- Note on `upgradeBusiness`: If the DB returns `{ error: ... }`, the store returns `{ error: String(res.error) }` without throwing, enabling clean HTTP 400 handling in the route layer.
- Note on `claimOfflineEarnings`: If no cap argument is passed, it defaults to `14400`. When a player possesses an active Convenience Pass, passing `43200` ensures full 12-hour offline claim credit.
- Note on `bindReferral`: Returns `{ success: boolean, error?: string, starterCashBoost: number }`.

---

## 4. Shared Schemas & DTO Contracts (`packages/shared/src/index.ts`)

All necessary Zod schemas and DTO TypeScript types are already exported from `@empire/shared`:

### 4.1. Claim Offline Earnings
```typescript
export const claimCashRequestSchema = z.object({
  requestId: z.uuid(),
}).strict();
export type ClaimCashRequest = z.infer<typeof claimCashRequestSchema>;

export const claimCashResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  claimedAmount: z.number().int().nonnegative(),
  newBalance: z.number().int().nonnegative(),
  claimedAt: z.iso.datetime(),
  isCapped: z.boolean(),
});
export type ClaimCashResponse = z.infer<typeof claimCashResponseSchema>;
```

### 4.2. Upgrade Business
```typescript
export const upgradeBusinessRequestSchema = z.object({
  businessSlug: z.string().min(1).max(64),
  requestId: z.uuid(),
}).strict();
export type UpgradeBusinessRequest = z.infer<typeof upgradeBusinessRequestSchema>;

export const upgradeBusinessResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  business: playerBusinessSchema,
  remainingCash: z.number().int().nonnegative(),
  totalProductionPerSecond: z.number().nonnegative(),
});
export type UpgradeBusinessResponse = z.infer<typeof upgradeBusinessResponseSchema>;
```

### 4.3. Player Business
```typescript
export const playerBusinessSchema = z.object({
  slug: z.string(),
  name: z.string(),
  level: z.number().int().nonnegative(),
  baseCost: z.number().positive(),
  baseIncome: z.number().positive(),
  upgradeCost: z.number().int().positive(),
  productionPerSecond: z.number().nonnegative(),
  lastClaimAt: z.iso.datetime(),
  paybackPeriodSeconds: z.number().nonnegative().or(z.literal(Infinity)).optional(),
  marginalRoi: z.number().nonnegative().optional(),
  nextProductionPerSecond: z.number().nonnegative().optional(),
});
```

### 4.4. Mission Instance & Claim
```typescript
export const playerMissionInstanceSchema = z.object({
  id: z.uuid(),
  key: z.string(),
  difficulty: z.enum(['easy', 'normal', 'hard', 'weekly']),
  title: z.string(),
  description: z.string(),
  progress: z.number().int().nonnegative(),
  target: z.number().int().positive(),
  status: z.enum(['in_progress', 'completed', 'claimed']),
  rewardPoints: z.number().int().positive(),
  assignedDate: z.string(),
  claimedAt: z.iso.datetime().nullable(),
});

export const claimMissionRequestSchema = z.object({
  missionInstanceId: z.uuid(),
  requestId: z.uuid(),
}).strict();

export const claimMissionResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  missionInstanceId: z.uuid(),
  rewardPoints: z.number().int().positive(),
  newSeasonPoints: z.number().int().nonnegative(),
  claimedAt: z.iso.datetime(),
});
```

### 4.5. Streak
```typescript
export const playerStreakDtoSchema = z.object({
  currentStreak: z.number().int().nonnegative(),
  longestStreak: z.number().int().nonnegative(),
  lastClaimDate: z.string().nullable(),
  canClaimToday: z.boolean(),
  todayRewardPoints: z.number().int().positive(),
  isCycleBonusToday: z.boolean(),
});
```

### 4.6. Referral
```typescript
export const bindReferralRequestSchema = z.object({
  referralCode: z.string().min(4).max(32),
  requestId: z.uuid(),
}).strict();

export const bindReferralResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  success: z.boolean(),
  starterCashBoost: z.number().int().nonnegative(),
});

export const playerReferralOverviewSchema = z.object({
  referralCode: z.string(),
  deepLink: z.string(),
  totalInvites: z.number().int().nonnegative(),
  qualifiedCount: z.number().int().nonnegative(),
  totalEarnedPoints: z.number().int().nonnegative(),
  unlockedBadges: z.array(z.string()),
});
```

---

## 5. Auth Extraction, Routing, & Error Conventions in `apps/api`

### 5.1. Session Extraction Pattern
In `apps/api/src/auth/routes.ts`:
```typescript
export const COOKIE = '__Host-empire_session';

export function sessionCookie(header: string) { ... }

export async function getCurrentUserSession(
  header: string | undefined,
  env: Bindings,
  store: AuthStore,
  now: () => number = () => Math.floor(Date.now() / 1000),
): Promise<StoredSession | null> { ... }
```
In every authenticated endpoint:
```typescript
const authStore = makeAuthStore(c.env);
const session = await getCurrentUserSession(
  c.req.header('Cookie'),
  c.env,
  authStore,
  now,
);
if (!session) {
  return c.json(error('UNAUTHORIZED'), 401);
}
```

### 5.2. Standard Error Response Envelope
Consistently across all modules:
```typescript
const error = (code: string) => ({
  apiVersion: 'v1' as const,
  error: { code },
});
```
- `401`: `{ apiVersion: 'v1', error: { code: 'UNAUTHORIZED' } }`
- `400`: `{ apiVersion: 'v1', error: { code: 'INVALID_REQUEST' } }`
- `400`: `{ apiVersion: 'v1', error: { code: 'INSUFFICIENT_CASH' } }`
- `400`: `{ apiVersion: 'v1', error: { code: 'BUSINESS_NOT_FOUND' } }`
- `400`: `{ apiVersion: 'v1', error: { code: 'ALREADY_REFERRED' } }`
- `400`: `{ apiVersion: 'v1', error: { code: 'SELF_REFERRAL' } }`
- `400`: `{ apiVersion: 'v1', error: { code: 'BIND_WINDOW_EXPIRED' } }`
- `400`: `{ apiVersion: 'v1', error: { code: 'MISSION_NOT_FOUND' } }` or 404
- `404`: `{ apiVersion: 'v1', error: { code: 'NOT_FOUND' } }`

### 5.3. Mounting Pattern at Both `/` and `/api`
In `apps/api/src/index.ts`:
```typescript
const economy = createEconomyRoutes(
  factories.makeEconomyStore,
  factories.makeAuthStore,
  now,
);
app.route('/', economy);
app.route('/api', economy);
```
Mounting Hono route trees at both `/` and `/api` ensures that paths registered as `/economy/claim` respond to both:
- `POST /economy/claim`
- `POST /api/economy/claim`

---

## 6. Implementation Plan for Requirement R1 (`POST /economy/claim` & `POST /economy/upgrade`)

Both endpoints belong in `apps/api/src/economy/routes.ts`.

### 6.1. `POST /economy/claim`
```typescript
// POST /economy/claim
routes.post('/economy/claim', async (c) => {
  const authStore = makeAuthStore(c.env);
  const session = await getCurrentUserSession(
    c.req.header('Cookie'),
    c.env,
    authStore,
    now,
  );
  if (!session) {
    return c.json(error('UNAUTHORIZED'), 401);
  }

  let body: ClaimCashRequest;
  try {
    body = claimCashRequestSchema.parse(await c.req.json());
  } catch {
    return c.json(error('INVALID_REQUEST'), 400);
  }

  const economyStore = makeStore(c.env);
  const playerState = await economyStore.getPlayerState(session.user.id);
  const offlineCapSeconds = playerState.hasConveniencePass ? 43200 : 14400;

  const result = await economyStore.claimOfflineEarnings(
    session.user.id,
    offlineCapSeconds,
  );

  const response: ClaimCashResponse = {
    apiVersion: 'v1',
    claimedAmount: result.claimedAmount,
    newBalance: result.newBalance,
    claimedAt: result.claimedAt,
    isCapped: result.isCapped,
  };

  return c.json(response, 200);
});
```

### 6.2. `POST /economy/upgrade`
```typescript
// POST /economy/upgrade
routes.post('/economy/upgrade', async (c) => {
  const authStore = makeAuthStore(c.env);
  const session = await getCurrentUserSession(
    c.req.header('Cookie'),
    c.env,
    authStore,
    now,
  );
  if (!session) {
    return c.json(error('UNAUTHORIZED'), 401);
  }

  let body: UpgradeBusinessRequest;
  try {
    body = upgradeBusinessRequestSchema.parse(await c.req.json());
  } catch {
    return c.json(error('INVALID_REQUEST'), 400);
  }

  const economyStore = makeStore(c.env);
  const result = await economyStore.upgradeBusiness(
    session.user.id,
    body.businessSlug,
    body.requestId,
  );

  if (result.error) {
    return c.json(error(result.error), 400);
  }

  const response: UpgradeBusinessResponse = {
    apiVersion: 'v1',
    business: result.business!,
    remainingCash: result.remainingCash!,
    totalProductionPerSecond: result.totalProductionPerSecond!,
  };

  return c.json(response, 200);
});
```

---

## 7. Implementation Plan for Requirement R2 (`/game/state`, `/missions/*`, `/streak`, `/referral/*`)

### 7.1. Architectural Options Evaluation

| Option | File Structure | Pros | Cons | Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| **Option A: Consolidated in `economy/routes.ts`** | All 8 endpoints added directly to `apps/api/src/economy/routes.ts`. | Zero new files, all 8 methods are already in `EconomyStore`, `index.ts` is untouched, `AppStoreFactories` is unchanged, 100% backward compatible. | `economy/routes.ts` handles missions and referrals alongside core economy. | **Strongly Recommended** |
| **Option B: Distinct route modules** | Create `apps/api/src/game/routes.ts`, `apps/api/src/missions/routes.ts`, `apps/api/src/referral/routes.ts`, `apps/api/src/streak/routes.ts`. | High file separation per domain. | Requires updating `AppStoreFactories` in `apps/api/src/index.ts` or passing `makeEconomyStore` to 4 separate route creators; adds multiple route mounting blocks in `index.ts`. | Acceptable alternative if strict file separation is mandated. |

Because `EconomyStore` is already the unified data access interface containing all 8 methods, **Option A** is the most cohesive, zero-boilerplate design. Below are the exact endpoint implementations.

### 7.2. Endpoint Implementations

#### 1. `GET /game/state`
```typescript
// GET /game/state
routes.get('/game/state', async (c) => {
  const authStore = makeAuthStore(c.env);
  const session = await getCurrentUserSession(
    c.req.header('Cookie'),
    c.env,
    authStore,
    now,
  );
  if (!session) {
    return c.json(error('UNAUTHORIZED'), 401);
  }

  const economyStore = makeStore(c.env);
  const state = await economyStore.getGameState(session.user.id);

  return c.json({
    apiVersion: 'v1',
    ...state,
  }, 200);
});
```

#### 2. `GET /missions/active`
```typescript
// GET /missions/active
routes.get('/missions/active', async (c) => {
  const authStore = makeAuthStore(c.env);
  const session = await getCurrentUserSession(
    c.req.header('Cookie'),
    c.env,
    authStore,
    now,
  );
  if (!session) {
    return c.json(error('UNAUTHORIZED'), 401);
  }

  const economyStore = makeStore(c.env);
  const missions = await economyStore.getActiveMissions(session.user.id);

  // Return the JSON array directly to satisfy the acceptance criterion:
  // "GET /missions/active returns array of today's mission instances"
  return c.json(missions, 200);
});
```

#### 3. `POST /missions/:id/claim`
```typescript
// POST /missions/:id/claim
routes.post('/missions/:id/claim', async (c) => {
  const authStore = makeAuthStore(c.env);
  const session = await getCurrentUserSession(
    c.req.header('Cookie'),
    c.env,
    authStore,
    now,
  );
  if (!session) {
    return c.json(error('UNAUTHORIZED'), 401);
  }

  const missionId = c.req.param('id');
  if (!missionId || !z.uuid().safeParse(missionId).success) {
    return c.json(error('INVALID_REQUEST'), 400);
  }

  const economyStore = makeStore(c.env);
  const result = await economyStore.claimMission(session.user.id, missionId);

  if (result.error) {
    return c.json(error(String(result.error)), 400);
  }

  const response: ClaimMissionResponse = {
    apiVersion: 'v1',
    missionInstanceId: String(result.missionInstanceId ?? missionId),
    rewardPoints: Number(result.rewardPoints ?? 0),
    newSeasonPoints: Number(result.newSeasonPoints ?? 0),
    claimedAt: String(result.claimedAt ?? new Date().toISOString()),
  };

  return c.json(response, 200);
});
```

#### 4. `GET /streak`
```typescript
// GET /streak
routes.get('/streak', async (c) => {
  const authStore = makeAuthStore(c.env);
  const session = await getCurrentUserSession(
    c.req.header('Cookie'),
    c.env,
    authStore,
    now,
  );
  if (!session) {
    return c.json(error('UNAUTHORIZED'), 401);
  }

  const economyStore = makeStore(c.env);
  const streak = await economyStore.getStreak(session.user.id);

  return c.json({
    apiVersion: 'v1',
    ...streak,
  }, 200);
});
```

#### 5. `POST /referral/bind`
```typescript
// POST /referral/bind
routes.post('/referral/bind', async (c) => {
  const authStore = makeAuthStore(c.env);
  const session = await getCurrentUserSession(
    c.req.header('Cookie'),
    c.env,
    authStore,
    now,
  );
  if (!session) {
    return c.json(error('UNAUTHORIZED'), 401);
  }

  let body: BindReferralRequest;
  try {
    body = bindReferralRequestSchema.parse(await c.req.json());
  } catch {
    return c.json(error('INVALID_REQUEST'), 400);
  }

  const economyStore = makeStore(c.env);
  const result = await economyStore.bindReferral(
    session.user.id,
    body.referralCode,
  );

  if (!result.success || result.error) {
    return c.json(error(result.error ?? 'REFERRAL_BIND_FAILED'), 400);
  }

  const response: BindReferralResponse = {
    apiVersion: 'v1',
    success: true,
    starterCashBoost: result.starterCashBoost,
  };

  return c.json(response, 200);
});
```

#### 6. `GET /referral/status`
```typescript
// GET /referral/status
routes.get('/referral/status', async (c) => {
  const authStore = makeAuthStore(c.env);
  const session = await getCurrentUserSession(
    c.req.header('Cookie'),
    c.env,
    authStore,
    now,
  );
  if (!session) {
    return c.json(error('UNAUTHORIZED'), 401);
  }

  const economyStore = makeStore(c.env);
  const status = await economyStore.getReferralStatus(session.user.id);

  return c.json({
    apiVersion: 'v1',
    ...status,
  }, 200);
});
```

---

## 8. Test Database Harness Extension (`apps/api/src/auth/test-db.ts`)

To support integration testing against PGlite:
1. Migration registration: add `'202609140007_game_loop_apis.sql'` to the `migrations` array in `createTestDatabase()`.
2. RPC dispatch cases: add the 8 RPCs to the switch statement in `fetcher`:
```typescript
case 'empire_claim_offline_earnings':
  sql = 'select public.empire_claim_offline_earnings($1, $2) as result';
  args = [p.p_user_id, p.p_offline_cap_seconds ?? 14400];
  break;
case 'empire_upgrade_business':
  sql = 'select public.empire_upgrade_business($1, $2, $3) as result';
  args = [p.p_user_id, p.p_business_slug, p.p_request_id ?? null];
  break;
case 'empire_get_game_state':
  sql = 'select public.empire_get_game_state($1) as result';
  args = [p.p_user_id];
  break;
case 'empire_bind_referral':
  sql = 'select public.empire_bind_referral($1, $2) as result';
  args = [p.p_user_id, p.p_referral_code];
  break;
case 'empire_get_referral_status':
  sql = 'select public.empire_get_referral_status($1) as result';
  args = [p.p_user_id];
  break;
case 'empire_get_active_missions':
  sql = 'select public.empire_get_active_missions($1) as result';
  args = [p.p_user_id];
  break;
case 'empire_claim_mission':
  sql = 'select public.empire_claim_mission($1, $2) as result';
  args = [p.p_user_id, p.p_mission_instance_id];
  break;
case 'empire_get_streak':
  sql = 'select public.empire_get_streak($1) as result';
  args = [p.p_user_id];
  break;
```

---

## 9. Integration Test Verification Matrix

Every new endpoint must have automated integration tests against the PGlite test harness covering:
1. **Authentication Guard**: Calling any of the 8 endpoints without an authenticated cookie header returns HTTP `401` with `{ apiVersion: 'v1', error: { code: 'UNAUTHORIZED' } }`.
2. **Offline Claim (`POST /economy/claim`)**:
   - Succeeds and returns `ClaimCashResponse` with `claimedAmount`, `newBalance`, `claimedAt`, `isCapped`.
   - Rejects invalid request bodies (missing `requestId` or malformed UUID) with HTTP `400` `INVALID_REQUEST`.
3. **Business Upgrade (`POST /economy/upgrade`)**:
   - Succeeds on valid slug with sufficient balance (e.g. Street Stand with 100 starter cash), decrements cash, and returns updated business state.
   - Returns HTTP `400` `INSUFFICIENT_CASH` when player cash is less than the upgrade cost.
   - Returns HTTP `400` `BUSINESS_NOT_FOUND` when an invalid business slug is passed.
4. **Game State (`GET /game/state`)**:
   - Returns HTTP `200` with cash balance, 6 businesses, active season, and referral summary.
   - Verifies dual-prefix access at both `/game/state` and `/api/game/state`.
5. **Missions (`GET /missions/active` & `POST /missions/:id/claim`)**:
   - `GET /missions/active` returns an array of today's mission instances.
   - `POST /missions/:id/claim` returns HTTP `400` `NOT_COMPLETED` or `MISSION_NOT_FOUND` for non-claimable missions, and awards SP when completed.
6. **Streak (`GET /streak`)**:
   - Returns current streak, longest streak, reward points, and `canClaimToday` flag.
7. **Referrals (`POST /referral/bind` & `GET /referral/status`)**:
   - `POST /referral/bind` with a second user's code awards +500 cash boost.
   - `POST /referral/bind` with self referral returns HTTP `400` `SELF_REFERRAL`.
   - `GET /referral/status` returns referral code, link, count, and tier badges.
