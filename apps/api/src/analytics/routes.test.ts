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
    query_id: `query-analytics-${id}`,
    user: JSON.stringify({ id, first_name: `AnalyticsUser${id}`, username }),
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

describe('Analytics Pipeline & Cohort Metrics API Routes', () => {
  beforeAll(async () => {
    database = await createTestDatabase();
    app = createApp(
      {
        makeAuthStore: () => database.store,
        makeLeaderboardStore: () => database.leaderboardStore,
        makeShopStore: () => database.shopStore,
        makeConfigStore: () => database.configStore,
        makeAnalyticsStore: () => database.analyticsStore,
      },
      () => now,
    );

    const res = await app.request(
      '/auth/telegram',
      {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: initData(401, 'analytics_tester'),
          requestId: crypto.randomUUID(),
        }),
      },
      env,
    );
    const cookie = res.headers.get('set-cookie')?.split(';')[0];
    const body = (await res.json()) as { user: { id: string } };
    testUser = { cookie: cookie ?? '', userId: body.user.id };
  });

  it('ingests canonical events adhering to Blueprint Section 18 taxonomy', async () => {
    const res = await app.request(
      '/analytics/events',
      {
        method: 'POST',
        headers: {
          Cookie: testUser.cookie,
          Origin: origin,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          events: [
            {
              eventName: 'app_open',
              properties: { platform: 'ios', version: '1.0.0' },
            },
            {
              eventName: 'tutorial_complete',
              properties: { first_business: 'street_stand' },
            },
            {
              eventName: 'business_upgrade',
              properties: {
                business_slug: 'street_stand',
                new_level: 1,
                cost: 100,
              },
            },
          ],
        }),
      },
      env,
    );

    expect(res.status).toBe(202);
    const body = (await res.json()) as {
      apiVersion: string;
      acceptedCount: number;
    };
    expect(body.apiVersion).toBe('v1');
    expect(body.acceptedCount).toBe(3);

    // Verify events were stored in database
    const dbEvents = await database.db.query<{ count: string }>(
      `select count(*) as count from public.analytics_events where user_id = '${testUser.userId}'`,
    );
    expect(Number(dbEvents.rows[0]?.count)).toBeGreaterThanOrEqual(3);
  });

  it('rejects non-canonical analytics event names with 400 Bad Request', async () => {
    const res = await app.request(
      '/analytics/events',
      {
        method: 'POST',
        headers: {
          Cookie: testUser.cookie,
          Origin: origin,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          events: [
            {
              eventName: 'user_clicked_random_button', // not in Section 18 taxonomy
              properties: {},
            },
          ],
        }),
      },
      env,
    );

    expect(res.status).toBe(400);
  });

  it('computes cohort retention, activation rate, and monetization KPIs', async () => {
    // Add completed purchase for testUser to test payer conversion & ARPPU
    await database.db.exec(`
      insert into public.purchases (user_id, telegram_payment_charge_id, invoice_payload, sku, stars_amount, status)
      values ('${testUser.userId}', 'charge_analytics_test', 'inv_analytics_payload_123', 'convenience_pass_30d', 250, 'completed')
      on conflict do nothing;
    `);

    const res = await app.request(
      '/analytics/metrics',
      { headers: { Cookie: testUser.cookie } },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      apiVersion: string;
      activationRate: number;
      payerConversionRate: number;
      totalStarsRevenue: number;
      arppu: number;
      cohorts: Array<{
        cohortDate: string;
        totalSignups: number;
      }>;
    };

    expect(body.apiVersion).toBe('v1');
    expect(body.activationRate).toBeGreaterThanOrEqual(0);
    expect(body.payerConversionRate).toBeGreaterThan(0);
    expect(body.totalStarsRevenue).toBeGreaterThanOrEqual(250);
    expect(body.arppu).toBeGreaterThanOrEqual(250);
    expect(Array.isArray(body.cohorts)).toBe(true);
  });
});
