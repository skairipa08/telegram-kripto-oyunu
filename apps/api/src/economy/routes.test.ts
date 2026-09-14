import { createHmac } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Bindings } from '../auth/env';
import { createTestDatabase } from '../auth/test-db';
import { createApp } from '../index';

const now = Math.floor(Date.now() / 1000);
const origin = 'https://empire.example';
const env: Bindings = {
  TELEGRAM_BOT_TOKEN: '123456:test-bot',
  SESSION_SECRET: 'test-only-session-secret-with-enough-entropy',
  APP_ORIGIN: origin,
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-only-key',
  AUTH_RATE_LIMIT: { limit: async () => ({ success: true }) },
};

let database: Awaited<ReturnType<typeof createTestDatabase>>;
let app: ReturnType<typeof createApp>;
let testUser: { cookie: string; userId: string };

function initData(id: number, username: string) {
  const fields = {
    auth_date: String(now),
    query_id: `query-econ-${id}`,
    user: JSON.stringify({ id, first_name: `EconUser${id}`, username }),
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

describe('Economy Starter Grants, Triggers & ROI API Routes', () => {
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

    // Authenticate test user
    const res = await app.request(
      '/auth/telegram',
      {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: initData(99001, 'starter_player'),
          requestId: '99999999-9999-4999-8999-999999999901',
        }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { id: string } };
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeTruthy();
    const cookie = setCookie!.split(';')[0]!;

    testUser = {
      cookie,
      userId: body.user.id,
    };
  });

  describe('Database Starter Grants Trigger (R1)', () => {
    it('automatically grants 100 starter cash upon user creation via trigger', async () => {
      const balanceRes = await database.db.query<{
        cash: number | string;
        season_points: number | string;
      }>(
        'select cash, season_points from public.player_balances where user_id = $1',
        [testUser.userId],
      );

      expect(balanceRes.rows).toHaveLength(1);
      expect(Number(balanceRes.rows[0]?.cash)).toBe(100);
      expect(Number(balanceRes.rows[0]?.season_points)).toBe(0);
    });

    it('automatically initializes all 6 canonical businesses at level 0 via trigger', async () => {
      const bizRes = await database.db.query<{ count: string | number }>(
        'select count(*) as count from public.player_businesses where user_id = $1 and level = 0',
        [testUser.userId],
      );

      expect(Number(bizRes.rows[0]?.count)).toBe(6);
    });

    it('records immutable starter_grant in the reward ledger', async () => {
      const ledgerRes = await database.db.query<{
        delta_cash: number | string;
        reason: string;
      }>(
        'select delta_cash, reason from public.reward_ledger where user_id = $1 and reason = $2',
        [testUser.userId, 'starter_grant'],
      );

      expect(ledgerRes.rows).toHaveLength(1);
      expect(Number(ledgerRes.rows[0]?.delta_cash)).toBe(100);
    });

    it('supports additive referral boost (+500 Cash) via empire_init_player_economy RPC', async () => {
      // Create second user
      const res2 = await app.request(
        '/auth/telegram',
        {
          method: 'POST',
          headers: { Origin: origin, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            initData: initData(99002, 'referred_player'),
            requestId: '99999999-9999-4999-8999-999999999902',
          }),
        },
        env,
      );

      const body2 = (await res2.json()) as { user: { id: string } };

      // Apply referral initialization
      const initRes = await database.economyStore.initPlayerEconomy(
        body2.user.id,
        true,
      );
      expect(initRes.success).toBe(true);
      expect(initRes.cash).toBe(600);

      const balanceRes = await database.db.query<{ cash: number | string }>(
        'select cash from public.player_balances where user_id = $1',
        [body2.user.id],
      );
      expect(Number(balanceRes.rows[0]?.cash)).toBe(600);
    });
  });

  describe('GET /economy/roi (R4)', () => {
    it('rejects unauthenticated requests with HTTP 401', async () => {
      const res = await app.request('/economy/roi', { method: 'GET' }, env);
      expect(res.status).toBe(401);

      const json = (await res.json()) as { error: { code: string } };
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 200 OK with business ROI calculations and optimal upgrade recommendation for authenticated user', async () => {
      const res = await app.request(
        '/economy/roi',
        {
          method: 'GET',
          headers: { Cookie: testUser.cookie },
        },
        env,
      );

      expect(res.status).toBe(200);
      const data = (await res.json()) as {
        apiVersion: string;
        currentCash: number;
        totalProductionPerSecond: number;
        optimalUpgrade: {
          slug: string;
          name: string;
          upgradeCost: number;
          paybackPeriodSeconds: number;
          isAffordable: boolean;
        } | null;
        businesses: Array<{
          slug: string;
          level: number;
          upgradeCost: number;
          paybackPeriodSeconds?: number;
        }>;
        multipliers: {
          offlineCapSeconds: number;
          hasConveniencePass: boolean;
        };
      };

      expect(data.apiVersion).toBe('v1');
      expect(data.currentCash).toBe(100);
      expect(data.totalProductionPerSecond).toBe(0);
      expect(data.businesses).toHaveLength(6);

      // Best recommendation for a new player with 100 Cash is Street Stand Level 1
      expect(data.optimalUpgrade).not.toBeNull();
      expect(data.optimalUpgrade?.slug).toBe('street_stand');
      expect(data.optimalUpgrade?.upgradeCost).toBe(100);
      expect(data.optimalUpgrade?.paybackPeriodSeconds).toBe(100);
      expect(data.optimalUpgrade?.isAffordable).toBe(true);

      // Multipliers check
      expect(data.multipliers.offlineCapSeconds).toBe(14400);
      expect(data.multipliers.hasConveniencePass).toBe(false);
    });
  });

  describe('GET /economy/simulation (R4)', () => {
    it('returns deterministic simulation projection for 24h default horizon', async () => {
      const res = await app.request(
        '/economy/simulation?duration=86400&strategy=greedy_roi',
        { method: 'GET' },
        env,
      );

      expect(res.status).toBe(200);
      const data = (await res.json()) as {
        apiVersion: string;
        durationSeconds: number;
        totalCashEarned: number;
        unlockedBusinessCount: number;
        conveniencePassImpact?: {
          efficiencyGainMultiplier: number;
        };
      };

      expect(data.apiVersion).toBe('v1');
      expect(data.durationSeconds).toBe(86400);
      expect(data.totalCashEarned).toBeGreaterThan(1000);
      expect(data.unlockedBusinessCount).toBe(6);
      expect(
        data.conveniencePassImpact?.efficiencyGainMultiplier,
      ).toBeGreaterThan(1.0);
    });

    it('rejects invalid duration values with HTTP 400', async () => {
      const res = await app.request(
        '/economy/simulation?duration=-500',
        { method: 'GET' },
        env,
      );

      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: { code: string } };
      expect(json.error.code).toBe('INVALID_DURATION');
    });
  });
});
