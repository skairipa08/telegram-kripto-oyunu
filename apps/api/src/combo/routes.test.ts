import { createHmac, randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { getDailyCombo, getDailyCipher } from '@empire/game-core';
import type { Bindings } from '../auth/env';
import { createTestDatabase } from '../auth/test-db';
import { createApp } from '../index';
import { MemoryComboStore } from './store';

const now = Math.floor(Date.now() / 1000);
const origin = 'https://empire.example';
const env: Bindings = {
  TELEGRAM_BOT_TOKEN: '123456:test-combo-bot',
  SESSION_SECRET: 'test-only-session-secret-with-enough-entropy-for-combo',
  APP_ORIGIN: origin,
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-only-key',
  AUTH_RATE_LIMIT: { limit: async () => ({ success: true }) },
};

let database: Awaited<ReturnType<typeof createTestDatabase>>;
let app: ReturnType<typeof createApp>;
let testUser: { cookie: string; userId: string };
let comboStore: MemoryComboStore;

function initData(id: number, username: string) {
  const fields = {
    auth_date: String(now),
    query_id: `query-combo-${id}`,
    user: JSON.stringify({ id, first_name: `ComboUser${id}`, username }),
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

describe('Daily Combo & Cipher API Routes Integration', () => {
  const testDate = '2026-09-16';

  beforeAll(async () => {
    database = await createTestDatabase();
    comboStore = new MemoryComboStore();

    app = createApp(
      {
        makeAuthStore: () => database.store,
        makeComboStore: () => comboStore,
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
          initData: initData(902, 'HunterA'),
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
    comboStore.setPlayerCash(testUser.userId, 10000);
  });

  it('GET /combo/status returns uncompleted status initially', async () => {
    const res = await app.request(
      `/combo/status?date=${testDate}`,
      {
        method: 'GET',
        headers: { Cookie: testUser.cookie },
      },
      env,
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      isCompleted: boolean;
      rewardCash: number;
    };
    expect(data.isCompleted).toBe(false);
    expect(data.rewardCash).toBe(250000);
  });

  it('POST /combo/claim rejects incorrect combinations with INCORRECT_COMBO', async () => {
    const res = await app.request(
      '/combo/claim',
      {
        method: 'POST',
        headers: {
          Origin: origin,
          'Content-Type': 'application/json',
          Cookie: testUser.cookie,
        },
        body: JSON.stringify({
          date: testDate,
          selectedSlugs: ['wrong_slug_1', 'wrong_slug_2', 'wrong_slug_3'],
          requestId: randomUUID(),
        }),
      },
      env,
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('INCORRECT_COMBO');
  });

  it('POST /combo/claim rewards 250,000 cash for correct combination', async () => {
    const { comboSlugs } = getDailyCombo(testDate);

    const res = await app.request(
      '/combo/claim',
      {
        method: 'POST',
        headers: {
          Origin: origin,
          'Content-Type': 'application/json',
          Cookie: testUser.cookie,
        },
        body: JSON.stringify({
          date: testDate,
          selectedSlugs: [comboSlugs[0], comboSlugs[1], comboSlugs[2]],
          requestId: randomUUID(),
        }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      success: boolean;
      rewardCash: number;
      newCash: number;
    };
    expect(data.success).toBe(true);
    expect(data.rewardCash).toBe(250000);
    expect(data.newCash).toBe(260000); // 10k + 250k
  });

  it('POST /combo/claim rejects duplicate claim on same date', async () => {
    const { comboSlugs } = getDailyCombo(testDate);

    const res = await app.request(
      '/combo/claim',
      {
        method: 'POST',
        headers: {
          Origin: origin,
          'Content-Type': 'application/json',
          Cookie: testUser.cookie,
        },
        body: JSON.stringify({
          date: testDate,
          selectedSlugs: [comboSlugs[0], comboSlugs[1], comboSlugs[2]],
          requestId: randomUUID(),
        }),
      },
      env,
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('ALREADY_CLAIMED');
  });

  it('POST /combo/cipher-claim verifies Morse word and awards 100,000 cash', async () => {
    const cipher = getDailyCipher(testDate);

    const res = await app.request(
      '/combo/cipher-claim',
      {
        method: 'POST',
        headers: {
          Origin: origin,
          'Content-Type': 'application/json',
          Cookie: testUser.cookie,
        },
        body: JSON.stringify({
          date: testDate,
          solvedWord: cipher.word.toLowerCase(),
          requestId: randomUUID(),
        }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { success: boolean; rewardCash: number };
    expect(data.success).toBe(true);
    expect(data.rewardCash).toBe(100000);
  });
});
