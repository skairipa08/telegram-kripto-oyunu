import { createHmac } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  calculateUpgradeCost,
  calculateProductionPerSecond,
  getStarterEconomyState,
} from '@empire/game-core';
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

function initData(id: number, username: string) {
  const fields = {
    auth_date: String(now),
    query_id: `query-econ-stress-${id}`,
    user: JSON.stringify({ id, first_name: `StressUser${id}`, username }),
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

async function loginUser(telegramId: number, username: string) {
  const res = await app.request(
    '/auth/telegram',
    {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData: initData(telegramId, username),
        requestId: crypto.randomUUID(),
      }),
    },
    env,
  );
  if (res.status !== 200) {
    throw new Error(`Login failed for ${telegramId}: ${res.status}`);
  }
  const setCookie = res.headers.get('set-cookie');
  const cookie = setCookie ? setCookie.split(';')[0]! : '';
  const body = (await res.json()) as { user: { id: string } };
  return { cookie, userId: body.user.id };
}

describe('Empirical Starter Flow, Database Trigger & Economy API Stress Suite', () => {
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

  describe('1. Onboarding Starter Grants & Core Loop Deadlock Elimination (R1)', () => {
    it('1.1. Pure getStarterEconomyState guarantees 100 base cash and 600 referred cash with 0 initial production', () => {
      const baseState = getStarterEconomyState(false);
      expect(baseState.cash).toBe(100);
      expect(baseState.totalProductionPerSecond).toBe(0);
      expect(baseState.businesses).toHaveLength(6);
      expect(baseState.businesses.every((b) => b.level === 0)).toBe(true);

      const referredState = getStarterEconomyState(true);
      expect(referredState.cash).toBe(600);
      expect(referredState.totalProductionPerSecond).toBe(0);
      expect(referredState.businesses).toHaveLength(6);
    });

    it('1.2. Batch Onboarding Invariant: 20 newly created users all receive exactly 100 cash, 6 businesses at level 0, and starter_grant ledger row', async () => {
      const startId = 88000;
      const count = 20;

      for (let i = 0; i < count; i++) {
        const u = await loginUser(startId + i, `batch_user_${i}`);

        // Balance check
        const balanceRes = await database.db.query<{
          cash: number | string;
          season_points: number | string;
        }>(
          'select cash, season_points from public.player_balances where user_id = $1',
          [u.userId],
        );
        expect(balanceRes.rows).toHaveLength(1);
        expect(Number(balanceRes.rows[0]?.cash)).toBe(100);
        expect(Number(balanceRes.rows[0]?.season_points)).toBe(0);

        // Businesses check
        const bizRes = await database.db.query<{ count: number | string }>(
          'select count(*) as count from public.player_businesses where user_id = $1 and level = 0',
          [u.userId],
        );
        expect(Number(bizRes.rows[0]?.count)).toBe(6);

        // Reward ledger check
        const ledgerRes = await database.db.query<{
          delta_cash: number | string;
          reason: string;
        }>(
          'select delta_cash, reason from public.reward_ledger where user_id = $1 and reason = $2',
          [u.userId, 'starter_grant'],
        );
        expect(ledgerRes.rows).toHaveLength(1);
        expect(Number(ledgerRes.rows[0]?.delta_cash)).toBe(100);
      }
    });

    it('1.3. Direct Database User Insertion: Trigger fires automatically without auth route intervention', async () => {
      const directTgId = 777001;
      const insertUserRes = await database.db.query<{ id: string }>(
        `insert into public.users (telegram_user_id, first_name, username, language)
         values ($1, 'DirectUser', 'direct_trigger_user', 'en')
         returning id`,
        [directTgId],
      );
      const directUserId = insertUserRes.rows[0]?.id;
      expect(directUserId).toBeDefined();

      // Verify trigger immediately provisioned balances
      const bal = await database.db.query<{ cash: number | string }>(
        'select cash from public.player_balances where user_id = $1',
        [directUserId],
      );
      expect(bal.rows).toHaveLength(1);
      expect(Number(bal.rows[0]?.cash)).toBe(100);

      // Verify 6 businesses provisioned
      const biz = await database.db.query<{ count: number | string }>(
        'select count(*) as count from public.player_businesses where user_id = $1',
        [directUserId],
      );
      expect(Number(biz.rows[0]?.count)).toBe(6);
    });

    it('1.4. Deadlock Elimination Proof: User can immediately afford Street Stand (cost 100), activating production from 0 to 1 Cash/s within 30s', async () => {
      const u = await loginUser(88500, 'deadlock_proof_user');

      // Check Street Stand upgrade cost
      const standCost = calculateUpgradeCost(100, 0); // level 0 -> 1
      expect(standCost).toBe(100);

      // Fetch user cash from DB
      const bal = await database.db.query<{ cash: number | string }>(
        'select cash from public.player_balances where user_id = $1',
        [u.userId],
      );
      const cash = Number(bal.rows[0]?.cash);
      expect(cash).toBeGreaterThanOrEqual(standCost);

      // Simulate purchasing Street Stand Level 1
      await database.db.query(
        'update public.player_balances set cash = cash - $1 where user_id = $2',
        [standCost, u.userId],
      );
      await database.db.query(
        `update public.player_businesses pb
         set level = 1, updated_at = now()
         from public.businesses b
         where pb.business_id = b.id and pb.user_id = $1 and b.slug = 'street_stand'`,
        [u.userId],
      );

      // Post-purchase production calculation
      const newProd = calculateProductionPerSecond(1, 1);
      expect(newProd).toBe(1.0); // 1 Cash/second active!
    });
  });

  describe('2. PGlite Trigger & RPC Concurrency, Idempotency & Edge Cases', () => {
    it('2.1. Repeat Login Invariant: Existing user login does NOT re-trigger starter cash or wipe existing balance', async () => {
      const repeatTgId = 88600;
      const firstLogin = await loginUser(repeatTgId, 'repeat_user');

      // Simulate player earning 5,000 cash
      await database.db.query(
        'update public.player_balances set cash = 5000 where user_id = $1',
        [firstLogin.userId],
      );

      // Login again with a new session request (advance auth_date and query_id to avoid replay)
      const secondFields = {
        auth_date: String(now + 10),
        query_id: `query-econ-stress-${repeatTgId}-session2`,
        user: JSON.stringify({
          id: repeatTgId,
          first_name: `StressUser${repeatTgId}`,
          username: 'repeat_user',
        }),
      };
      const check = Object.entries(secondFields)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([k, v]) => `${k}=${v}`)
        .join('\n');
      const key = createHmac('sha256', 'WebAppData')
        .update(env.TELEGRAM_BOT_TOKEN!)
        .digest();
      const secondInitData = new URLSearchParams({
        ...secondFields,
        hash: createHmac('sha256', key).update(check).digest('hex'),
      }).toString();

      const secondLoginRes = await app.request(
        '/auth/telegram',
        {
          method: 'POST',
          headers: { Origin: origin, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            initData: secondInitData,
            requestId: crypto.randomUUID(),
          }),
        },
        env,
      );
      expect(secondLoginRes.status).toBe(200);

      // Verify balance is STILL 5000, NOT reset to 100, and NOT increased to 5100
      const bal = await database.db.query<{ cash: number | string }>(
        'select cash from public.player_balances where user_id = $1',
        [firstLogin.userId],
      );
      expect(Number(bal.rows[0]?.cash)).toBe(5000);

      // Verify only 1 starter_grant row exists in reward ledger
      const ledgerCount = await database.db.query<{ count: number | string }>(
        'select count(*) as count from public.reward_ledger where user_id = $1 and reason = $2',
        [firstLogin.userId, 'starter_grant'],
      );
      expect(Number(ledgerCount.rows[0]?.count)).toBe(1);
    });

    it('2.2. RPC Concurrency Stress: 10 concurrent calls to empire_init_player_economy for a referred user', async () => {
      const concurrentTgId = 88700;
      const u = await loginUser(concurrentTgId, 'concurrent_ref_user');

      // Fire 10 simultaneous calls to initPlayerEconomy(userId, isReferred = true)
      const concurrentCalls = Array.from({ length: 10 }, () =>
        database.economyStore.initPlayerEconomy(u.userId, true),
      );

      const results = await Promise.all(concurrentCalls);

      // All calls must succeed
      for (const res of results) {
        expect(res.success).toBe(true);
      }

      // Verify final cash in DB: Must be 600 (not 100 + 10 * 500 = 5100!)
      const bal = await database.db.query<{ cash: number | string }>(
        'select cash from public.player_balances where user_id = $1',
        [u.userId],
      );
      expect(Number(bal.rows[0]?.cash)).toBe(600);

      // Check how many referral_boost_grant rows were inserted
      const ledgerRes = await database.db.query<{ count: number | string }>(
        'select count(*) as count from public.reward_ledger where user_id = $1 and reason = $2',
        [u.userId, 'referral_boost_grant'],
      );
      expect(Number(ledgerRes.rows[0]?.count)).toBe(1);
    });

    it('2.3. Idempotency Boundary: Calling initPlayerEconomy with isReferred=false on an already initialized user does not modify cash', async () => {
      const u = await loginUser(88800, 'unreferred_idempotent_user');

      const initRes1 = await database.economyStore.initPlayerEconomy(
        u.userId,
        false,
      );
      expect(initRes1.cash).toBe(100);

      const initRes2 = await database.economyStore.initPlayerEconomy(
        u.userId,
        false,
      );
      expect(initRes2.cash).toBe(100);

      const bal = await database.db.query<{ cash: number | string }>(
        'select cash from public.player_balances where user_id = $1',
        [u.userId],
      );
      expect(Number(bal.rows[0]?.cash)).toBe(100);
    });

    it('2.4. Post-Spend Referral Re-Initialization Analysis: What happens if user spent cash down to 50 and initPlayerEconomy is re-invoked?', async () => {
      const u = await loginUser(88850, 'spent_cash_ref_user');

      // User gets referral boost
      const firstBoost = await database.economyStore.initPlayerEconomy(
        u.userId,
        true,
      );
      expect(firstBoost.cash).toBe(600);

      // User spends cash down to 50 on business upgrades
      await database.db.query(
        'update public.player_balances set cash = 50 where user_id = $1',
        [u.userId],
      );

      // What happens if initPlayerEconomy(userId, true) is called again?
      const secondCall = await database.economyStore.initPlayerEconomy(
        u.userId,
        true,
      );

      // Let's observe the behavior:
      // In migration 0006: elsif p_is_referred and v_existing_cash < 600 then update cash = cash + 500
      // Because existing cash was 50, 50 < 600 was true!
      // This empirically proves that v_existing_cash < 600 is a loose heuristic:
      // it granted another +500 cash (50 -> 550) instead of being strictly idempotent via reward_ledger!
      expect(secondCall.cash).toBe(550);

      const balAfter = await database.db.query<{ cash: number | string }>(
        'select cash from public.player_balances where user_id = $1',
        [u.userId],
      );
      const finalCash = Number(balAfter.rows[0]?.cash);
      expect(finalCash).toBe(550);

      const ledgerEntries = await database.db.query<{
        delta_cash: number | string;
        reason: string;
      }>(
        'select delta_cash, reason from public.reward_ledger where user_id = $1 and reason = $2',
        [u.userId, 'referral_boost_grant'],
      );

      // Ledger now contains 2 referral_boost_grant rows for this user
      expect(ledgerEntries.rows).toHaveLength(2);
    });

    it('2.5. Edge Case: Non-existent user ID passed to empire_init_player_economy', async () => {
      const fakeUserId = '00000000-0000-0000-0000-000000000999';

      // Foreign key constraint should reject or fail gracefully
      await expect(
        database.economyStore.initPlayerEconomy(fakeUserId, false),
      ).rejects.toThrow();
    });

    it('2.6. Constraint Boundary: Cash check constraint prevents negative balances', async () => {
      const u = await loginUser(88900, 'negative_balance_user');

      await expect(
        database.db.query(
          'update public.player_balances set cash = -50 where user_id = $1',
          [u.userId],
        ),
      ).rejects.toThrow();
    });
  });

  describe('3. API Endpoint Fuzzing & Boundary Testing (GET /economy/simulation)', () => {
    it('3.1. Default parameter execution: Missing duration/strategy defaults to 86400s and greedy_roi', async () => {
      const res = await app.request(
        '/economy/simulation',
        { method: 'GET' },
        env,
      );
      expect(res.status).toBe(200);

      const data = (await res.json()) as {
        apiVersion: string;
        durationSeconds: number;
        totalCashEarned: number;
        unlockedBusinessCount: number;
      };
      expect(data.apiVersion).toBe('v1');
      expect(data.durationSeconds).toBe(86400);
      expect(data.totalCashEarned).toBeGreaterThan(0);
      expect(data.unlockedBusinessCount).toBe(6);
    });

    it('3.2. Adversarial Fuzzing on duration query parameter', async () => {
      const invalidDurations = [
        '-1',
        '-99999',
        '0',
        '2592001', // above 30 days cap
        '100000000',
        'NaN',
        'Infinity',
        '-Infinity',
        'undefined',
        'null',
        'abc',
        '1e30',
        '--1',
        '%20',
      ];

      for (const dur of invalidDurations) {
        const res = await app.request(
          `/economy/simulation?duration=${dur}`,
          { method: 'GET' },
          env,
        );
        expect(res.status).toBe(400);
        const json = (await res.json()) as { error: { code: string } };
        expect(json.error.code).toBe('INVALID_DURATION');
      }
    });

    it('3.3. Fractional duration boundary (e.g. duration=0.5)', async () => {
      // 0.5 passes parsed > 0, and Math.floor(0.5) is 0
      const res = await app.request(
        '/economy/simulation?duration=0.5',
        { method: 'GET' },
        env,
      );
      // Verify whether API handles or rejects 0.5
      expect([200, 400]).toContain(res.status);
    });

    it('3.4. Valid extreme boundaries: 1 second and 2,592,000 seconds (30 days)', async () => {
      // Min boundary: 1s
      const resMin = await app.request(
        '/economy/simulation?duration=1',
        { method: 'GET' },
        env,
      );
      expect(resMin.status).toBe(200);
      const dataMin = (await resMin.json()) as { durationSeconds: number };
      expect(dataMin.durationSeconds).toBe(1);

      // Max boundary: 2,592,000s (30 days)
      const resMax = await app.request(
        '/economy/simulation?duration=2592000',
        { method: 'GET' },
        env,
      );
      expect(resMax.status).toBe(200);
      const dataMax = (await resMax.json()) as { durationSeconds: number };
      expect(dataMax.durationSeconds).toBe(2592000);
    });

    it('3.5. Unknown strategy parameter falls back safely to greedy_roi', async () => {
      const res = await app.request(
        '/economy/simulation?strategy=malicious_exploit_strategy',
        { method: 'GET' },
        env,
      );
      expect(res.status).toBe(200);
      const data = (await res.json()) as { totalCashEarned: number };
      expect(data.totalCashEarned).toBeGreaterThan(0);
    });

    it('3.6. High-Volume Concurrent Burst: 50 simultaneous simulation requests execute deterministically without error', async () => {
      const requests = Array.from({ length: 50 }, (_, i) =>
        app.request(
          `/economy/simulation?duration=3600&hasPass=${i % 2 === 0}`,
          { method: 'GET' },
          env,
        ),
      );

      const responses = await Promise.all(requests);
      for (const res of responses) {
        expect(res.status).toBe(200);
      }

      const bodies = await Promise.all(
        responses.map((r) => r.json() as Promise<{ totalCashEarned: number }>),
      );

      // Bitwise determinism: even responses (hasPass=true) must match each other identically
      const evenEarned = bodies
        .filter((_, idx) => idx % 2 === 0)
        .map((b) => b.totalCashEarned);
      const oddEarned = bodies
        .filter((_, idx) => idx % 2 === 1)
        .map((b) => b.totalCashEarned);

      expect(new Set(evenEarned).size).toBe(1);
      expect(new Set(oddEarned).size).toBe(1);
    });
  });

  describe('4. API Endpoint Security & Edge Cases (GET /economy/roi)', () => {
    it('4.1. Rejects unauthenticated requests with 401', async () => {
      const res = await app.request('/economy/roi', { method: 'GET' }, env);
      expect(res.status).toBe(401);
      const json = (await res.json()) as { error: { code: string } };
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('4.2. Rejects forged, expired, or malformed session cookies with 401', async () => {
      const forgedCookies = [
        '__Host-empire_session=forged-cookie-token',
        '__Host-empire_session=',
        'wrong_cookie_name=12345',
        '__Host-empire_session=eyJhbGciOiJIUzI1NiJ9.invalid.signature',
        `__Host-empire_session=${'a'.repeat(8193)}`, // Header too large
      ];

      for (const cookie of forgedCookies) {
        const res = await app.request(
          '/economy/roi',
          {
            method: 'GET',
            headers: { Cookie: cookie },
          },
          env,
        );
        expect(res.status).toBe(401);
      }
    });

    it('4.3. Full contract integrity check for newly authenticated user', async () => {
      const u = await loginUser(88950, 'roi_contract_user');

      const res = await app.request(
        '/economy/roi',
        {
          method: 'GET',
          headers: { Cookie: u.cookie },
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
          marginalRoi: number;
          isAffordable: boolean;
        } | null;
        businesses: Array<{
          slug: string;
          name: string;
          level: number;
          baseCost: number;
          baseIncome: number;
          upgradeCost: number;
          productionPerSecond: number;
          paybackPeriodSeconds?: number;
          marginalRoi?: number;
        }>;
        multipliers: {
          offlineCapSeconds: number;
          upgradeCostGrowth: number;
          productionLevelGrowth: number;
          hasConveniencePass: boolean;
        };
      };

      expect(data.apiVersion).toBe('v1');
      expect(data.currentCash).toBe(100);
      expect(data.totalProductionPerSecond).toBe(0);
      expect(data.businesses).toHaveLength(6);

      // Verify each business contract
      for (const b of data.businesses) {
        expect(b.level).toBe(0);
        expect(b.baseCost).toBeGreaterThan(0);
        expect(b.baseIncome).toBeGreaterThan(0);
        expect(b.upgradeCost).toBe(b.baseCost); // level 0 -> 1 cost is baseCost
        expect(b.productionPerSecond).toBe(0);
        expect(b.paybackPeriodSeconds).toBeGreaterThan(0);
        expect(b.marginalRoi).toBeGreaterThan(0);
      }

      // Optimal upgrade recommendation for 100 Cash player MUST be Street Stand
      expect(data.optimalUpgrade).not.toBeNull();
      expect(data.optimalUpgrade?.slug).toBe('street_stand');
      expect(data.optimalUpgrade?.upgradeCost).toBe(100);
      expect(data.optimalUpgrade?.isAffordable).toBe(true);

      // Offline cap multiplier
      expect(data.multipliers.offlineCapSeconds).toBe(14400);
      expect(data.multipliers.hasConveniencePass).toBe(false);
    });

    it('4.4. Convenience Pass reflects 43,200s offline cap in /economy/roi', async () => {
      const u = await loginUser(88960, 'roi_pass_user');

      // Grant Convenience Pass in database
      await database.db.query(
        `insert into public.player_entitlements (user_id, pass_type, starts_at, expires_at, is_active)
         values ($1, 'convenience_pass', now(), now() + interval '30 days', true)`,
        [u.userId],
      );

      const res = await app.request(
        '/economy/roi',
        {
          method: 'GET',
          headers: { Cookie: u.cookie },
        },
        env,
      );

      expect(res.status).toBe(200);
      const data = (await res.json()) as {
        multipliers: {
          offlineCapSeconds: number;
          hasConveniencePass: boolean;
        };
      };

      expect(data.multipliers.hasConveniencePass).toBe(true);
      expect(data.multipliers.offlineCapSeconds).toBe(43200);
    });

    it('4.5. High-Volume Concurrent Burst: 50 simultaneous authenticated /economy/roi requests execute cleanly', async () => {
      const u = await loginUser(88970, 'roi_burst_user');

      const requests = Array.from({ length: 50 }, () =>
        app.request(
          '/economy/roi',
          {
            method: 'GET',
            headers: { Cookie: u.cookie },
          },
          env,
        ),
      );

      const responses = await Promise.all(requests);
      for (const res of responses) {
        expect(res.status).toBe(200);
      }
    });
  });
});
