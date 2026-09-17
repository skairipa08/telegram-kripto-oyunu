import { createHmac, randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Bindings } from '../auth/env';
import { createTestDatabase } from '../auth/test-db';
import { createApp } from '../index';
import { MemoryClanStore } from './store';

const now = Math.floor(Date.now() / 1000);
const origin = 'https://empire.example';
const env: Bindings = {
  TELEGRAM_BOT_TOKEN: '123456:test-clan-bot',
  SESSION_SECRET: 'test-only-session-secret-with-enough-entropy-for-clans',
  APP_ORIGIN: origin,
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-only-key',
  AUTH_RATE_LIMIT: { limit: async () => ({ success: true }) },
};

let database: Awaited<ReturnType<typeof createTestDatabase>>;
let app: ReturnType<typeof createApp>;
let testUser: { cookie: string; userId: string };
let clanStore: MemoryClanStore;

function initData(id: number, username: string) {
  const fields = {
    auth_date: String(now),
    query_id: `query-clan-${id}`,
    user: JSON.stringify({ id, first_name: `ClanUser${id}`, username }),
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

describe('Clan & Cartel API Routes Integration', () => {
  beforeAll(async () => {
    database = await createTestDatabase();
    clanStore = new MemoryClanStore(100000); // 100,000 cash

    app = createApp(
      {
        makeAuthStore: () => database.store,
        makeLeaderboardStore: () => database.leaderboardStore,
        makeClanStore: () => clanStore,
      },
      () => now,
    );

    // Login test user
    const res = await app.request(
      '/auth/telegram',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: origin,
        },
        body: JSON.stringify({
          initData: initData(901, 'BossB'),
          requestId: randomUUID(),
        }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { id: string } };
    testUser = {
      cookie: res.headers.get('set-cookie')!.split(';')[0]!,
      userId: body.user.id,
    };
    clanStore.setPlayerCash(testUser.userId, 100000);
  });

  it('GET /clans/leaderboard returns list of seeded clans and null userClanId when not joined', async () => {
    const res = await app.request(
      '/clans/leaderboard',
      {
        method: 'GET',
        headers: { Cookie: testUser.cookie },
      },
      env,
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      clans: Array<{ name: string; tag: string }>;
      userClanId: string | null;
    };
    expect(data.clans.length).toBeGreaterThanOrEqual(2);
    expect(data.clans[0]?.tag).toBe('ALPHA');
    expect(data.userClanId).toBeNull();
  });

  it('POST /clans/create creates a new cartel and deducts 50,000 cash', async () => {
    const res = await app.request(
      '/clans/create',
      {
        method: 'POST',
        headers: {
          Origin: origin,
          'Content-Type': 'application/json',
          Cookie: testUser.cookie,
        },
        body: JSON.stringify({
          name: 'Bosphorus Cartel',
          tag: 'BOSPH',
          emblem: '🦅',
          telegramChannelUrl: 'https://t.me/BosphorusCartel',
          requestId: randomUUID(),
        }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      clan: { name: string; tag: string };
      newCash: number;
    };
    expect(data.clan.name).toBe('Bosphorus Cartel');
    expect(data.clan.tag).toBe('BOSPH');
    expect(data.newCash).toBe(50000); // 100k - 50k
  });

  it('GET /clans/my returns current cartel after creation', async () => {
    const res = await app.request(
      '/clans/my',
      {
        method: 'GET',
        headers: { Cookie: testUser.cookie },
      },
      env,
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { clan: { name: string } };
    expect(data.clan.name).toBe('Bosphorus Cartel');
  });

  it('POST /clans/create rejects duplicate creation when already in a clan', async () => {
    const res = await app.request(
      '/clans/create',
      {
        method: 'POST',
        headers: {
          Origin: origin,
          'Content-Type': 'application/json',
          Cookie: testUser.cookie,
        },
        body: JSON.stringify({
          name: 'Another Cartel',
          tag: 'ANOTH',
          emblem: '👑',
          requestId: randomUUID(),
        }),
      },
      env,
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('ALREADY_IN_CLAN');
  });
});
