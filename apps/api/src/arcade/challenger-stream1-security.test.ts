import { createHmac, randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Bindings } from '../auth/env';
import { createTestDatabase } from '../auth/test-db';
import { createApp } from '../index';
import { MemoryArcadeStore } from './store';

const now = Math.floor(Date.now() / 1000);
const origin = 'https://empire.example';
const env: Bindings = {
  TELEGRAM_BOT_TOKEN: '123456:test-arcade-bot',
  SESSION_SECRET: 'test-only-session-secret-with-enough-entropy-for-arcade',
  APP_ORIGIN: origin,
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-only-key',
  AUTH_RATE_LIMIT: { limit: async () => ({ success: true }) },
};

let database: Awaited<ReturnType<typeof createTestDatabase>>;
let app: ReturnType<typeof createApp>;
let testUser: { cookie: string; userId: string };
let arcadeStore: MemoryArcadeStore;

function initData(id: number, username: string) {
  const fields = {
    auth_date: String(now),
    query_id: `query-challenger-${id}`,
    user: JSON.stringify({ id, first_name: `Challenger${id}`, username }),
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

describe('CHALLENGER API SECURITY & IDEMPOTENCY - STREAM 1', () => {
  beforeAll(async () => {
    database = await createTestDatabase();
    arcadeStore = new MemoryArcadeStore();

    app = createApp(
      {
        makeAuthStore: () => database.store,
        makeLeaderboardStore: () => database.leaderboardStore,
        makeShopStore: () => database.shopStore,
        makeConfigStore: () => database.configStore,
        makeAnalyticsStore: () => database.analyticsStore,
        makeEconomyStore: () => database.economyStore,
        makeArcadeStore: () => arcadeStore,
      },
      () => now,
    );

    // Authenticate test player
    const res = await app.request(
      '/auth/telegram',
      {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: initData(99331, 'challenger_tester'),
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

    testUser = {
      cookie,
      userId: body.user.id,
    };
  });

  // ==========================================================================
  // Vector 4.1: 401 Unauthorized for Unauthenticated Requests on ALL 11 Endpoints
  // ==========================================================================
  describe('Vector 4.1: 401 Unauthorized for unauthenticated requests on all 11 endpoints', () => {
    const endpoints = [
      { path: '/arcade/tap/state', method: 'GET' },
      {
        path: '/arcade/tap/click',
        method: 'POST',
        body: { tapCount: 5, requestId: randomUUID() },
      },
      {
        path: '/arcade/tap/upgrade',
        method: 'POST',
        body: {
          upgradeType: 'multitap',
          currency: 'cash',
          requestId: randomUUID(),
        },
      },
      {
        path: '/arcade/tap/claim-bot',
        method: 'POST',
        body: { requestId: randomUUID() },
      },
      { path: '/arcade/merge/state', method: 'GET' },
      {
        path: '/arcade/merge/action',
        method: 'POST',
        body: {
          sourceIndex: 0,
          targetIndex: 1,
          actionType: 'move',
          requestId: randomUUID(),
        },
      },
      {
        path: '/arcade/merge/auto',
        method: 'POST',
        body: { autoUnbox: true, requestId: randomUUID() },
      },
      {
        path: '/arcade/merge/claim-passive',
        method: 'POST',
        body: { requestId: randomUUID() },
      },
      {
        path: '/arcade/crash/start',
        method: 'POST',
        body: { stake: 50, requestId: randomUUID() },
      },
      {
        path: '/arcade/crash/cashout',
        method: 'POST',
        body: {
          roundId: randomUUID(),
          claimMultiplier: 1.5,
          requestId: randomUUID(),
        },
      },
      {
        path: '/arcade/cipher/submit',
        method: 'POST',
        body: {
          round: 1,
          combo: 1,
          completedSuccessfully: true,
          requestId: randomUUID(),
        },
      },
    ];

    it('rejects all 11 endpoints at root /arcade/* without auth', async () => {
      for (const ep of endpoints) {
        const res = await app.request(
          ep.path,
          {
            method: ep.method,
            headers: { Origin: origin, 'Content-Type': 'application/json' },
            ...(ep.body ? { body: JSON.stringify(ep.body) } : {}),
          },
          env,
        );
        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('rejects all 11 endpoints under /api/arcade/* prefix without auth', async () => {
      for (const ep of endpoints) {
        const res = await app.request(
          `/api${ep.path}`,
          {
            method: ep.method,
            headers: { Origin: origin, 'Content-Type': 'application/json' },
            ...(ep.body ? { body: JSON.stringify(ep.body) } : {}),
          },
          env,
        );
        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data.error.code).toBe('UNAUTHORIZED');
      }
    });
  });

  // ==========================================================================
  // Vector 4.2: Idempotency Across All Mutating Arcade Endpoints
  // ==========================================================================
  describe('Vector 4.2: Idempotency deduplication prevents double deductions/credits', () => {
    it('tap/click idempotency: repeated requestId returns identical response without double earnings or double energy depletion', async () => {
      const clickReqId = randomUUID();

      // First call
      const res1 = await app.request(
        '/arcade/tap/click',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: testUser.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ tapCount: 20, requestId: clickReqId }),
        },
        env,
      );
      expect(res1.status).toBe(200);
      const data1 = await res1.json();

      // Second call with IDENTICAL requestId
      const res2 = await app.request(
        '/arcade/tap/click',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: testUser.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ tapCount: 20, requestId: clickReqId }),
        },
        env,
      );
      expect(res2.status).toBe(200);
      const data2 = await res2.json();

      // Assert identical payload
      expect(data2).toEqual(data1);
      expect(data2.newCash).toBe(data1.newCash);
      expect(data2.remainingEnergy).toBe(data1.remainingEnergy);
    });

    it('tap/upgrade idempotency: repeated requestId does not deduct cash twice or increment level twice', async () => {
      const upgradeReqId = randomUUID();

      // First call
      const res1 = await app.request(
        '/arcade/tap/upgrade',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: testUser.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            upgradeType: 'multitap',
            currency: 'cash',
            requestId: upgradeReqId,
          }),
        },
        env,
      );
      expect(res1.status).toBe(200);
      const data1 = await res1.json();

      // Second call with IDENTICAL requestId
      const res2 = await app.request(
        '/arcade/tap/upgrade',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: testUser.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            upgradeType: 'multitap',
            currency: 'cash',
            requestId: upgradeReqId,
          }),
        },
        env,
      );
      expect(res2.status).toBe(200);
      const data2 = await res2.json();

      expect(data2).toEqual(data1);
      expect(data2.newLevel).toBe(data1.newLevel);
      expect(data2.newCash).toBe(data1.newCash);
    });

    it('merge/auto idempotency: repeated requestId returns identical response without double reward', async () => {
      const autoReqId = randomUUID();

      const res1 = await app.request(
        '/arcade/merge/auto',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: testUser.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ autoUnbox: true, requestId: autoReqId }),
        },
        env,
      );
      expect(res1.status).toBe(200);
      const data1 = await res1.json();

      const res2 = await app.request(
        '/arcade/merge/auto',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: testUser.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ autoUnbox: true, requestId: autoReqId }),
        },
        env,
      );
      expect(res2.status).toBe(200);
      const data2 = await res2.json();

      expect(data2).toEqual(data1);
      expect(data2.newCash).toBe(data1.newCash);
      expect(data2.grid).toEqual(data1.grid);
    });

    it('merge/claim-passive idempotency: repeated requestId returns identical claimed amount without duplicate credit', async () => {
      const claimPassiveReqId = randomUUID();

      const res1 = await app.request(
        '/arcade/merge/claim-passive',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: testUser.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ requestId: claimPassiveReqId }),
        },
        env,
      );
      expect(res1.status).toBe(200);
      const data1 = await res1.json();

      const res2 = await app.request(
        '/arcade/merge/claim-passive',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: testUser.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ requestId: claimPassiveReqId }),
        },
        env,
      );
      expect(res2.status).toBe(200);
      const data2 = await res2.json();

      expect(data2).toEqual(data1);
      expect(data2.claimedCash).toBe(data1.claimedCash);
      expect(data2.newCash).toBe(data1.newCash);
    });

    it('crash/start & crash/cashout idempotency: prevents double bet deduction and double payout crediting', async () => {
      const startReqId = randomUUID();

      // 1. Crash Start (deducts stake)
      const resStart1 = await app.request(
        '/arcade/crash/start',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: testUser.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            stake: 100,
            clientSeed: 'idempotency_seed',
            requestId: startReqId,
          }),
        },
        env,
      );
      expect(resStart1.status).toBe(200);
      const dataStart1 = await resStart1.json();

      // Duplicate crash start with same requestId
      const resStart2 = await app.request(
        '/arcade/crash/start',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: testUser.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            stake: 100,
            clientSeed: 'idempotency_seed',
            requestId: startReqId,
          }),
        },
        env,
      );
      expect(resStart2.status).toBe(200);
      const dataStart2 = await resStart2.json();

      expect(dataStart2).toEqual(dataStart1);
      expect(dataStart2.roundId).toBe(dataStart1.roundId);

      // 2. Crash Cashout (credits winnings if won)
      const cashoutReqId = randomUUID();
      const resCashout1 = await app.request(
        '/arcade/crash/cashout',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: testUser.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            roundId: dataStart1.roundId,
            claimMultiplier: 1.05,
            requestId: cashoutReqId,
          }),
        },
        env,
      );
      expect(resCashout1.status).toBe(200);
      const dataCashout1 = await resCashout1.json();

      // Duplicate cashout with same requestId
      const resCashout2 = await app.request(
        '/arcade/crash/cashout',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: testUser.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            roundId: dataStart1.roundId,
            claimMultiplier: 1.05,
            requestId: cashoutReqId,
          }),
        },
        env,
      );
      expect(resCashout2.status).toBe(200);
      const dataCashout2 = await resCashout2.json();

      expect(dataCashout2).toEqual(dataCashout1);
      expect(dataCashout2.newCash).toBe(dataCashout1.newCash);
      expect(dataCashout2.payoutCash).toBe(dataCashout1.payoutCash);
    });

    it('cipher/submit idempotency: repeated requestId returns identical response without double crediting', async () => {
      const cipherReqId = randomUUID();

      const res1 = await app.request(
        '/arcade/cipher/submit',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: testUser.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            round: 3,
            combo: 2,
            completedSuccessfully: true,
            requestId: cipherReqId,
          }),
        },
        env,
      );
      expect(res1.status).toBe(200);
      const data1 = await res1.json();

      const res2 = await app.request(
        '/arcade/cipher/submit',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: testUser.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            round: 3,
            combo: 2,
            completedSuccessfully: true,
            requestId: cipherReqId,
          }),
        },
        env,
      );
      expect(res2.status).toBe(200);
      const data2 = await res2.json();

      expect(data2).toEqual(data1);
      expect(data2.rewardCash).toBe(data1.rewardCash);
      expect(data2.newCash).toBe(data1.newCash);
    });
  });
});
