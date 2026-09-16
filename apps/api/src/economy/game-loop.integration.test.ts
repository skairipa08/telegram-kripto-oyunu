import { createHmac, randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  claimCashResponseSchema,
  upgradeBusinessResponseSchema,
  playerStateSchema,
  playerMissionInstanceSchema,
  claimMissionResponseSchema,
  playerStreakDtoSchema,
  bindReferralResponseSchema,
  playerReferralOverviewSchema,
} from '@empire/shared';
import type { Bindings } from '../auth/env';
import { createTestDatabase } from '../auth/test-db';
import { createApp } from '../index';

const now = Math.floor(Date.now() / 1000);
const origin = 'https://empire.example';
const env: Bindings = {
  TELEGRAM_BOT_TOKEN: '123456:game-loop-integration-token',
  SESSION_SECRET: 'super-secret-session-key-with-high-entropy-64-bytes',
  APP_ORIGIN: origin,
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-only-key',
  AUTH_RATE_LIMIT: { limit: async () => ({ success: true }) },
};

let database: Awaited<ReturnType<typeof createTestDatabase>>;
let app: ReturnType<typeof createApp>;

function initData(id: number, username: string) {
  const fields = {
    auth_date: String(now),
    query_id: `query-game-loop-${id}`,
    user: JSON.stringify({ id, first_name: `Player${id}`, username }),
  };
  const check = Object.entries(fields)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const key = createHmac('sha256', 'WebAppData')
    .update(env.TELEGRAM_BOT_TOKEN!)
    .digest();
  return new URLSearchParams({
    ...fields,
    hash: createHmac('sha256', key).update(check).digest('hex'),
  }).toString();
}

async function createAuthenticatedPlayer(id: number, username: string) {
  const res = await app.request(
    '/auth/telegram',
    {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData: initData(id, username),
        requestId: randomUUID(),
      }),
    },
    env,
  );

  expect(res.status).toBe(200);
  const body = (await res.json()) as { user: { id: string } };
  const setCookie = res.headers.get('set-cookie');
  expect(setCookie).toBeTruthy();
  const cookie = setCookie!.split(';')[0]!;

  return {
    userId: body.user.id,
    cookie,
    username,
  };
}

describe('Game Loop Endpoints Integration Test Suite (PGlite)', () => {
  beforeAll(async () => {
    database = await createTestDatabase();
    app = createApp(
      {
        makeAuthStore: () => database.store,
        makeLeaderboardStore: () => database.leaderboardStore,
        makeShopStore: () => database.shopStore,
        makeConfigStore: () => database.configStore,
        makeAnalyticsStore: () => database.analyticsStore,
        makeEconomyStore: () => database.economyStore,
      },
      () => now,
    );
  });

  describe('Fresh migration schema', () => {
    it('runs game-loop APIs against only the canonical columns from migrations 1-7', async () => {
      const forbiddenColumns = await database.db.query<{
        table_name: string;
        column_name: string;
      }>(
        `select table_name, column_name
         from information_schema.columns
         where table_schema = 'public'
           and (
             (table_name = 'missions' and column_name = 'reward_points')
             or (table_name = 'referrals' and column_name in ('referrer_id', 'invitee_id', 'is_qualified', 'qualified_at'))
             or (table_name = 'referral_events' and column_name = 'referrer_id')
           )
         order by table_name, column_name`,
      );

      expect(forbiddenColumns.rows).toEqual([]);

      const player = await createAuthenticatedPlayer(80000, 'canonical_schema');
      const state = await app.request(
        '/game/state',
        { method: 'GET', headers: { Cookie: player.cookie } },
        env,
      );
      expect(state.status).toBe(200);
    });

    it('keeps lifecycle SECURITY DEFINER functions off PUBLIC, anon, and authenticated', async () => {
      const functions = [
        'empire_assign_daily_missions',
        'empire_increment_mission_progress',
        'empire_claim_streak',
        'empire_evaluate_referral_milestones',
        'empire_claim_referral_reward',
      ];
      const privileges = await database.db.query<{
        proname: string;
        safe_search_path: boolean;
        public_execute: boolean;
        anon_execute: boolean;
        authenticated_execute: boolean;
      }>(
        `select p.proname,
                p.proconfig @> array['search_path=""']::text[] as safe_search_path,
                exists (
                  select 1
                  from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
                  where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
                ) as public_execute,
                has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
                has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = any($1::text[])
         order by p.proname`,
        [functions],
      );

      expect(privileges.rows).toHaveLength(functions.length);
      expect(privileges.rows).toEqual(
        expect.arrayContaining(
          functions.map((proname) => ({
            proname,
            safe_search_path: true,
            public_execute: false,
            anon_execute: false,
            authenticated_execute: false,
          })),
        ),
      );
    });
  });

  describe('POST /economy/claim — Offline Earnings Claim', () => {
    it('returns 0 claimed amount when player owns no active businesses', async () => {
      const player = await createAuthenticatedPlayer(80001, 'claim_newbie');

      const res = await app.request(
        '/economy/claim',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: player.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ requestId: randomUUID() }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      const parsed = claimCashResponseSchema.parse(json);

      expect(parsed.apiVersion).toBe('v1');
      expect(parsed.claimedAmount).toBe(0);
      expect(parsed.newBalance).toBe(100);
      expect(parsed.isCapped).toBe(false);
      expect(parsed.claimedAt).toBeTruthy();
    });

    it('claims accumulated offline earnings when player has active business', async () => {
      const player = await createAuthenticatedPlayer(80002, 'claim_earner');

      // Upgrade Street Stand to level 1 (costs 100 cash, leaves 0)
      const upRes = await app.request(
        '/economy/upgrade',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: player.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            businessSlug: 'street_stand',
            requestId: randomUUID(),
          }),
        },
        env,
      );
      expect(upRes.status).toBe(200);

      // Simulate 120 seconds of offline elapsed time
      await database.db.query(
        `update public.player_businesses
         set last_claim_at = now() - interval '120 seconds'
         where user_id = $1 and level > 0`,
        [player.userId],
      );

      const claimRes = await app.request(
        '/economy/claim',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: player.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ requestId: randomUUID() }),
        },
        env,
      );

      expect(claimRes.status).toBe(200);
      const json = await claimRes.json();
      const parsed = claimCashResponseSchema.parse(json);

      // Street Stand level 1 produces 1 cash/second: 120 seconds = 120 cash
      expect(parsed.claimedAmount).toBe(120);
      expect(parsed.newBalance).toBe(120);
      expect(parsed.isCapped).toBe(false);

      // Subsequent immediate claim debounces and returns 0 claimed
      const immediateRes = await app.request(
        '/economy/claim',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: player.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ requestId: randomUUID() }),
        },
        env,
      );
      expect(immediateRes.status).toBe(200);
      const immediateJson = await immediateRes.json();
      const immediateParsed = claimCashResponseSchema.parse(immediateJson);
      expect(immediateParsed.claimedAmount).toBe(0);
      expect(immediateParsed.newBalance).toBe(120);
    });

    it('caps offline earnings when elapsed time exceeds offline cap (14,400s)', async () => {
      const player = await createAuthenticatedPlayer(80003, 'claim_capped');

      // Upgrade Street Stand to level 1
      await app.request(
        '/economy/upgrade',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: player.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            businessSlug: 'street_stand',
            requestId: randomUUID(),
          }),
        },
        env,
      );

      // Simulate 20 hours offline (72,000s > 14,400s free cap)
      await database.db.query(
        `update public.player_businesses
         set last_claim_at = now() - interval '72000 seconds'
         where user_id = $1 and level > 0`,
        [player.userId],
      );

      const claimRes = await app.request(
        '/economy/claim',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: player.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ requestId: randomUUID() }),
        },
        env,
      );

      expect(claimRes.status).toBe(200);
      const parsed = claimCashResponseSchema.parse(await claimRes.json());

      // Production is 1 cash/s capped at 14400s
      expect(parsed.claimedAmount).toBe(14400);
      expect(parsed.isCapped).toBe(true);
    });

    it('uses each business timestamp and applies the level-10 milestone multiplier', async () => {
      const player = await createAuthenticatedPlayer(80004, 'claim_mixed_age');

      await database.db.query(
        'update public.player_balances set cash = 0 where user_id = $1',
        [player.userId],
      );
      await database.db.query(
        `update public.player_businesses pb
         set level = case b.slug when 'street_stand' then 10 when 'cafe' then 1 else 0 end,
             last_claim_at = case
               when b.slug = 'street_stand' then now() - interval '10 seconds'
               when b.slug = 'cafe' then now() - interval '5 seconds'
               else now()
             end
         from public.businesses b
         where pb.business_id = b.id and pb.user_id = $1`,
        [player.userId],
      );

      const response = await app.request(
        '/economy/claim',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: player.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ requestId: randomUUID() }),
        },
        env,
      );

      expect(response.status).toBe(200);
      const claimed = claimCashResponseSchema.parse(await response.json());
      // floor((1 * 10 * 1.07^9 * 2) * 10) + floor(12 * 5)
      expect(claimed.claimedAmount).toBe(427);
      expect(claimed.newBalance).toBe(427);
    });

    it('replays the persisted result for the same claim request id', async () => {
      const player = await createAuthenticatedPlayer(80005, 'claim_replay');
      await database.db.query(
        'update public.player_balances set cash = 0 where user_id = $1',
        [player.userId],
      );
      await database.db.query(
        `update public.player_businesses pb
         set level = 1, last_claim_at = now() - interval '10 seconds'
         from public.businesses b
         where pb.business_id = b.id and pb.user_id = $1 and b.slug = 'street_stand'`,
        [player.userId],
      );
      const requestId = randomUUID();
      const request = () =>
        app.request(
          '/economy/claim',
          {
            method: 'POST',
            headers: {
              Origin: origin,
              Cookie: player.cookie,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ requestId }),
          },
          env,
        );

      const first = await request();
      expect(first.status).toBe(200);
      const firstBody = claimCashResponseSchema.parse(await first.json());

      await database.db.query(
        `update public.player_businesses pb
         set last_claim_at = now() - interval '10 seconds'
         from public.businesses b
         where pb.business_id = b.id and pb.user_id = $1 and b.slug = 'street_stand'`,
        [player.userId],
      );

      const replay = await request();
      expect(replay.status).toBe(200);
      expect(claimCashResponseSchema.parse(await replay.json())).toEqual(
        firstBody,
      );

      const balance = await database.db.query<{ cash: number | string }>(
        'select cash from public.player_balances where user_id = $1',
        [player.userId],
      );
      expect(Number(balance.rows[0]?.cash)).toBe(firstBody.newBalance);
    });
  });

  describe('POST /economy/upgrade — Business Upgrades', () => {
    it('successfully upgrades business level and deducts cash', async () => {
      const player = await createAuthenticatedPlayer(80010, 'upgrade_buyer');

      // Player starts with 100 cash. Street Stand level 0->1 costs 100 cash.
      const res = await app.request(
        '/economy/upgrade',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: player.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            businessSlug: 'street_stand',
            requestId: randomUUID(),
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      const parsed = upgradeBusinessResponseSchema.parse(json);

      expect(parsed.apiVersion).toBe('v1');
      expect(parsed.business.slug).toBe('street_stand');
      expect(parsed.business.level).toBe(1);
      expect(parsed.remainingCash).toBe(0);
      expect(parsed.totalProductionPerSecond).toBe(1);
      expect(parsed.business.upgradeCost).toBe(100);
    });

    it('returns 400 INSUFFICIENT_CASH when player cannot afford upgrade', async () => {
      const player = await createAuthenticatedPlayer(80011, 'upgrade_broke');

      // First upgrade spends all 100 cash
      await app.request(
        '/economy/upgrade',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: player.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            businessSlug: 'street_stand',
            requestId: randomUUID(),
          }),
        },
        env,
      );

      // Second upgrade costs 118 cash, but player has 0 cash
      const failRes = await app.request(
        '/economy/upgrade',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: player.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            businessSlug: 'street_stand',
            requestId: randomUUID(),
          }),
        },
        env,
      );

      expect(failRes.status).toBe(400);
      const json = (await failRes.json()) as { error: { code: string } };
      expect(json.error.code).toBe('INSUFFICIENT_CASH');
    });

    it('returns 400 BUSINESS_NOT_FOUND when business slug is invalid', async () => {
      const player = await createAuthenticatedPlayer(80012, 'upgrade_bad_slug');

      const res = await app.request(
        '/economy/upgrade',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: player.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            businessSlug: 'intergalactic_spaceport',
            requestId: randomUUID(),
          }),
        },
        env,
      );

      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: { code: string } };
      expect(json.error.code).toBe('BUSINESS_NOT_FOUND');
    });

    it('returns 400 INVALID_REQUEST when body schema validation fails', async () => {
      const player = await createAuthenticatedPlayer(80013, 'upgrade_bad_body');

      const res = await app.request(
        '/economy/upgrade',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: player.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requestId: 'not-a-uuid',
          }),
        },
        env,
      );

      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: { code: string } };
      expect(json.error.code).toBe('INVALID_REQUEST');
    });

    it('settles accrued income before a level-1 upgrade and charges the level-minus-one cost', async () => {
      const player = await createAuthenticatedPlayer(80014, 'upgrade_settle');
      await database.db.query(
        'update public.player_balances set cash = 0 where user_id = $1',
        [player.userId],
      );
      await database.db.query(
        `update public.player_businesses pb
         set level = 1, last_claim_at = now() - interval '100 seconds'
         from public.businesses b
         where pb.business_id = b.id and pb.user_id = $1 and b.slug = 'street_stand'`,
        [player.userId],
      );

      const response = await app.request(
        '/economy/upgrade',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: player.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            businessSlug: 'street_stand',
            requestId: randomUUID(),
          }),
        },
        env,
      );

      expect(response.status).toBe(200);
      const upgraded = upgradeBusinessResponseSchema.parse(
        await response.json(),
      );
      expect(upgraded.business.level).toBe(2);
      expect(upgraded.business.upgradeCost).toBe(118);
      expect(upgraded.remainingCash).toBe(0);

      const ledger = await database.db.query<{
        reason: string;
        delta_cash: number | string;
      }>(
        `select reason, delta_cash from public.reward_ledger
         where user_id = $1 and reason in ('offline_claim', 'business_upgrade')
         order by created_at, reason`,
        [player.userId],
      );
      expect(
        ledger.rows.map((row) => [row.reason, Number(row.delta_cash)]),
      ).toEqual(
        expect.arrayContaining([
          ['offline_claim', 100],
          ['business_upgrade', -100],
        ]),
      );
    });

    it('replays an upgrade request and rejects request-id reuse with a different business', async () => {
      const player = await createAuthenticatedPlayer(80015, 'upgrade_replay');
      await database.db.query(
        'update public.player_balances set cash = 1000 where user_id = $1',
        [player.userId],
      );
      const requestId = randomUUID();
      const upgrade = (businessSlug: string) =>
        app.request(
          '/economy/upgrade',
          {
            method: 'POST',
            headers: {
              Origin: origin,
              Cookie: player.cookie,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ businessSlug, requestId }),
          },
          env,
        );

      const first = await upgrade('street_stand');
      expect(first.status).toBe(200);
      const firstBody = upgradeBusinessResponseSchema.parse(await first.json());
      const replay = await upgrade('street_stand');
      expect(replay.status).toBe(200);
      expect(upgradeBusinessResponseSchema.parse(await replay.json())).toEqual(
        firstBody,
      );

      const conflict = await upgrade('cafe');
      expect(conflict.status).toBe(409);
      expect(
        ((await conflict.json()) as { error: { code: string } }).error.code,
      ).toBe('IDEMPOTENCY_CONFLICT');

      const level = await database.db.query<{ level: number }>(
        `select pb.level from public.player_businesses pb
         join public.businesses b on b.id = pb.business_id
         where pb.user_id = $1 and b.slug = 'street_stand'`,
        [player.userId],
      );
      expect(Number(level.rows[0]?.level)).toBe(1);
    });

    it('matches game-core cost and production at the level-10 milestone boundary', async () => {
      const player = await createAuthenticatedPlayer(
        80016,
        'upgrade_milestone',
      );
      await database.db.query(
        'update public.player_balances set cash = 1000 where user_id = $1',
        [player.userId],
      );
      await database.db.query(
        `update public.player_businesses pb
         set level = 9, last_claim_at = now()
         from public.businesses b
         where pb.business_id = b.id and pb.user_id = $1 and b.slug = 'street_stand'`,
        [player.userId],
      );

      const response = await app.request(
        '/economy/upgrade',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: player.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            businessSlug: 'street_stand',
            requestId: randomUUID(),
          }),
        },
        env,
      );

      expect(response.status).toBe(200);
      const upgraded = upgradeBusinessResponseSchema.parse(
        await response.json(),
      );
      expect(upgraded.business.level).toBe(10);
      expect(upgraded.business.upgradeCost).toBe(444);
      expect(upgraded.business.productionPerSecond).toBeCloseTo(36.769, 2);
      expect(upgraded.totalProductionPerSecond).toBeCloseTo(36.769, 2);
      expect(upgraded.remainingCash).toBe(624);
    });
  });

  describe('Economy formula consistency', () => {
    it('reports the canonical next cost for current level in ROI and game state', async () => {
      const player = await createAuthenticatedPlayer(80017, 'formula_state');
      await database.db.query(
        `update public.player_businesses pb set level = 1
         from public.businesses b
         where pb.business_id = b.id and pb.user_id = $1 and b.slug = 'street_stand'`,
        [player.userId],
      );

      const roi = await app.request(
        '/economy/roi',
        { method: 'GET', headers: { Cookie: player.cookie } },
        env,
      );
      const gameState = await app.request(
        '/game/state',
        { method: 'GET', headers: { Cookie: player.cookie } },
        env,
      );

      expect(roi.status).toBe(200);
      expect(gameState.status).toBe(200);
      const roiBody = (await roi.json()) as {
        businesses: Array<{ slug: string; upgradeCost: number }>;
      };
      const stateBody = (await gameState.json()) as {
        businesses: Array<{ slug: string; upgradeCost: number }>;
      };
      expect(
        roiBody.businesses.find((business) => business.slug === 'street_stand')
          ?.upgradeCost,
      ).toBe(100);
      expect(
        stateBody.businesses.find(
          (business) => business.slug === 'street_stand',
        )?.upgradeCost,
      ).toBe(100);
    });
  });

  describe('GET /game/state — Combined Player State', () => {
    it('returns full player economy state, businesses, and active season', async () => {
      const player = await createAuthenticatedPlayer(80020, 'gamestate_user');

      const res = await app.request(
        '/game/state',
        {
          method: 'GET',
          headers: { Cookie: player.cookie },
        },
        env,
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      const parsed = playerStateSchema.parse(json);

      expect(parsed.apiVersion).toBe('v1');
      expect(parsed.user.id).toBe(player.userId);
      expect(parsed.game.status).toBe('active');

      if (parsed.game.status === 'active') {
        expect(parsed.game.economy.cash).toBe(100);
        expect(parsed.game.economy.businesses).toHaveLength(6);
        expect(parsed.game.economy.offlineCapSeconds).toBe(14400);
      }

      // Also verify top-level active season data in raw response
      const raw = json as {
        activeSeason?: { id: string; status: string; name: string };
        referral?: { referralCode: string; totalInvites: number };
      };
      expect(raw.activeSeason).toBeDefined();
      expect(raw.activeSeason?.status).toBe('active');
      expect(raw.activeSeason?.name).toBe('Genesis Season');
      expect(raw.referral).toBeDefined();
    });
  });

  describe('GET /missions/active — Today Active Missions', () => {
    it("returns array of today's active mission instances", async () => {
      const player = await createAuthenticatedPlayer(80030, 'mission_reader');

      // Seed a mission instance for today
      await database.db.query(
        `insert into public.mission_instances (user_id, season_id, mission_id, progress, target, status, assigned_date)
         select $1, s.id, m.id, 1, m.target, 'in_progress', current_date
         from public.seasons s, public.missions m
         where s.status = 'active' and m.key = 'upgrade_any_3'
         on conflict do nothing`,
        [player.userId],
      );

      const res = await app.request(
        '/missions/active',
        {
          method: 'GET',
          headers: { Cookie: player.cookie },
        },
        env,
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json)).toBe(true);

      const missions = json as unknown[];
      expect(missions.length).toBeGreaterThanOrEqual(1);

      const firstMission = playerMissionInstanceSchema.parse(missions[0]);
      expect(firstMission.key).toBe('upgrade_any_3');
      expect(firstMission.status).toBe('in_progress');
      expect(firstMission.progress).toBe(1);
      expect(firstMission.target).toBe(3);
      expect(firstMission.rewardPoints).toBeGreaterThan(0);
    });
  });

  describe('POST /missions/:id/claim — Mission Reward Claim', () => {
    it('claims completed mission reward and awards season points', async () => {
      const player = await createAuthenticatedPlayer(80040, 'mission_claimer');

      // Seed a completed mission instance
      const insertRes = await database.db.query<{ id: string }>(
        `insert into public.mission_instances (user_id, season_id, mission_id, progress, target, status, assigned_date)
         select $1, s.id, m.id, m.target, m.target, 'completed', current_date
         from public.seasons s, public.missions m
         where s.status = 'active' and m.key = 'claim_cash_2'
         returning id`,
        [player.userId],
      );
      expect(insertRes.rows.length).toBe(1);
      const instanceId = insertRes.rows[0]?.id;

      const claimRes = await app.request(
        `/missions/${instanceId}/claim`,
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: player.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ requestId: randomUUID() }),
        },
        env,
      );

      expect(claimRes.status).toBe(200);
      const json = await claimRes.json();
      const parsed = claimMissionResponseSchema.parse(json);

      expect(parsed.apiVersion).toBe('v1');
      expect(parsed.missionInstanceId).toBe(instanceId);
      expect(parsed.rewardPoints).toBeGreaterThan(0);
      expect(parsed.newSeasonPoints).toBe(parsed.rewardPoints);
      expect(parsed.claimedAt).toBeTruthy();

      // Database verification: player balance season_points updated
      const balRes = await database.db.query<{ season_points: number }>(
        'select season_points from public.player_balances where user_id = $1',
        [player.userId],
      );
      expect(Number(balRes.rows[0]?.season_points)).toBe(parsed.rewardPoints);

      // Re-claiming the same mission returns ALREADY_CLAIMED
      const duplicateRes = await app.request(
        `/missions/${instanceId}/claim`,
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: player.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ requestId: randomUUID() }),
        },
        env,
      );
      expect(duplicateRes.status).toBe(400);
      const dupJson = (await duplicateRes.json()) as {
        error: { code: string };
      };
      expect(dupJson.error.code).toBe('ALREADY_CLAIMED');
    });

    it('rejects claiming incomplete mission with NOT_COMPLETED', async () => {
      const player = await createAuthenticatedPlayer(
        80041,
        'mission_incomplete',
      );

      const insertRes = await database.db.query<{ id: string }>(
        `insert into public.mission_instances (user_id, season_id, mission_id, progress, target, status, assigned_date)
         select $1, s.id, m.id, 0, m.target, 'in_progress', current_date
         from public.seasons s, public.missions m
         where s.status = 'active' and m.key = 'view_friends'
         returning id`,
        [player.userId],
      );
      const instanceId = insertRes.rows[0]?.id;

      const res = await app.request(
        `/missions/${instanceId}/claim`,
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: player.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ requestId: randomUUID() }),
        },
        env,
      );

      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: { code: string } };
      expect(json.error.code).toBe('NOT_COMPLETED');
    });

    it('rejects claiming non-existent mission with MISSION_NOT_FOUND', async () => {
      const player = await createAuthenticatedPlayer(80042, 'mission_missing');

      const nonExistentId = randomUUID();
      const res = await app.request(
        `/missions/${nonExistentId}/claim`,
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: player.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ requestId: randomUUID() }),
        },
        env,
      );

      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: { code: string } };
      expect(json.error.code).toBe('MISSION_NOT_FOUND');
    });

    it('replays queued duplicate mission claims without awarding twice', async () => {
      const player = await createAuthenticatedPlayer(80043, 'mission_replay');
      const inserted = await database.db.query<{ id: string }>(
        `insert into public.mission_instances
           (user_id, season_id, mission_id, progress, target, status, assigned_date)
         select $1, s.id, m.id, m.target, m.target, 'completed', current_date
         from public.seasons s, public.missions m
         where s.status = 'active' and m.key = 'claim_cash_2'
         returning id`,
        [player.userId],
      );
      const instanceId = inserted.rows[0]!.id;
      const requestId = randomUUID();
      const claim = () =>
        app.request(
          `/missions/${instanceId}/claim`,
          {
            method: 'POST',
            headers: {
              Origin: origin,
              Cookie: player.cookie,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ requestId }),
          },
          env,
        );

      // PGlite queues these transactions; this verifies replay invariants, not
      // real PostgreSQL lock scheduling under simultaneous connections.
      const responses = await Promise.all([claim(), claim()]);
      expect(responses.map((response) => response.status)).toEqual([200, 200]);
      const bodies = await Promise.all(
        responses.map(async (response) =>
          claimMissionResponseSchema.parse(await response.json()),
        ),
      );
      expect(bodies[1]).toEqual(bodies[0]);
      expect(bodies[0]?.rewardPoints).toBe(375);

      const balance = await database.db.query<{
        season_points: number | string;
      }>(
        'select season_points from public.player_balances where user_id = $1',
        [player.userId],
      );
      expect(Number(balance.rows[0]?.season_points)).toBe(375);

      const ledger = await database.db.query<{ count: number | string }>(
        `select count(*) as count from public.reward_ledger
         where user_id = $1 and reason = 'mission_claim'`,
        [player.userId],
      );
      expect(Number(ledger.rows[0]?.count)).toBe(1);
    });

    it('does not expose or mutate a mission owned by another player', async () => {
      const owner = await createAuthenticatedPlayer(80044, 'mission_owner');
      const attacker = await createAuthenticatedPlayer(
        80045,
        'mission_attacker',
      );
      const inserted = await database.db.query<{ id: string }>(
        `insert into public.mission_instances
           (user_id, season_id, mission_id, progress, target, status, assigned_date)
         select $1, s.id, m.id, m.target, m.target, 'completed', current_date
         from public.seasons s, public.missions m
         where s.status = 'active' and m.key = 'claim_cash_2'
         returning id`,
        [owner.userId],
      );

      const response = await app.request(
        `/missions/${inserted.rows[0]!.id}/claim`,
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: attacker.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ requestId: randomUUID() }),
        },
        env,
      );

      expect(response.status).toBe(400);
      expect(
        ((await response.json()) as { error: { code: string } }).error.code,
      ).toBe('MISSION_NOT_FOUND');
      const ownerMission = await database.db.query<{ status: string }>(
        'select status from public.mission_instances where id = $1',
        [inserted.rows[0]!.id],
      );
      expect(ownerMission.rows[0]?.status).toBe('completed');
    });
  });

  describe('GET /streak — Streak Status & Claimability', () => {
    it('returns default streak data when player has not yet claimed', async () => {
      const player = await createAuthenticatedPlayer(80050, 'streak_newbie');

      const res = await app.request(
        '/streak',
        {
          method: 'GET',
          headers: { Cookie: player.cookie },
        },
        env,
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      const parsed = playerStreakDtoSchema.parse(json);

      expect(parsed.currentStreak).toBe(0);
      expect(parsed.longestStreak).toBe(0);
      expect(parsed.canClaimToday).toBe(true);
      expect(parsed.todayRewardPoints).toBe(50);
      expect(parsed.isCycleBonusToday).toBe(false);
    });

    it('returns persisted streak state and checks canClaimToday flag', async () => {
      const player = await createAuthenticatedPlayer(80051, 'streak_veteran');

      // Seed player streak with 3-day streak claimed yesterday
      await database.db.query(
        `insert into public.player_streaks (user_id, current_streak, longest_streak, last_claim_date)
         values ($1, 3, 5, current_date - 1)
         on conflict (user_id) do update set current_streak = 3, longest_streak = 5, last_claim_date = current_date - 1`,
        [player.userId],
      );

      const res = await app.request(
        '/streak',
        {
          method: 'GET',
          headers: { Cookie: player.cookie },
        },
        env,
      );

      expect(res.status).toBe(200);
      const parsed = playerStreakDtoSchema.parse(await res.json());

      expect(parsed.currentStreak).toBe(3);
      expect(parsed.longestStreak).toBe(5);
      expect(parsed.canClaimToday).toBe(true);
      expect(parsed.todayRewardPoints).toBe(80); // 50 + 3 * 10

      // Now simulate player already claiming today
      await database.db.query(
        'update public.player_streaks set last_claim_date = current_date where user_id = $1',
        [player.userId],
      );

      const resClaimed = await app.request(
        '/streak',
        {
          method: 'GET',
          headers: { Cookie: player.cookie },
        },
        env,
      );

      expect(resClaimed.status).toBe(200);
      const parsedClaimed = playerStreakDtoSchema.parse(
        await resClaimed.json(),
      );
      expect(parsedClaimed.canClaimToday).toBe(false);
    });
  });

  describe('POST /streak/claim — Idempotent Daily Reward', () => {
    it('replays the same request UUID without awarding streak points twice', async () => {
      const player = await createAuthenticatedPlayer(80052, 'streak_replay');
      const requestId = randomUUID();
      const claim = () =>
        app.request(
          '/streak/claim',
          {
            method: 'POST',
            headers: {
              Origin: origin,
              Cookie: player.cookie,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ requestId }),
          },
          env,
        );

      const first = await claim();
      const replay = await claim();
      expect(first.status).toBe(200);
      expect(replay.status).toBe(200);
      const firstBody = await first.json();
      expect(await replay.json()).toEqual(firstBody);

      const balance = await database.db.query<{
        season_points: number | string;
      }>(
        'select season_points from public.player_balances where user_id = $1',
        [player.userId],
      );
      const ledger = await database.db.query<{ count: number | string }>(
        `select count(*) as count from public.reward_ledger
         where user_id = $1 and reason = 'streak_claim'`,
        [player.userId],
      );
      expect(Number(balance.rows[0]?.season_points)).toBe(
        Number((firstBody as { rewardPoints: number }).rewardPoints),
      );
      expect(Number(ledger.rows[0]?.count)).toBe(1);
    });
  });

  describe('POST /referral/bind — Referral Binding & Starter Boost', () => {
    it('successfully binds referral code and awards +500 Cash bonus', async () => {
      const referrer = await createAuthenticatedPlayer(
        80060,
        'referrer_master',
      );
      const invitee = await createAuthenticatedPlayer(80061, 'invitee_buddy');

      // Assign an explicit referral code to referrer
      await database.db.query(
        "update public.users set referral_code = 'REF_TOPLEADER' where id = $1",
        [referrer.userId],
      );

      // Invitee binds referrer's code
      const bindRes = await app.request(
        '/referral/bind',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: invitee.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            referralCode: 'REF_TOPLEADER',
            requestId: randomUUID(),
          }),
        },
        env,
      );

      expect(bindRes.status).toBe(200);
      const json = await bindRes.json();
      const parsed = bindReferralResponseSchema.parse(json);

      expect(parsed.apiVersion).toBe('v1');
      expect(parsed.success).toBe(true);
      expect(parsed.starterCashBoost).toBe(500);

      // Invitee balance now has 100 starter + 500 referral = 600 cash
      const balRes = await database.db.query<{ cash: number }>(
        'select cash from public.player_balances where user_id = $1',
        [invitee.userId],
      );
      expect(Number(balRes.rows[0]?.cash)).toBe(600);

      // Re-binding returns ALREADY_REFERRED
      const dupRes = await app.request(
        '/referral/bind',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: invitee.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            referralCode: 'REF_TOPLEADER',
            requestId: randomUUID(),
          }),
        },
        env,
      );
      expect(dupRes.status).toBe(400);
      const dupJson = (await dupRes.json()) as { error: { code: string } };
      expect(dupJson.error.code).toBe('ALREADY_REFERRED');
    });

    it('rejects self-referral with 400 error', async () => {
      const player = await createAuthenticatedPlayer(80062, 'self_promoter');

      await database.db.query(
        "update public.users set referral_code = 'REF_SELFIE' where id = $1",
        [player.userId],
      );

      const res = await app.request(
        '/referral/bind',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: player.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            referralCode: 'REF_SELFIE',
            requestId: randomUUID(),
          }),
        },
        env,
      );

      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: { code: string } };
      expect(json.error.code).toBe('SELF_REFERRAL');
    });

    it('rejects non-existent referral code with 400 INVALID_CODE', async () => {
      const player = await createAuthenticatedPlayer(80063, 'lost_code_user');

      const res = await app.request(
        '/referral/bind',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: player.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            referralCode: 'REF_DOES_NOT_EXIST',
            requestId: randomUUID(),
          }),
        },
        env,
      );

      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: { code: string } };
      expect(json.error.code).toBe('INVALID_CODE');
    });

    it('replays referral binding and rejects request-id reuse with another code', async () => {
      const firstReferrer = await createAuthenticatedPlayer(
        80064,
        'first_referrer',
      );
      const secondReferrer = await createAuthenticatedPlayer(
        80065,
        'second_referrer',
      );
      const invitee = await createAuthenticatedPlayer(80066, 'bind_replay');
      await database.db.query(
        `update public.users
         set referral_code = case id
           when $1 then 'REF_FIRST'
           when $2 then 'REF_SECOND'
         end
         where id in ($1, $2)`,
        [firstReferrer.userId, secondReferrer.userId],
      );
      const requestId = randomUUID();
      const bind = (referralCode: string) =>
        app.request(
          '/referral/bind',
          {
            method: 'POST',
            headers: {
              Origin: origin,
              Cookie: invitee.cookie,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ referralCode, requestId }),
          },
          env,
        );

      const first = await bind('REF_FIRST');
      expect(first.status).toBe(200);
      const firstBody = bindReferralResponseSchema.parse(await first.json());
      const replay = await bind('REF_FIRST');
      expect(replay.status).toBe(200);
      expect(bindReferralResponseSchema.parse(await replay.json())).toEqual(
        firstBody,
      );

      const conflict = await bind('REF_SECOND');
      expect(conflict.status).toBe(409);
      expect(
        ((await conflict.json()) as { error: { code: string } }).error.code,
      ).toBe('IDEMPOTENCY_CONFLICT');

      const balance = await database.db.query<{ cash: number | string }>(
        'select cash from public.player_balances where user_id = $1',
        [invitee.userId],
      );
      expect(Number(balance.rows[0]?.cash)).toBe(600);
    });
  });

  describe('GET /referral/status — Referral Status & Overview', () => {
    it('returns referral code, invite counts, and unlocked badges', async () => {
      const referrer = await createAuthenticatedPlayer(
        80070,
        'badge_collector',
      );
      const invitee = await createAuthenticatedPlayer(80071, 'badge_invitee');

      await database.db.query(
        "update public.users set referral_code = 'REF_BADGEBOSS' where id = $1",
        [referrer.userId],
      );

      // Bind invitee to referrer
      await app.request(
        '/referral/bind',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: invitee.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            referralCode: 'REF_BADGEBOSS',
            requestId: randomUUID(),
          }),
        },
        env,
      );

      // Check status with 1 unqualified invite
      const res = await app.request(
        '/referral/status',
        {
          method: 'GET',
          headers: { Cookie: referrer.cookie },
        },
        env,
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      const parsed = playerReferralOverviewSchema.parse(json);

      expect(parsed.referralCode).toBe('REF_BADGEBOSS');
      expect(parsed.deepLink).toContain('REF_BADGEBOSS');
      expect(parsed.totalInvites).toBe(1);
      expect(parsed.qualifiedCount).toBe(0);
      expect(parsed.unlockedBadges).toEqual([]);

      // Qualify the referral to unlock recruiter badge
      await database.db.query(
        `update public.referrals set status = 'qualified'
         where referrer_user_id = $1`,
        [referrer.userId],
      );

      const qualifiedRes = await app.request(
        '/referral/status',
        {
          method: 'GET',
          headers: { Cookie: referrer.cookie },
        },
        env,
      );

      expect(qualifiedRes.status).toBe(200);
      const qualifiedParsed = playerReferralOverviewSchema.parse(
        await qualifiedRes.json(),
      );
      expect(qualifiedParsed.qualifiedCount).toBe(1);
      expect(qualifiedParsed.unlockedBadges).toContain('recruiter');
    });
  });

  describe('POST /referral/claim — Idempotent Owned Reward', () => {
    it('replays one request UUID and rejects its reuse for another referral event', async () => {
      const referrer = await createAuthenticatedPlayer(
        80072,
        'reward_referrer',
      );
      const invitee = await createAuthenticatedPlayer(80073, 'reward_invitee');
      const referral = await database.db.query<{ id: string }>(
        `insert into public.referrals (invitee_user_id, referrer_user_id, code, status)
         values ($1, $2, 'REF_REWARD', 'qualified') returning id`,
        [invitee.userId, referrer.userId],
      );
      const events = await database.db.query<{ id: string }>(
        `insert into public.referral_events
           (referral_id, milestone, reward_amount, status)
         values ($1, 'activation', 250, 'pending'),
                ($1, 'progression', 750, 'pending')
         returning id`,
        [referral.rows[0]!.id],
      );
      const requestId = randomUUID();
      const claim = (eventId: string) =>
        app.request(
          '/referral/claim',
          {
            method: 'POST',
            headers: {
              Origin: origin,
              Cookie: referrer.cookie,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ eventId, requestId }),
          },
          env,
        );

      const first = await claim(events.rows[0]!.id);
      const replay = await claim(events.rows[0]!.id);
      expect(first.status).toBe(200);
      expect(replay.status).toBe(200);
      const firstBody = await first.json();
      expect(await replay.json()).toEqual(firstBody);

      const conflict = await claim(events.rows[1]!.id);
      expect(conflict.status).toBe(409);
      expect(
        ((await conflict.json()) as { error: { code: string } }).error.code,
      ).toBe('IDEMPOTENCY_CONFLICT');

      const balance = await database.db.query<{
        season_points: number | string;
      }>(
        'select season_points from public.player_balances where user_id = $1',
        [referrer.userId],
      );
      expect(Number(balance.rows[0]?.season_points)).toBe(250);
    });
  });

  describe('Unauthenticated 401 Verification across all endpoints', () => {
    it('rejects unauthenticated requests with HTTP 401 for every game loop route', async () => {
      const endpoints: Array<{
        method: 'GET' | 'POST';
        path: string;
        body?: Record<string, unknown>;
      }> = [
        {
          method: 'POST',
          path: '/economy/claim',
          body: { requestId: randomUUID() },
        },
        {
          method: 'POST',
          path: '/economy/upgrade',
          body: { businessSlug: 'street_stand', requestId: randomUUID() },
        },
        { method: 'GET', path: '/game/state' },
        { method: 'GET', path: '/missions/active' },
        {
          method: 'POST',
          path: `/missions/${randomUUID()}/claim`,
          body: { requestId: randomUUID() },
        },
        { method: 'GET', path: '/streak' },
        {
          method: 'POST',
          path: '/streak/claim',
          body: { requestId: randomUUID() },
        },
        {
          method: 'POST',
          path: '/referral/bind',
          body: { referralCode: 'REF_TEST', requestId: randomUUID() },
        },
        { method: 'GET', path: '/referral/status' },
        {
          method: 'POST',
          path: '/referral/claim',
          body: { eventId: randomUUID(), requestId: randomUUID() },
        },
      ];

      for (const endpoint of endpoints) {
        const init: RequestInit = {
          method: endpoint.method,
        };
        if (endpoint.method === 'POST') {
          init.headers = { Origin: origin, 'Content-Type': 'application/json' };
          if (endpoint.body) {
            init.body = JSON.stringify(endpoint.body);
          }
        }

        const res = await app.request(endpoint.path, init, env);

        expect(res.status, `Expected 401 for ${endpoint.path}`).toBe(401);
        const json = (await res.json()) as { error: { code: string } };
        expect(json.error.code).toBe('UNAUTHORIZED');
      }
    });
  });

  describe('Assembled app POST policy', () => {
    it('rejects cross-origin requests before every game-loop mutation', async () => {
      const player = await createAuthenticatedPlayer(80081, 'csrf_guard');
      const requests: Array<{ path: string; body: Record<string, unknown> }> = [
        { path: '/economy/claim', body: { requestId: randomUUID() } },
        {
          path: '/economy/upgrade',
          body: { businessSlug: 'street_stand', requestId: randomUUID() },
        },
        {
          path: `/missions/${randomUUID()}/claim`,
          body: { requestId: randomUUID() },
        },
        {
          path: '/referral/bind',
          body: { referralCode: 'REF_TEST', requestId: randomUUID() },
        },
        { path: '/streak/claim', body: { requestId: randomUUID() } },
        {
          path: '/referral/claim',
          body: { eventId: randomUUID(), requestId: randomUUID() },
        },
      ];

      for (const request of requests) {
        const response = await app.request(
          request.path,
          {
            method: 'POST',
            headers: {
              Origin: 'https://attacker.example',
              Cookie: player.cookie,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(request.body),
          },
          env,
        );
        expect(response.status, request.path).toBe(403);
        expect(
          ((await response.json()) as { error: { code: string } }).error.code,
          request.path,
        ).toBe('FORBIDDEN');
      }
    });
  });

  describe('Dual-Prefix Route Verification (/ and /api)', () => {
    it('verifies game loop endpoints respond equivalently under / and /api', async () => {
      const player = await createAuthenticatedPlayer(80080, 'dual_prefix_hero');

      // 1. /game/state vs /api/game/state
      const stateRoot = await app.request(
        '/game/state',
        { method: 'GET', headers: { Cookie: player.cookie } },
        env,
      );
      const stateApi = await app.request(
        '/api/game/state',
        { method: 'GET', headers: { Cookie: player.cookie } },
        env,
      );
      expect(stateRoot.status).toBe(200);
      expect(stateApi.status).toBe(200);

      // 2. /streak vs /api/streak
      const streakRoot = await app.request(
        '/streak',
        { method: 'GET', headers: { Cookie: player.cookie } },
        env,
      );
      const streakApi = await app.request(
        '/api/streak',
        { method: 'GET', headers: { Cookie: player.cookie } },
        env,
      );
      expect(streakRoot.status).toBe(200);
      expect(streakApi.status).toBe(200);

      // 3. /missions/active vs /api/missions/active
      const missionsRoot = await app.request(
        '/missions/active',
        { method: 'GET', headers: { Cookie: player.cookie } },
        env,
      );
      const missionsApi = await app.request(
        '/api/missions/active',
        { method: 'GET', headers: { Cookie: player.cookie } },
        env,
      );
      expect(missionsRoot.status).toBe(200);
      expect(missionsApi.status).toBe(200);

      // 4. /referral/status vs /api/referral/status
      const referralRoot = await app.request(
        '/referral/status',
        { method: 'GET', headers: { Cookie: player.cookie } },
        env,
      );
      const referralApi = await app.request(
        '/api/referral/status',
        { method: 'GET', headers: { Cookie: player.cookie } },
        env,
      );
      expect(referralRoot.status).toBe(200);
      expect(referralApi.status).toBe(200);

      // 5. /economy/claim vs /api/economy/claim
      const claimRoot = await app.request(
        '/economy/claim',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: player.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ requestId: randomUUID() }),
        },
        env,
      );
      const claimApi = await app.request(
        '/api/economy/claim',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: player.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ requestId: randomUUID() }),
        },
        env,
      );
      expect(claimRoot.status).toBe(200);
      expect(claimApi.status).toBe(200);

      // 6. /economy/upgrade vs /api/economy/upgrade
      const upgradeRoot = await app.request(
        '/economy/upgrade',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: player.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            businessSlug: 'street_stand',
            requestId: randomUUID(),
          }),
        },
        env,
      );
      expect(upgradeRoot.status).toBe(200);

      // Now upgrade again under /api (which will return 400 INSUFFICIENT_CASH, proving endpoint is live)
      const upgradeApi = await app.request(
        '/api/economy/upgrade',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: player.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            businessSlug: 'street_stand',
            requestId: randomUUID(),
          }),
        },
        env,
      );
      expect(upgradeApi.status).toBe(400);
      const upgradeApiJson = (await upgradeApi.json()) as {
        error: { code: string };
      };
      expect(upgradeApiJson.error.code).toBe('INSUFFICIENT_CASH');
    });
  });
});
