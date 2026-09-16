import { createHash, createHmac } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { invoiceStatusResponseSchema } from '@empire/shared';
import type { Bindings } from '../auth/env';
import { createTestDatabase } from '../auth/test-db';
import { createApp } from '../index';
import { createTestShopStore } from './test-helper';

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
        makeShopStore: () => createTestShopStore(database),
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

  it('validates Telegram pre_checkout_query with currency, amount and pending invoice existence', async () => {
    // 1. Create a real invoice
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
    expect(invRes.status).toBe(200);
    const inv = (await invRes.json()) as {
      invoicePayload: string;
      starsPrice: number;
    };

    // 2. Rejects non-XTR currency
    const invalidCurrencyRes = await app.request(
      '/telegram/webhook',
      {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pre_checkout_query: {
            id: 'pcq_currency_err',
            currency: 'USD',
            total_amount: inv.starsPrice,
            invoice_payload: inv.invoicePayload,
          },
        }),
      },
      env,
    );
    const invalidCurrencyBody = (await invalidCurrencyRes.json()) as {
      ok: boolean;
      error_message: string;
    };
    expect(invalidCurrencyBody.ok).toBe(false);
    expect(invalidCurrencyBody.error_message).toContain('XTR');

    // 3. Rejects non-existent invoice payload
    const invalidPayloadRes = await app.request(
      '/telegram/webhook',
      {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pre_checkout_query: {
            id: 'pcq_not_found',
            currency: 'XTR',
            total_amount: 250,
            invoice_payload: 'inv_non_existent_fake_order_12345',
          },
        }),
      },
      env,
    );
    const invalidPayloadBody = (await invalidPayloadRes.json()) as {
      ok: boolean;
      error_message: string;
    };
    expect(invalidPayloadBody.ok).toBe(false);
    expect(invalidPayloadBody.error_message).toContain('Invoice not found');

    // 4. Rejects amount mismatch
    const mismatchAmountRes = await app.request(
      '/telegram/webhook',
      {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pre_checkout_query: {
            id: 'pcq_mismatch',
            currency: 'XTR',
            total_amount: 9999,
            invoice_payload: inv.invoicePayload,
          },
        }),
      },
      env,
    );
    const mismatchAmountBody = (await mismatchAmountRes.json()) as {
      ok: boolean;
      error_message: string;
    };
    expect(mismatchAmountBody.ok).toBe(false);
    expect(mismatchAmountBody.error_message).toContain('Amount mismatch');

    // 5. Accepts valid pre_checkout_query for pending invoice
    const validRes = await app.request(
      '/telegram/webhook',
      {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pre_checkout_query: {
            id: 'pcq_valid',
            currency: 'XTR',
            total_amount: inv.starsPrice,
            invoice_payload: inv.invoicePayload,
          },
        }),
      },
      env,
    );
    const validBody = (await validRes.json()) as { ok: boolean };
    expect(validBody.ok).toBe(true);
  });

  it('fulfills payment idempotently, extends convenience pass, and records reward ledger', async () => {
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

    // 4. Invariant assertion: public.reward_ledger has exactly ONE stars_purchase row
    const ledgerRows = await database.db.query<{
      user_id: string;
      delta_cash: number;
      delta_season_points: number;
      reason: string;
      idempotency_key: string;
      metadata: Record<string, unknown>;
    }>(
      `select * from public.reward_ledger where user_id = $1 and reason = 'stars_purchase'`,
      [testUser.userId],
    );
    expect(ledgerRows.rows.length).toBe(1);
    const ledger = ledgerRows.rows[0]!;
    expect(Number(ledger.delta_cash)).toBe(0);
    expect(Number(ledger.delta_season_points)).toBe(0);
    expect(ledger.reason).toBe('stars_purchase');
    expect(ledger.idempotency_key).toBe(
      createHash('sha256').update(chargeId).digest('hex').toLowerCase(),
    );
    expect(ledger.idempotency_key).toMatch(/^[a-f0-9]{64}$/);

    // 5. Duplicate delivery of the exact same webhook (Idempotency check)
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

    // Invariant assertion: public.reward_ledger STILL has exactly ONE stars_purchase row (no double-credit)
    const ledgerRowsAfterDup = await database.db.query(
      `select * from public.reward_ledger where user_id = $1 and reason = 'stars_purchase'`,
      [testUser.userId],
    );
    expect(ledgerRowsAfterDup.rows.length).toBe(1);

    // Pre-checkout query for this fulfilled invoice is now rejected (no longer pending)
    const pcqFulfilledRes = await app.request(
      '/telegram/webhook',
      {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pre_checkout_query: {
            id: 'pcq_already_done',
            currency: 'XTR',
            total_amount: 250,
            invoice_payload: invData.invoicePayload,
          },
        }),
      },
      env,
    );
    const pcqFulfilledBody = (await pcqFulfilledRes.json()) as {
      ok: boolean;
      error_message: string;
    };
    expect(pcqFulfilledBody.ok).toBe(false);
    expect(pcqFulfilledBody.error_message).toContain('no longer pending');
  });

  it('validates X-Telegram-Bot-Api-Secret-Token when TELEGRAM_WEBHOOK_SECRET is configured', async () => {
    const webhookEnv: Bindings = {
      ...env,
      TELEGRAM_WEBHOOK_SECRET: 'test-secret-token-12345',
    };

    // 1. Missing secret token header -> 401 Unauthorized
    const resNoToken = await app.request(
      '/telegram/webhook',
      {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
      webhookEnv,
    );
    expect(resNoToken.status).toBe(401);

    // 2. Incorrect secret token header -> 401 Unauthorized
    const resBadToken = await app.request(
      '/telegram/webhook',
      {
        method: 'POST',
        headers: {
          Origin: origin,
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': 'wrong-secret-token',
        },
        body: JSON.stringify({}),
      },
      webhookEnv,
    );
    expect(resBadToken.status).toBe(401);

    // 3. Valid secret token header on /telegram/webhook -> accepted
    const resValidTelegram = await app.request(
      '/telegram/webhook',
      {
        method: 'POST',
        headers: {
          Origin: origin,
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': 'test-secret-token-12345',
        },
        body: JSON.stringify({
          message: { chat: { id: 123 }, text: '/help' },
        }),
      },
      webhookEnv,
    );
    expect(resValidTelegram.status).toBe(200);

    // 4. Valid secret token header on /shop/webhook alias -> accepted
    const resValidShop = await app.request(
      '/shop/webhook',
      {
        method: 'POST',
        headers: {
          Origin: origin,
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': 'test-secret-token-12345',
        },
        body: JSON.stringify({
          message: { chat: { id: 123 }, text: '/help' },
        }),
      },
      webhookEnv,
    );
    expect(resValidShop.status).toBe(200);
  });

  it('enforces authentication and ownership on GET /shop/invoices/:id', async () => {
    // 1. Unauthenticated request -> 401
    const unauthRes = await app.request('/shop/invoices/12345', {}, env);
    expect(unauthRes.status).toBe(401);

    // 2. Create an invoice for testUser
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
          sku: 'cosmetic_frame_gold',
          requestId: crypto.randomUUID(),
        }),
      },
      env,
    );
    expect(invRes.status).toBe(200);
    const invData = (await invRes.json()) as {
      sku: string;
      starsPrice: number;
      invoicePayload: string;
    };

    // Query purchases directly to find the UUID
    const purchaseRow = await database.db.query<{ id: string }>(
      'select id from public.purchases where invoice_payload = $1',
      [invData.invoicePayload],
    );
    const invoiceId = purchaseRow.rows[0]!.id;

    // 3. Non-existent invoice ID -> 404
    const notFoundRes = await app.request(
      `/shop/invoices/${crypto.randomUUID()}`,
      { headers: { Cookie: testUser.cookie } },
      env,
    );
    expect(notFoundRes.status).toBe(404);

    // 4. Another user cannot access testUser's invoice (Ownership boundary)
    const user2AuthRes = await app.request(
      '/auth/telegram',
      {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: initData(202, 'shop_tester_other'),
          requestId: crypto.randomUUID(),
        }),
      },
      env,
    );
    const user2Cookie =
      user2AuthRes.headers.get('set-cookie')?.split(';')[0] ?? '';

    const otherUserRes = await app.request(
      `/shop/invoices/${invoiceId}`,
      { headers: { Cookie: user2Cookie } },
      env,
    );
    expect([403, 404]).toContain(otherUserRes.status);

    // 5. Owner accesses invoice by UUID -> 200 OK
    const ownerRes = await app.request(
      `/shop/invoices/${invoiceId}`,
      { headers: { Cookie: testUser.cookie } },
      env,
    );
    expect(ownerRes.status).toBe(200);
    const ownerBody = await ownerRes.json();
    const parsed = invoiceStatusResponseSchema.parse(ownerBody);
    expect(parsed.apiVersion).toBe('v1');
    expect(parsed.invoice.id).toBe(invoiceId);
    expect(parsed.invoice.userId).toBe(testUser.userId);
    expect(parsed.invoice.sku).toBe('cosmetic_frame_gold');
    expect(parsed.invoice.starsAmount).toBe(150);
    expect(parsed.invoice.status).toBe('pending');
    expect(parsed.invoice.currency).toBe('XTR');

    // 6. Owner accesses invoice by invoice payload -> 200 OK
    const payloadRes = await app.request(
      `/shop/invoices/${invData.invoicePayload}`,
      { headers: { Cookie: testUser.cookie } },
      env,
    );
    expect(payloadRes.status).toBe(200);

    // 7. Accessible under /api prefix (/api/shop/invoices/:id) -> 200 OK
    const apiPrefixRes = await app.request(
      `/api/shop/invoices/${invoiceId}`,
      { headers: { Cookie: testUser.cookie } },
      env,
    );
    expect(apiPrefixRes.status).toBe(200);
  });
});
