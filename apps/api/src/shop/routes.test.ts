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
    query_id: `query-shop-${id}`,
    user: JSON.stringify({ id, first_name: `ShopUser${id}`, username }),
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

describe('Shop & Monetization API Routes', () => {
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

    // Authenticate test user
    const res = await app.request(
      '/auth/telegram',
      {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: initData(201, 'shop_tester'),
          requestId: crypto.randomUUID(),
        }),
      },
      env,
    );
    const cookie = res.headers.get('set-cookie')?.split(';')[0];
    const body = (await res.json()) as { user: { id: string } };
    testUser = { cookie: cookie ?? '', userId: body.user.id };
  });

  it('rejects unauthenticated requests to shop catalog with 401', async () => {
    const res = await app.request('/shop', {}, env);
    expect(res.status).toBe(401);
  });

  it('returns shop catalog and convenience pass status with anti-P2W invariants', async () => {
    const res = await app.request(
      '/shop',
      { headers: { Cookie: testUser.cookie } },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      apiVersion: string;
      skus: Array<{ sku: string; starsPrice: number }>;
      pass: {
        isActive: boolean;
        offlineCapSeconds: number;
        seasonPointsMultiplier: number;
      };
    };

    expect(body.apiVersion).toBe('v1');
    expect(body.skus.length).toBeGreaterThanOrEqual(3);

    // Initial state: free pass tier
    expect(body.pass.isActive).toBe(false);
    expect(body.pass.offlineCapSeconds).toBe(14400); // 4 hours
    // Strict anti-P2W: seasonPointsMultiplier locked to 1.0
    expect(body.pass.seasonPointsMultiplier).toBe(1.0);
  });

  it('generates invoice for valid convenience pass SKU', async () => {
    const res = await app.request(
      '/shop/invoice',
      {
        method: 'POST',
        headers: {
          Cookie: testUser.cookie,
          Origin: origin,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sku: 'convenience_pass_30d',
          requestId: crypto.randomUUID(),
        }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      sku: string;
      starsPrice: number;
      invoicePayload: string;
      invoiceLink: string;
    };

    expect(body.sku).toBe('convenience_pass_30d');
    expect(body.starsPrice).toBe(250);
    expect(body.invoicePayload).toMatch(/^inv_/);
    expect(body.invoiceLink).toContain('https://t.me/$inv_');
  });

  it('strictly rejects forbidden P2W purchase attempts (anti-P2W guardrail)', async () => {
    const res = await app.request(
      '/shop/invoice',
      {
        method: 'POST',
        headers: {
          Cookie: testUser.cookie,
          Origin: origin,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sku: 'season_points_boost_1000',
          requestId: crypto.randomUUID(),
        }),
      },
      env,
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('FORBIDDEN_P2W_SKU');
  });

  it('validates Telegram pre_checkout_query currency', async () => {
    // Rejects non-XTR currency
    const invalidRes = await app.request(
      '/telegram/webhook',
      {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pre_checkout_query: {
            id: 'pcq_1',
            currency: 'USD',
            total_amount: 500,
            invoice_payload: 'test_payload',
          },
        }),
      },
      env,
    );
    const invalidBody = (await invalidRes.json()) as { ok: boolean };
    expect(invalidBody.ok).toBe(false);

    // Accepts XTR currency
    const validRes = await app.request(
      '/telegram/webhook',
      {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pre_checkout_query: {
            id: 'pcq_2',
            currency: 'XTR',
            total_amount: 250,
            invoice_payload: 'test_payload',
          },
        }),
      },
      env,
    );
    const validBody = (await validRes.json()) as { ok: boolean };
    expect(validBody.ok).toBe(true);
  });

  it('fulfills payment idempotently and extends convenience pass to 12h cap', async () => {
    // 1. Create an invoice to get a real invoicePayload
    const invRes = await app.request(
      '/shop/invoice',
      {
        method: 'POST',
        headers: {
          Cookie: testUser.cookie,
          Origin: origin,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sku: 'convenience_pass_30d',
          requestId: crypto.randomUUID(),
        }),
      },
      env,
    );
    const invData = (await invRes.json()) as { invoicePayload: string };

    const chargeId = `charge_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // 2. First delivery of successful_payment webhook
    const fulfillRes1 = await app.request(
      '/telegram/webhook',
      {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            successful_payment: {
              telegram_payment_charge_id: chargeId,
              invoice_payload: invData.invoicePayload,
              total_amount: 250,
            },
          },
        }),
      },
      env,
    );

    expect(fulfillRes1.status).toBe(200);
    const fulfill1 = (await fulfillRes1.json()) as {
      success: boolean;
      duplicate: boolean;
      newPassExpiresAt: string;
    };
    expect(fulfill1.success).toBe(true);
    expect(fulfill1.duplicate).toBe(false);
    expect(fulfill1.newPassExpiresAt).toBeDefined();

    // 3. Verify user's convenience pass is now active with 12h offline cap
    const shopRes = await app.request(
      '/shop',
      { headers: { Cookie: testUser.cookie } },
      env,
    );
    const shopBody = (await shopRes.json()) as {
      pass: {
        isActive: boolean;
        offlineCapSeconds: number;
        upgradeQueueSlots: number;
        seasonPointsMultiplier: number;
      };
    };
    expect(shopBody.pass.isActive).toBe(true);
    expect(shopBody.pass.offlineCapSeconds).toBe(43200); // 12 hours
    expect(shopBody.pass.upgradeQueueSlots).toBe(3);
    // Anti-P2W check: season points multiplier must remain exactly 1.0!
    expect(shopBody.pass.seasonPointsMultiplier).toBe(1.0);

    // 4. Duplicate delivery of the exact same webhook (Idempotency check)
    const fulfillRes2 = await app.request(
      '/telegram/webhook',
      {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            successful_payment: {
              telegram_payment_charge_id: chargeId,
              invoice_payload: invData.invoicePayload,
              total_amount: 250,
            },
          },
        }),
      },
      env,
    );

    expect(fulfillRes2.status).toBe(200);
    const fulfill2 = (await fulfillRes2.json()) as {
      success: boolean;
      duplicate: boolean;
      newPassExpiresAt: string;
    };
    expect(fulfill2.success).toBe(true);
    expect(fulfill2.duplicate).toBe(true); // Duplicate detected
    // Expiration date was NOT doubled
    expect(fulfill2.newPassExpiresAt).toBe(fulfill1.newPassExpiresAt);
  });
});
