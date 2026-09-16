# Web Frontend Integration Survey — Requirement R4 (Project Empire)

**Target Area**: `apps/web/src/game/live-game.tsx` and related components in `apps/web/src/`  
**Surveyed by**: `teamwork_preview_explorer_survey4_web`  
**Timestamp**: 2026-09-14T19:48:00Z  

---

## 1. Executive Summary

Requirement R4 connects the frontend live game shell (`apps/web/src/game/live-game.tsx`) to the newly implemented game loop APIs:
1. **EmpireScreen**: Connect `onClaim` to `POST /economy/claim` and `onUpgrade` to `POST /economy/upgrade`. Compute live `claimable` earnings so the claim button activates.
2. **MissionsScreen**: Replace `unavailable` with live queries to `GET /api/missions/active` and `GET /api/streak`, map DTOs to `MissionsView`, and wire `onClaim` to `POST /api/missions/:id/claim`.
3. **FriendsScreen**: Replace `unavailable` with live query to `GET /api/referral/status`, map to `FriendsView` with safe Telegram deep link sanitization (`?startapp=ref_`), and wire `POST /api/referral/bind`.

All required schemas and types are already present and verified in `@empire/shared`. No UI/CSS design changes are needed, strictly maintaining the Astra 6.0 visual boundary while completing the game loop connection.

---

## 2. Screen Props & Contract Specifications

### 2.1 `EmpireScreen` (`apps/web/src/screens/empire-screen.tsx`)
```typescript
type EmpireScreenProps = {
  resource: ScreenResource<EmpireView>;
  onClaim?: () => void;
  onUpgrade?: (slug: string) => void;
};
```
- **Expected Data (`EmpireView`)**:
  - `cash: number` — current player cash balance.
  - `seasonPoints: number | null` — current season points.
  - `production: number` — total production cash/sec across all businesses.
  - `claimable: number | null` — accumulated offline earnings.
    - **Crucial UI Logic**: `canClaim = data.claimable !== null && data.claimable > 0 && Boolean(onClaim)`.
    - In the existing `live-game.tsx`, `claimable` was hardcoded to `null`, meaning the "Geliri topla" button was permanently disabled and displayed "Toplanacak gelir birikiyor."
    - **Fix**: Calculate `claimable` from `economy.data.totalProductionPerSecond` and the elapsed time since `min(lastClaimAt)` across active businesses (`level > 0`), capped by `offlineCapSeconds`.
  - `offlineHours: number` — offline accumulation cap (e.g. 4h free, 12h pass).
  - `businesses: BusinessView[]` — list of 6 businesses (`slug`, `name`, `level`, `production`, `upgradeCost`, `paybackSeconds`, `recommended`).
- **Interactive Handlers**:
  - `onClaim?: () => void` — Triggered when clicking "Geliri topla". If undefined, renders `<p className="empire-action-note">Gelir toplama yakında</p>`.
  - `onUpgrade?: (slug: string) => void` — Triggered on business cards. If undefined, renders action label `'Yükseltme yakında'` / `'İşletme açma yakında'`. When defined and affordable, enables button `'Yükselt'` / `'İşletmeyi aç'`.

### 2.2 `MissionsScreen` (`apps/web/src/screens/missions-screen.tsx`)
```typescript
type MissionsScreenProps = {
  resource: ScreenResource<MissionsView>;
  onClaim?: (id: string) => void;
};
```
- **Expected Data (`MissionsView`)**:
  - `streak: number` — current consecutive day streak. Screen renders a 7-day progress strip (`Math.min(7, Math.max(0, streak))`).
  - `missions: MissionView[]` where:
    ```typescript
    type MissionView = {
      id: string; // uuid
      title: string;
      description: string;
      difficulty: 'easy' | 'normal' | 'hard' | 'weekly';
      progress: number;
      target: number;
      reward: number; // mapped from rewardPoints
      status: 'in_progress' | 'completed' | 'claimed';
    };
    ```
- **Interactive Handlers**:
  - `onClaim?: (id: string) => void` — Triggered when clicking "Ödülü al" on completed missions (`mission.status === 'completed'`). If undefined, renders `'Ödül alma yakında'`. When defined and mission is completed, button is enabled with label `'Ödülü al'`. Claimed missions show disabled button with label `'Alındı'`.

### 2.3 `FriendsScreen` (`apps/web/src/screens/friends-screen.tsx`)
```typescript
type FriendsScreenProps = {
  resource: ScreenResource<FriendsView>;
};
```
- **Expected Data (`FriendsView`)**:
  - `link: string` — Telegram referral link.
    - **CRITICAL DISCOVERY**: `FriendsScreen` executes `isSafeTelegramInvite(data.link)`:
      ```typescript
      url.protocol === 'https:' &&
      url.hostname === 't.me' &&
      /^\/[A-Za-z0-9_]+\/?$/.test(url.pathname) &&
      params.length === 1 &&
      params[0]?.[0] === 'startapp' &&
      /^ref_[A-Za-z0-9]+$/.test(params[0]?.[1] ?? '')
      ```
      The SQL migration `202609140007_game_loop_apis.sql` constructs `'https://t.me/EmpireBot?start=ref_' || code` (using `start` instead of `startapp`).
      If passed directly, `isSafeTelegramInvite` evaluates to `false`, causing the link to show as "Davet bağlantısı kullanılamıyor" and disabling the copy button!
      **Requirement for live-game.tsx**: Ensure the parameter is normalized to `startapp=ref_${referralCode}` so `isSafeTelegramInvite` succeeds.
  - `totalInvites: number` — total invited friends count.
  - `qualified: number` — count of friends who reached qualification criteria.
  - `earnedPoints: number` — total points earned from referrals.
  - `friends: { name: string; initial: string; stage: string; days: number }[]` — list of friend items. If empty (`[]`), renders the designed empty state "İlk ortağın için yer hazır".
- **Referral Bind**:
  - `FriendsScreenProps` currently accepts only `resource`. There is no visual bind input in `FriendsScreen` (visual components are strictly frozen for Astra 6.0).
  - In `live-game.tsx`, implement the mutation calling `POST /api/referral/bind` and make it available (e.g. auto-binding from Telegram launch start_param if present, or exported helper).

---

## 3. Data Fetching, Cookie Auth, & Mutation Lifecycle

### 3.1 Fetching Architecture
- `live-game.tsx` uses `@tanstack/react-query` v5 (`useQuery`, `useInfiniteQuery`).
- Resources are wrapped into `ScreenResource<T>` (`status: 'loading' | 'ready' | 'error' | 'unavailable'`, `data: T | null`, `onRetry?: () => void`).
- `getGameResource(path, schema, signal)` in `apps/web/src/game/api.ts` handles:
  - `credentials: 'same-origin'` (tested and asserted in `api.test.ts`).
  - Request timeout of 8000ms.
  - Zod parsing against the response schema.
  - Error normalization to `ApiError(response.status, code)`.

### 3.2 Authentication & Cookies
- Authentication is session-cookie based (`empire_session`).
- In `vite.config.ts`, the dev server proxies `/api` to `http://127.0.0.1:8787` (rewriting `/api` prefix).
- In production (Cloudflare Workers), routes are mounted at both `/` and `/api`.
- All requests in `live-game.tsx` use the `/api` prefix (e.g. `/api/economy/roi`, `/api/missions/active`).
- Sending `credentials: 'same-origin'` transmits the session cookie seamlessly.

### 3.3 State Invalidation & Refetching
Use `useQueryClient` from `@tanstack/react-query`:
- On `claimOfflineCashMutation` success:
  - Invalidate `['game-design', actor, 'economy']`.
- On `upgradeBusinessMutation` success:
  - Invalidate `['game-design', actor, 'economy']`.
- On `claimMissionMutation` success:
  - Invalidate `['game-design', actor, 'missions']`.
  - Invalidate `['game-design', actor, 'economy']` (to update season points and wallet).
- On `bindReferralMutation` success:
  - Invalidate `['game-design', actor, 'referral']`.
  - Invalidate `['game-design', actor, 'economy']` (+500 cash starter boost).

---

## 4. Shared DTOs & Schema Compatibility (`@empire/shared`)

The following DTOs and Zod schemas in `@empire/shared` are ready for direct consumption:

| Endpoint | Method | Request Schema | Response Schema | Shared Types |
|---|---|---|---|---|
| `/api/economy/claim` | POST | `claimCashRequestSchema` | `claimCashResponseSchema` | `ClaimCashRequest`, `ClaimCashResponse` |
| `/api/economy/upgrade` | POST | `upgradeBusinessRequestSchema` | `upgradeBusinessResponseSchema` | `UpgradeBusinessRequest`, `UpgradeBusinessResponse` |
| `/api/missions/active` | GET | N/A | `z.array(playerMissionInstanceSchema)` or enveloped | `PlayerMissionInstance` |
| `/api/missions/:id/claim` | POST | `claimMissionRequestSchema` | `claimMissionResponseSchema` | `ClaimMissionRequest`, `ClaimMissionResponse` |
| `/api/streak` | GET | N/A | `playerStreakDtoSchema` or enveloped | `PlayerStreakDto` |
| `/api/referral/status` | GET | N/A | `playerReferralOverviewSchema` or enveloped | `PlayerReferralOverview` |
| `/api/referral/bind` | POST | `bindReferralRequestSchema` | `bindReferralResponseSchema` | `BindReferralRequest`, `BindReferralResponse` |

### Enveloped vs Array Response Tolerance
To ensure 100% decoupling from backend envelope variations (whether the route returns a raw array/DTO or `{ apiVersion: 'v1', ... }`), the client schemas are defined with `z.union`:
- **Missions Schema**:
  ```typescript
  const missionsResponseSchema = z.union([
    z.array(playerMissionInstanceSchema),
    z.object({
      apiVersion: z.literal('v1'),
      missions: z.array(playerMissionInstanceSchema),
    }),
  ]);
  ```
- **Streak Schema**:
  ```typescript
  const streakResponseSchema = z.union([
    playerStreakDtoSchema,
    z.object({
      apiVersion: z.literal('v1'),
      streak: playerStreakDtoSchema,
    }),
  ]);
  ```
- **Referral Schema**:
  ```typescript
  const referralStatusResponseSchema = z.union([
    playerReferralOverviewSchema,
    z.object({
      apiVersion: z.literal('v1'),
      referral: playerReferralOverviewSchema,
    }),
    z.object({
      apiVersion: z.literal('v1'),
      referralCode: z.string(),
      deepLink: z.string(),
      totalInvites: z.number().int().nonnegative(),
      qualifiedCount: z.number().int().nonnegative(),
      totalEarnedPoints: z.number().int().nonnegative(),
      unlockedBadges: z.array(z.string()),
    }),
  ]);
  ```

---

## 5. Exact Code Modifications for `apps/web/src/game/live-game.tsx`

### 5.1 Import Additions
```typescript
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  bindReferralResponseSchema,
  claimCashResponseSchema,
  claimMissionResponseSchema,
  economyRoiResponseSchema,
  leaderboardResponseSchema,
  playerMissionInstanceSchema,
  playerReferralOverviewSchema,
  playerStreakDtoSchema,
  shopCatalogResponseSchema,
  upgradeBusinessResponseSchema,
} from '@empire/shared';
import type {
  PlayerMissionInstance,
  PlayerReferralOverview,
  PlayerState,
  PlayerStreakDto,
} from '@empire/shared';
import { z } from 'zod';
```

### 5.2 Helper for POST Requests
```typescript
async function postGameResource<T>(
  path: string,
  body: unknown,
  schema: { parse: (value: unknown) => T },
): Promise<T> {
  const timeout = AbortSignal.timeout(8000);
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
    signal: timeout,
  });

  if (!response.ok) {
    let code = 'UNAVAILABLE';
    try {
      const data = await response.json();
      if (typeof data?.error?.code === 'string') code = data.error.code;
    } catch {
      /* Keep raw server errors out of the UI. */
    }
    throw new ApiError(response.status, code);
  }

  return schema.parse(await response.json());
}
```

### 5.3 Queries & Mutations in `GameShell`
```typescript
export function GameShell(...) {
  const [tab, setTab] = useState<GameTab>('empire');
  const [scope, setScope] = useState<'global' | 'friends'>('global');
  const actor = state.user.id;
  const queryClient = useQueryClient();

  // 1. Economy Query
  const economy = useQuery({
    queryKey: ['game-design', actor, 'economy'],
    queryFn: ({ signal }) =>
      getGameResource('/api/economy/roi', economyRoiResponseSchema, signal),
    staleTime: 30000,
    retry: false,
  });

  // 2. Economy Mutations
  const claimMutation = useMutation({
    mutationFn: () =>
      postGameResource(
        '/api/economy/claim',
        { requestId: crypto.randomUUID() },
        claimCashResponseSchema,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['game-design', actor, 'economy'],
      });
    },
  });

  const upgradeMutation = useMutation({
    mutationFn: (slug: string) =>
      postGameResource(
        '/api/economy/upgrade',
        { businessSlug: slug, requestId: crypto.randomUUID() },
        upgradeBusinessResponseSchema,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['game-design', actor, 'economy'],
      });
    },
  });

  // 3. Missions & Streak Queries
  const missions = useQuery({
    queryKey: ['game-design', actor, 'missions'],
    enabled: tab === 'missions',
    queryFn: ({ signal }) =>
      getGameResource('/api/missions/active', missionsResponseSchema, signal),
    staleTime: 30000,
    retry: false,
  });

  const streak = useQuery({
    queryKey: ['game-design', actor, 'streak'],
    enabled: tab === 'missions',
    queryFn: ({ signal }) =>
      getGameResource('/api/streak', streakResponseSchema, signal),
    staleTime: 30000,
    retry: false,
  });

  // 4. Mission Claim Mutation
  const claimMissionMutation = useMutation({
    mutationFn: (missionId: string) =>
      postGameResource(
        `/api/missions/${encodeURIComponent(missionId)}/claim`,
        { missionInstanceId: missionId, requestId: crypto.randomUUID() },
        claimMissionResponseSchema,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['game-design', actor, 'missions'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['game-design', actor, 'economy'],
      });
    },
  });

  // 5. Referral Query & Mutation
  const referral = useQuery({
    queryKey: ['game-design', actor, 'referral'],
    enabled: tab === 'friends',
    queryFn: ({ signal }) =>
      getGameResource(
        '/api/referral/status',
        referralStatusResponseSchema,
        signal,
      ),
    staleTime: 30000,
    retry: false,
  });

  const bindReferralMutation = useMutation({
    mutationFn: (code: string) =>
      postGameResource(
        '/api/referral/bind',
        { referralCode: code, requestId: crypto.randomUUID() },
        bindReferralResponseSchema,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['game-design', actor, 'referral'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['game-design', actor, 'economy'],
      });
    },
  });
```

### 5.4 Live Resource Construction
```typescript
  // Live Claimable Calculation
  const activeBusinesses =
    economy.data?.businesses.filter((b) => b.level > 0) ?? [];
  const earliestClaim =
    activeBusinesses.length > 0
      ? Math.min(
          ...activeBusinesses.map((b) => new Date(b.lastClaimAt).getTime()),
        )
      : null;
  const offlineCapSeconds =
    economy.data?.multipliers?.offlineCapSeconds ?? 14400;
  const elapsedSeconds =
    earliestClaim !== null
      ? Math.min(
          offlineCapSeconds,
          Math.max(0, Math.floor((Date.now() - earliestClaim) / 1000)),
        )
      : 0;
  const claimable = economy.data
    ? Math.floor(economy.data.totalProductionPerSecond * elapsedSeconds)
    : null;

  const empireResource: ScreenResource<EmpireView> = {
    status: economy.isError ? 'error' : economy.isPending ? 'loading' : 'ready',
    onRetry: () => void economy.refetch(),
    data: economy.data
      ? {
          cash: economy.data.currentCash,
          seasonPoints: points,
          production: economy.data.totalProductionPerSecond,
          claimable,
          offlineHours:
            (economy.data.multipliers?.offlineCapSeconds ?? 14400) / 3600,
          businesses: economy.data.businesses.map((b) => ({
            slug: b.slug,
            name: b.name,
            level: b.level,
            production: b.productionPerSecond,
            upgradeCost: b.upgradeCost,
            paybackSeconds: b.paybackPeriodSeconds ?? null,
            recommended: economy.data.optimalUpgrade?.slug === b.slug,
          })),
        }
      : null,
  };

  // Missions Resource
  const rawMissions = missions.data
    ? Array.isArray(missions.data)
      ? missions.data
      : missions.data.missions
    : [];
  const rawStreak = streak.data
    ? 'currentStreak' in streak.data
      ? streak.data.currentStreak
      : streak.data.streak.currentStreak
    : 0;

  const missionsResource: ScreenResource<MissionsView> = {
    status: missions.isError ? 'error' : missions.isPending ? 'loading' : 'ready',
    onRetry: () => {
      void missions.refetch();
      void streak.refetch();
    },
    data: missions.data
      ? {
          streak: rawStreak,
          missions: rawMissions.map((m) => ({
            id: m.id,
            title: m.title,
            description: m.description,
            difficulty: m.difficulty,
            progress: m.progress,
            target: m.target,
            reward: m.rewardPoints,
            status: m.status,
          })),
        }
      : null,
  };

  // Friends Resource
  const refData = referral.data
    ? 'referralCode' in referral.data
      ? referral.data
      : referral.data.referral
    : null;
  const rawLink =
    refData?.deepLink ||
    (refData?.referralCode
      ? `https://t.me/EmpireBot?startapp=ref_${refData.referralCode}`
      : '');
  const safeLink = rawLink.includes('?startapp=')
    ? rawLink
    : rawLink.replace('?start=', '?startapp=');

  const friendsResource: ScreenResource<FriendsView> = {
    status: referral.isError ? 'error' : referral.isPending ? 'loading' : 'ready',
    onRetry: () => void referral.refetch(),
    data: refData
      ? {
          link: safeLink,
          totalInvites: refData.totalInvites,
          qualified: refData.qualifiedCount,
          earnedPoints: refData.totalEarnedPoints,
          friends: [],
        }
      : null,
  };
```

### 5.5 Render Block Updates
```tsx
  {tab === 'empire' && (
    <EmpireScreen
      resource={empireResource}
      onClaim={() => void claimMutation.mutate()}
      onUpgrade={(slug) => void upgradeMutation.mutate(slug)}
    />
  )}
  {tab === 'missions' && (
    <MissionsScreen
      resource={missionsResource}
      onClaim={(id) => void claimMissionMutation.mutate(id)}
    />
  )}
  {tab === 'friends' && <FriendsScreen resource={friendsResource} />}
```

---

## 6. Verification and Risk Analysis

1. **Typecheck & ESLint**:
   All referenced types exist in `@empire/shared` and match exact component props in `EmpireScreenProps`, `MissionsScreenProps`, and `FriendsScreenProps`.
2. **Zero Visual Regressions**:
   No styles in `styles.css`, `empire-missions.css`, or `social.css` are modified. All HTML tags, classNames, and components are untouched.
3. **Safe Telegram Link Invariant**:
   Sanitizing the deep link to `?startapp=ref_` ensures the `isSafeTelegramInvite` validator in `apps/web/src/screens/friends-screen.tsx` passes without failure.
4. **Session Recovery Integration**:
   Adding `missions.error` and `referral.error` to the `unauthorized` check ensures that if a session cookie expires while browsing missions or friends, the user is redirected gracefully to the Telegram reopen screen.
