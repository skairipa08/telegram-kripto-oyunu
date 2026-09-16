# Handoff Report: Missions & Daily Streaks Lifecycle Survey (Requirements R1 & R2)

**Agent**: teamwork_preview_explorer_survey6_missions_rep  
**Role**: Explorer / Investigator (Read-Only)  
**Working Directory**: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_survey6_missions_rep`  
**Date**: 2026-09-15  
**Target Requirements**: R1 (Mission Pool Assignment & Real-Time Action Progression) and R2 (Daily Streak Evaluation & Claim Endpoint) from `ORIGINAL_REQUEST.md` (section `## 2026-09-15T07:19:14Z`).

---

## 1. Observation

### 1.1 `packages/game-core` Mission & Streak Architecture
Direct inspection of `packages/game-core/src/missions.ts` (lines 1–212) and `packages/game-core/src/formulas.ts` (lines 108–123):
- **Difficulty Levels**:
  ```typescript
  // packages/game-core/src/missions.ts:6
  export type MissionDifficulty = 'easy' | 'normal' | 'hard' | 'weekly';
  ```
- **SRU Multipliers**:
  ```typescript
  // packages/game-core/src/missions.ts:17-22
  export const MISSION_SRU_MULTIPLIERS: Record<MissionDifficulty, number> = {
    easy: 0.75,
    normal: 1.0,
    hard: 1.25,
    weekly: 5.0,
  };
  export const STREAK_SRU_MULTIPLIER = 0.25;
  ```
- **Canonical Mission Pool (`DEFAULT_MISSIONS`, lines 26–108)**:
  Contains exactly 9 definitions across 4 difficulty pools:
  1. **Easy Pool (0.75x SRU)**:
     - `upgrade_any_3` (target: 3) — *"Herhangi bir işletmeyi 3 kez yükselt"*
     - `claim_cash_2` (target: 2) — *"İşletmelerden 2 kez gelir topla"*
     - `view_friends` (target: 1) — *"Arkadaşlar sekmesini ziyaret et"*
  2. **Normal Pool (1.00x SRU)**:
     - `upgrade_any_10` (target: 10) — *"Toplam 10 kez işletme yükseltmesi yap"*
     - `reach_milestone` (target: 1) — *"Bir işletmeyi seviye dönüm noktasına (10, 25, 50 vb.) ulaştır"*
     - `claim_cash_5` (target: 5) — *"5 kez gelir topla"*
  3. **Hard Pool (1.25x SRU)**:
     - `claim_offline_4h` (target: 1) — *"En az 4 saatlik çevrimdışı birikmiş kazancı tek seferde topla"*
     - `upgrade_factory_tier` (target: 1) — *"Fabrika veya üst düzey bir işletmeyi en az 1 kez yükselt"*
  4. **Weekly Pool (5.00x SRU)**:
     - `weekly_complete_15_dailies` (target: 15) — *"Hafta boyunca toplam 15 günlük görevi başarıyla tamamla"*
- **Reward Formulas**:
  - `calculateMissionReward(difficulty, currentSRU)` (lines 114–120):
    `Math.round(MISSION_SRU_MULTIPLIERS[difficulty] * currentSRU)`
  - `calculateStreakReward(streakDays, currentSRU)` (lines 127–142):
    - `isCycleBonus = streakDays > 0 && streakDays % 7 === 0`
    - `multiplier = isCycleBonus ? 1.0 : STREAK_SRU_MULTIPLIER` (1.0 vs 0.25)
    - `points = Math.round(multiplier * currentSRU)`
  - `evaluateStreak(lastClaimDate, currentDate, currentStreak)` (lines 148–204):
    - Null `lastClaimDate`: `canClaim: true, nextStreak: 1, wasReset: false`
    - `lastClaimDate === currentDate`: `canClaim: false, nextStreak: currentStreak, wasReset: false`
    - `diffDays === 1`: `canClaim: true, nextStreak: currentStreak >= 7 ? 1 : currentStreak + 1, wasReset: false`
    - `diffDays > 1`: `canClaim: true, nextStreak: 1, wasReset: true`
    - `diffDays < 0`: clock anomaly, `canClaim: false`
  - `isMissionCompleted(progress, target)` (lines 209–211): `progress >= target`
  - `calculateSRU(qap, baseSRU = 500, refQAP = 100, exponent = -0.1, minSRU = 100, maxSRU = 500)` (`formulas.ts:112-123`):
    `Math.max(minSRU, Math.min(maxSRU, Math.round(baseSRU * Math.pow(Math.max(qap, refQAP) / refQAP, exponent))))`
- **Missing Game-Core Utilities**:
  There is currently no automated pool picker in `packages/game-core/src/missions.ts` to deterministically select 3 daily missions (1 easy, 1 normal, 1 hard) and 1 weekly mission for a given user and calendar date.

---

### 1.2 `packages/shared` DTO & Zod Schemas
Inspection of `packages/shared/src/index.ts`:
- **`PlayerMissionInstance` Schema** (lines 183–196):
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
  ```
- **`ClaimMissionRequest` and `ClaimMissionResponse` Schemas** (lines 208–223):
  ```typescript
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
- **`PlayerStreakDto` Schema** (lines 198–206):
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
- **`ClaimStreakRequest` and `ClaimStreakResponse` Schemas** (lines 225–240):
  ```typescript
  export const claimStreakRequestSchema = z.object({
    requestId: z.uuid(),
  }).strict();

  export const claimStreakResponseSchema = z.object({
    apiVersion: z.literal('v1'),
    rewardPoints: z.number().int().positive(),
    newStreak: z.number().int().positive(),
    newSeasonPoints: z.number().int().nonnegative(),
    isCycleBonus: z.boolean(),
    claimedAt: z.iso.datetime(),
  });
  ```

---

### 1.3 `apps/api` Routes, Handlers, and Store Status
Direct inspection of `apps/api/src/economy/store.ts` (lines 1–296) and `apps/api/src/economy/routes.ts` (lines 1–600):
- **Current Economy Routes in `apps/api/src/economy/routes.ts`**:
  - `GET /economy/roi` (line 53)
  - `GET /economy/simulation` (line 169)
  - `POST /economy/claim` (line 219)
  - `POST /economy/upgrade` (line 261)
  - `GET /game/state` (line 335)
  - `GET /missions/active` (line 416)
  - `POST /missions/:id/claim` and `POST /missions/claim` (lines 443–495)
  - `GET /streak` (line 497)
  - `POST /referral/bind` (line 527)
  - `GET /referral/status` (line 567)
- **Mounting in `apps/api/src/index.ts`** (lines 94–101):
  - `createEconomyRoutes` is mounted under both `/` and `/api`:
    ```typescript
    app.route('/', economy);
    app.route('/api', economy);
    ```
- **Discrepancies in API Endpoints**:
  1. `POST /streak/claim` (and `/api/streak/claim`) is **completely missing** from `apps/api/src/economy/routes.ts`.
  2. `EconomyStore` (`apps/api/src/economy/store.ts`) defines `getStreak(userId: string): Promise<Record<string, unknown>>` (line 69), but **does NOT declare or implement `claimStreak(userId: string, requestId?: string)`**.
  3. `GET /missions/active` and `GET /game/state` query active missions, but there is no check or automated assignment invoked if the player has no missions assigned for the current calendar date.

---

### 1.4 Database Schema Inspection (`supabase/migrations/`)
Direct inspection of SQL migrations:
- **`public.missions`** (`202609140003_seasons_missions.sql:34-56`):
  - Columns: `id (uuid)`, `key (text)`, `difficulty (text)`, `title (text)`, `description (text)`, `target (int)`, `reward_sru_multiplier (numeric)`, `enabled (boolean)`, `created_at (timestamptz)`.
  - Canonical 9 missions are seeded with Turkish titles and descriptions.
  - Column `reward_points` is **not in migration 0003**; it was dynamically added in test-db baseline compatibility.
- **`public.mission_instances`** (`202609140003_seasons_missions.sql:58-73`):
  - Columns: `id (uuid)`, `user_id (uuid)`, `season_id (uuid)`, `mission_id (uuid)`, `progress (int default 0)`, `target (int)`, `status (text in ('in_progress','completed','claimed'))`, `assigned_date (date default current_date)`, `claimed_at (timestamptz)`, `created_at (timestamptz)`.
  - Unique constraint: `unique (user_id, mission_id, assigned_date)`.
  - Check constraint: `check ((status = 'claimed' and claimed_at is not null) or (status <> 'claimed' and claimed_at is null))`.
  - Index: `mission_instances_user_date_idx on public.mission_instances(user_id, assigned_date)`.
- **`public.player_streaks`** (`202609140003_seasons_missions.sql:75-81`):
  - Columns: `user_id (uuid pk)`, `current_streak (int 0..7)`, `longest_streak (int >= 0)`, `last_claim_date (date)`, `updated_at (timestamptz)`.
  - Check constraint: `check (current_streak >= 0 and current_streak <= 7)`.
- **`public.player_balances`** (`202609140002_economy.sql:46-51`):
  - Columns: `user_id (uuid pk)`, `cash (bigint >= 0)`, `season_points (bigint >= 0)`, `updated_at (timestamptz)`.
- **`public.season_scores`** (`202609140003_seasons_missions.sql:22-31` & `202609140005_step7_to_11_backend.sql:4-5`):
  - Columns: `season_id (uuid)`, `user_id (uuid)`, `points (bigint >= 0)`, `mission_points (bigint >= 0)`, `referral_points (bigint >= 0)`, `updated_at (timestamptz)`.
  - Primary key: `(season_id, user_id)`.
  - Indexes: `season_scores_leaderboard_idx`, `season_scores_ranking_idx`.
- **`public.reward_ledger`** (`202609140002_economy.sql:67-78`):
  - Columns: `id (uuid pk)`, `user_id (uuid)`, `delta_cash (bigint)`, `delta_season_points (bigint)`, `reason (text)`, `idempotency_key (text unique 64-char hex)`, `metadata (jsonb)`, `created_at (timestamptz)`.

---

### 1.5 Missing Migration 0007 & Existing Test Failures
- `supabase/migrations/202609140007_game_loop_apis.sql` **does NOT exist on disk**.
- When `pnpm test` executes:
  - `packages/game-core`: 211 tests pass (13 files).
  - `apps/api/src/fraud`: 28 tests pass (2 files, because `fraud/test-db.ts` uses `existsSync(url)`).
  - `apps/api` (auth, analytics, config, economy, leaderboard, shop): 9 test suites throw:
    `Error: ENOENT: no such file or directory, open '.../supabase/migrations/202609140007_game_loop_apis.sql'`
- Sequential migration requirement:
  `ORIGINAL_REQUEST.md` line 334 states:
  *"All new database schema modifications or migrations must use sequential numbering (e.g. 202609140009_missions_and_launch.sql if a new migration is required, or extend existing test runners cleanly)."*

---

### 1.6 Frontend UI Screen Boundary
Inspection of `apps/web/src/screens/missions-screen.tsx`:
- Strictly presents missions and daily streak UI (`MissionCard`, `StreakWidget`, difficulty badges, progress bars).
- Expects `onClaim: (id: string) => void` for completed missions.
- Boundary: per system instructions and user request, all files in `apps/web/src/screens/` **must remain untouched**.

---

## 2. Logic Chain

```
[Observation 1.1: 9 canonical missions in 4 pools; 3 daily + 1 weekly mandated]
   │
   ├──> Step 1: Automated Assignment Mechanism
   │    When a player fetches game state (GET /game/state) or active missions (GET /missions/active),
   │    the system evaluates mission instances for current_date.
   │    If no active daily instances exist for today, pick 1 Easy, 1 Normal, 1 Hard from public.missions.
   │    If no active weekly instance exists for the current calendar week, assign 'weekly_complete_15_dailies'.
   │    Insert into public.mission_instances with progress = 0, status = 'in_progress'.
   │
[Observation 1.1 & 1.3: Game actions POST /economy/upgrade and POST /economy/claim]
   │
   ├──> Step 2: Action Progression Hooks Mapping
   │    Action 1: Business Upgrade (POST /economy/upgrade)
   │      - Any upgrade: increments 'upgrade_any_3' and 'upgrade_any_10' progress.
   │      - Level milestone reached: if newLevel in (10, 25, 50, 100, 150...), increments 'reach_milestone'.
   │      - High tier business: if businessSlug in ('factory', 'tech_company', 'global_holding'),
   │        increments 'upgrade_factory_tier'.
   │      - Check progress >= target -> flip status to 'completed'.
   │
   │    Action 2: Cash Claim (POST /economy/claim)
   │      - Any claim: increments 'claim_cash_2' and 'claim_cash_5'.
   │      - Long offline claim: if elapsedSeconds >= 14,400 (4 hours) and claimedAmount > 0,
   │        increments 'claim_offline_4h'.
   │      - Check progress >= target -> flip status to 'completed'.
   │
   │    Action 3: Friends Tab View (GET /referral/status)
   │      - Visiting referral overview increments 'view_friends'.
   │
   │    Action 4: Daily Mission Completion (Hook into Daily Status Transition / Claim)
   │      - Completing or claiming any daily mission increments 'weekly_complete_15_dailies' progress.
   │
[Observation 1.2 & 1.4: Database models & Claim Contracts]
   │
   ├──> Step 3: POST /missions/:id/claim Specification
   │    - Lock mission instance row FOR UPDATE.
   │    - Validate ownership (user_id = session.user.id); return 400 'MISSION_NOT_FOUND' if mismatched.
   │    - If status = 'claimed', check idempotency via requestId; if different requestId, return 400 'ALREADY_CLAIMED'.
   │    - If status != 'completed', return 400 'NOT_COMPLETED'.
   │    - Calculate points = round(reward_sru_multiplier * activeSeason.sru_snapshot).
   │    - Atomically: update mission instance to 'claimed', increment player_balances.season_points,
   │      increment season_scores.points and season_scores.mission_points, insert reward_ledger row.
   │    - Return ClaimMissionResponse matching Zod schema.
   │
[Observation 1.1, 1.2, 1.3: Streak mechanics & missing endpoint]
   │
   ├──> Step 4: POST /streak/claim Specification
   │    - Route: POST /streak/claim (and mounted at /api/streak/claim).
   │    - Lock player_streaks row FOR UPDATE.
   │    - Evaluate consecutive days via evaluateStreak(last_claim_date, current_date, current_streak).
   │    - If last_claim_date = current_date: return 400 'ALREADY_CLAIMED' (or replay if matching requestId).
   │    - If consecutive day (diffDays = 1):
   │        newStreak = current_streak + 1.
   │        isCycleBonus = newStreak % 7 === 0.
   │        multiplier = isCycleBonus ? 1.0 : 0.25.
   │        points = round(multiplier * currentSRU).
   │        If newStreak >= 7, reset cycle counter cleanly (next claim will evaluate from day 1).
   │    - If missed day (diffDays > 1) or first claim:
   │        newStreak = 1.
   │        isCycleBonus = false.
   │        multiplier = 0.25.
   │        points = round(multiplier * currentSRU).
   │    - Atomically: update player_streaks (current_streak, longest_streak, last_claim_date),
   │      credit player_balances.season_points, credit season_scores.points, insert reward_ledger row.
   │    - Return ClaimStreakResponse matching Zod schema.
```

---

## 3. Caveats

1. **Missing 0007 Migration File**:
   `apps/api/src/auth/test-db.ts` expects `supabase/migrations/202609140007_game_loop_apis.sql`, but the file was never committed to git. In subsequent implementation, the team must provide the RPC definitions either in `202609140007_game_loop_apis.sql` (if allowed to restore missing file) or in `202609140009_missions_and_launch.sql`, while updating the test database harness cleanly.
2. **Weekly Mission Assignment Boundary**:
   Weekly missions span across calendar days (ISO week Monday 00:00 to Sunday 23:59 UTC). `assigned_date` in `mission_instances` is a `date` column; weekly missions can use the Monday of the current week (`date_trunc('week', current_date)::date`) to satisfy the uniqueness constraint `(user_id, mission_id, assigned_date)`.
3. **Strict UI Screen Boundary**:
   `apps/web/src/screens/missions-screen.tsx` and all sibling screens must remain untouched. API routes and models must adhere 100% to the contracts already expected by `live-game.tsx` and `@empire/shared`.

---

## 4. Conclusion

1. **R1 Mission Lifecycle**:
   - **Pool Selection**: Automated assignment selects 3 daily missions (1 Easy from `{upgrade_any_3, claim_cash_2, view_friends}`, 1 Normal from `{upgrade_any_10, reach_milestone, claim_cash_5}`, 1 Hard from `{claim_offline_4h, upgrade_factory_tier}`) and 1 Weekly (`weekly_complete_15_dailies`) upon daily state fetch.
   - **Real-Time Progression Hooks**:
     - `POST /economy/claim` increments `claim_cash_*` (all claims) and `claim_offline_4h` (if `elapsedSeconds >= 14400` and `claimedAmount > 0`).
     - `POST /economy/upgrade` increments `upgrade_any_*` (all upgrades), `reach_milestone` (if `level in (10, 25, 50, 100, 150...)`), and `upgrade_factory_tier` (if `business_slug in ('factory', 'tech_company', 'global_holding')`).
     - `GET /referral/status` increments `view_friends`.
     - Completing daily missions increments `weekly_complete_15_dailies`.
   - **Status Flipping**: Transition status from `'in_progress'` to `'completed'` as soon as `progress >= target`.
   - **Claim API**: `POST /missions/:id/claim` (and `/api/missions/:id/claim`) awards Season Points (`round(multiplier * SRU)`), transitions status to `'claimed'`, credits `player_balances.season_points` and `season_scores`, records ledger entry, and handles idempotency with error code `ALREADY_CLAIMED` and `NOT_COMPLETED`.

2. **R2 Streak Lifecycle**:
   - **Endpoint**: Add `POST /streak/claim` (mounted at `/streak/claim` and `/api/streak/claim`).
   - **Store**: Add `claimStreak(userId: string, requestId?: string)` to `EconomyStore` interface and `SupabaseEconomyStore`.
   - **Evaluation**: Consecutive claims increment `current_streak`; Day 7 awards 1.0x SRU bonus and resets cycle; missed day resets `current_streak` to 1; same-day claim returns 400 `ALREADY_CLAIMED`.
   - **Atomicity**: Serialized row locking via `FOR UPDATE` on `player_streaks`, crediting points to `player_balances` and `season_scores`, and logging to `reward_ledger`.

---

## 5. Verification Method

To independently verify these findings:

1. **Verify pure game-core mission & streak tests**:
   ```powershell
   pnpm vitest run packages/game-core/src/missions.test.ts
   ```
   *Expected Output*: 11 tests pass (verifying `calculateMissionReward`, `calculateStreakReward`, `evaluateStreak`, `isMissionCompleted`).

2. **Verify all packages/game-core tests**:
   ```powershell
   pnpm vitest run packages/game-core
   ```
   *Expected Output*: 211 tests pass across 13 test suites.

3. **Verify API route declarations**:
   Inspect `apps/api/src/economy/routes.ts`:
   - Line 416: `GET /missions/active`
   - Line 443: `handleClaimMission` (`POST /missions/:id/claim`)
   - Line 497: `GET /streak`
   - Note absence of `POST /streak/claim`.

4. **Verify database table definitions**:
   Inspect `supabase/migrations/202609140003_seasons_missions.sql`:
   - Lines 34–56: `public.missions`
   - Lines 58–73: `public.mission_instances`
   - Lines 75–81: `public.player_streaks`
   Inspect `supabase/migrations/202609140002_economy.sql`:
   - Lines 46–51: `public.player_balances`
   - Lines 67–78: `public.reward_ledger`

5. **Invalidation Conditions**:
   - If `DEFAULT_MISSIONS` keys or targets in `packages/game-core/src/missions.ts` are changed without updating DB seeds.
   - If `apps/web/src/screens/` is modified, violating the strict UI domain boundary.
