import { createHmac, createHash, randomUUID } from 'node:crypto';
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
    query_id: `query-arcade-${id}`,
    user: JSON.stringify({ id, first_name: `ArcadeUser${id}`, username }),
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

describe('Arcade Game Suite API Routes Integration', () => {
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
          initData: initData(88111, 'arcade_champion'),
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

  describe('Security & Authentication Enforcements', () => {
    it('rejects unauthenticated requests across all arcade endpoints with 401', async () => {
      const endpoints = [
        { path: '/arcade/tap/state', method: 'GET' },
        {
          path: '/arcade/tap/click',
          method: 'POST',
          body: { tapCount: 1, requestId: randomUUID() },
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
            claimMultiplier: 2.0,
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
      }
    });
  });

  describe('Notcoin Tap Endpoints', () => {
    it('GET /arcade/tap/state returns full initial tap state', async () => {
      const res = await app.request(
        '/arcade/tap/state',
        {
          headers: { Cookie: testUser.cookie },
        },
        env,
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.apiVersion).toBe('v1');
      expect(data.energy).toBe(1000);
      expect(data.maxEnergy).toBe(1000);
      expect(data.multitapLevel).toBe(1);
      expect(data.tapPower).toBe(1);
      expect(data.tapBotUnlocked).toBe(false);
    });

    it('POST /arcade/tap/click executes taps and consumes energy', async () => {
      const reqId = randomUUID();
      const res = await app.request(
        '/arcade/tap/click',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: testUser.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tapCount: 25,
            requestId: reqId,
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.apiVersion).toBe('v1');
      expect(data.tapsExecuted).toBe(25);
      expect(data.coinsEarned).toBeGreaterThanOrEqual(25);
      expect(data.remainingEnergy).toBe(975); // 1000 - 25

      // Idempotency check with same requestId
      const resDuplicate = await app.request(
        '/arcade/tap/click',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: testUser.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tapCount: 25,
            requestId: reqId,
          }),
        },
        env,
      );
      expect(resDuplicate.status).toBe(200);
      const dataDup = await resDuplicate.json();
      expect(dataDup.newCash).toBe(data.newCash);
    });

    it('POST /arcade/tap/upgrade upgrades multitap level using Cash', async () => {
      const res = await app.request(
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
            requestId: randomUUID(),
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.upgradeType).toBe('multitap');
      expect(data.newLevel).toBe(2);
      expect(data.cashCost).toBe(100);
    });

    it('POST /arcade/tap/claim-bot rejects when bot is not unlocked', async () => {
      const res = await app.request(
        '/arcade/tap/claim-bot',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: testUser.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requestId: randomUUID(),
          }),
        },
        env,
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('BOT_NOT_UNLOCKED');
    });
  });

  describe('Catizen Merge Endpoints', () => {
    it('GET /arcade/merge/state returns current board and passive generation rate', async () => {
      const res = await app.request(
        '/api/arcade/merge/state', // test /api prefix
        {
          headers: { Cookie: testUser.cookie },
        },
        env,
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.apiVersion).toBe('v1');
      expect(data.grid).toHaveLength(12);
      expect(data.grid[0]).toBe(1); // Slot 0 has Tier 1
      expect(data.passiveRatePerSecond).toBe(1);
    });

    it('POST /arcade/merge/action moves an emblem to an empty slot', async () => {
      const res = await app.request(
        '/arcade/merge/action',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: testUser.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sourceIndex: 0,
            targetIndex: 3,
            actionType: 'move',
            requestId: randomUUID(),
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.grid[0]).toBe(0);
      expect(data.grid[3]).toBe(1);
    });

    it('POST /arcade/merge/auto cleans and auto-merges the board', async () => {
      const res = await app.request(
        '/arcade/merge/auto',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: testUser.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            autoUnbox: true,
            requestId: randomUUID(),
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.apiVersion).toBe('v1');
      expect(Array.isArray(data.grid)).toBe(true);
      expect(data.grid).toHaveLength(12);
      expect(data.totalRewardCash).toBeGreaterThanOrEqual(0);
    });

    it('POST /arcade/merge/claim-passive claims passive income accumulated', async () => {
      const res = await app.request(
        '/arcade/merge/claim-passive',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: testUser.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requestId: randomUUID(),
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.apiVersion).toBe('v1');
      expect(data.claimedCash).toBeGreaterThanOrEqual(0);
      expect(data.newCash).toBeGreaterThan(0);
    });
  });

  describe('Crypto Candlestick Crash Endpoints', () => {
    it('POST /arcade/crash/start begins a round and returns commitment hash', async () => {
      const res = await app.request(
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
            clientSeed: 'player_custom_seed',
            requestId: randomUUID(),
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.apiVersion).toBe('v1');
      expect(data.roundId).toBeTruthy();
      expect(data.stake).toBe(100);
      expect(data.serverSeedHash).toHaveLength(64); // SHA-256 hash
    });

    it('POST /arcade/crash/cashout settles bet and proves fair serverSeed commitment', async () => {
      // 1. Start round
      const startRes = await app.request(
        '/arcade/crash/start',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: testUser.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            stake: 50,
            clientSeed: 'fairness_verification_seed',
            requestId: randomUUID(),
          }),
        },
        env,
      );
      const startData = await startRes.json();
      const roundId = startData.roundId;
      const initialHash = startData.serverSeedHash;

      // 2. Cashout at low multiplier 1.05x (almost always wins unless instant crash)
      const cashoutRes = await app.request(
        '/arcade/crash/cashout',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: testUser.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            roundId,
            claimMultiplier: 1.05,
            requestId: randomUUID(),
          }),
        },
        env,
      );

      expect(cashoutRes.status).toBe(200);
      const cashoutData = await cashoutRes.json();
      expect(['won', 'crashed']).toContain(cashoutData.status);
      expect(cashoutData.serverSeed).toBeTruthy();

      // 3. Provably Fair Proof: hash(serverSeed) === serverSeedHash commitment
      const verifiedHash = createHash('sha256')
        .update(cashoutData.serverSeed)
        .digest('hex');
      expect(verifiedHash).toBe(initialHash);
    });

    it('POST /arcade/crash/start rejects stake below minimum limit', async () => {
      const res = await app.request(
        '/arcade/crash/start',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: testUser.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            stake: 2, // min is 10
            requestId: randomUUID(),
          }),
        },
        env,
      );

      expect(res.status).toBe(400);
    });
  });

  describe('Dynasty Cipher Endpoints', () => {
    it('POST /arcade/cipher/submit submits completed round and awards combo rewards', async () => {
      const res = await app.request(
        '/arcade/cipher/submit',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: testUser.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            round: 2,
            combo: 3,
            completedSuccessfully: true,
            requestId: randomUUID(),
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.apiVersion).toBe('v1');
      expect(data.round).toBe(2);
      expect(data.combo).toBe(3);
      // (25 + 15 * 1) * 1.5 = 40 * 1.5 = 60
      expect(data.rewardCash).toBe(60);
      expect(data.newCash).toBeGreaterThanOrEqual(60);
    });

    it('POST /arcade/cipher/submit returns 0 reward when hack failed', async () => {
      const res = await app.request(
        '/arcade/cipher/submit',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Cookie: testUser.cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            round: 5,
            combo: 1,
            completedSuccessfully: false,
            requestId: randomUUID(),
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.rewardCash).toBe(0);
    });
  });
});
