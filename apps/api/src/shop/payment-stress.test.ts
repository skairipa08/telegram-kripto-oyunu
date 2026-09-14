import { createHmac } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  calculateConveniencePassEntitlements,
  calculateOfflineEarnings,
  calculateProductionPerSecond,
  calculateSRU,
  DEFAULT_SKUS,
  P2WViolationError,
  validateP2WSafety,
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
let testUser: { cookie: string; userId: string };

function initData(id: number, username: string) {
  const fields = {
    auth_date: String(now),
    query_id: `query-stress-${id}`,
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

describe('Empirical Payment Idempotency & Anti-P2W Stress Harness', () => {
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
          initData: initData(999, 'payment_stress_tester'),
          requestId: crypto.randomUUID(),
        }),
      },
      env,
    );
    const cookie = res.headers.get('set-cookie')?.split(';')[0];
    const body = (await res.json()) as { user: { id: string } };
    testUser = { cookie: cookie ?? '', userId: body.user.id };
  });

  it('1. Handles concurrent double-spend webhooks: exactly one fulfills, all duplicates detected idempotently', async () => {
    // Step 1: Create an invoice
    const invoiceRes = await app.request(
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
    expect(invoiceRes.status).toBe(200);
    const invoiceData = (await invoiceRes.json()) as { invoicePayload: string };
    expect(invoiceData.invoicePayload).toBeDefined();

    const sharedChargeId = `charge_concurrent_${Date.now()}`;

    // Step 2: Fire 10 simultaneous webhook payloads with the same telegram_payment_charge_id
    const webhookPayload = {
      message: {
        successful_payment: {
          telegram_payment_charge_id: sharedChargeId,
          invoice_payload: invoiceData.invoicePayload,
          total_amount: 250,
        },
      },
    };

    const requests = Array.from({ length: 10 }, () =>
      app.request(
        '/telegram/webhook',
        {
          method: 'POST',
          headers: { Origin: origin, 'Content-Type': 'application/json' },
          body: JSON.stringify(webhookPayload),
        },
        env,
      ),
    );

    const responses = await Promise.all(requests);

    // All 10 requests must succeed with HTTP 200
    for (const res of responses) {
      expect(res.status).toBe(200);
    }

    const jsonResults = await Promise.all(
      responses.map(
        (r) =>
          r.json() as Promise<{
            success: boolean;
            duplicate: boolean;
            newPassExpiresAt: string;
          }>,
      ),
    );

    // Filter results
    const originalFulfillments = jsonResults.filter(
      (r) => r.success && !r.duplicate,
    );
    const duplicateFulfillments = jsonResults.filter(
      (r) => r.success && r.duplicate,
    );

    // Invariant: Exactly 1 fulfillment, exactly 9 duplicates
    expect(originalFulfillments).toHaveLength(1);
    expect(duplicateFulfillments).toHaveLength(9);

    // Expiry timestamp must match across all duplicate responses
    const canonicalExpiry = originalFulfillments[0]!.newPassExpiresAt;
    for (const dup of duplicateFulfillments) {
      expect(dup.newPassExpiresAt).toBe(canonicalExpiry);
    }

    // Database verification: verify only 1 completed purchase record exists with this charge ID
    const purchaseRows = await database.db.query<{
      status: string;
      stars_amount: number;
    }>(
      'select status, stars_amount from public.purchases where telegram_payment_charge_id = $1',
      [sharedChargeId],
    );
    expect(purchaseRows.rows).toHaveLength(1);
    expect(purchaseRows.rows[0]?.status).toBe('completed');
    expect(purchaseRows.rows[0]?.stars_amount).toBe(250);

    // Verify player entitlement in DB: duration is exactly 30 days, NOT 10 * 30 = 300 days!
    const entRows = await database.db.query<{
      starts_at: string;
      expires_at: string;
      is_active: boolean;
    }>(
      'select starts_at, expires_at, is_active from public.player_entitlements where user_id = $1',
      [testUser.userId],
    );
    expect(entRows.rows).toHaveLength(1);
    expect(entRows.rows[0]?.is_active).toBe(true);

    const starts = new Date(entRows.rows[0]!.starts_at).getTime();
    const expires = new Date(entRows.rows[0]!.expires_at).getTime();
    const diffDays = Math.round((expires - starts) / (86400 * 1000));
    expect(diffDays).toBe(30);
  });

  it('2. Correctly rejects unknown or forged invoice payloads with 404', async () => {
    const res = await app.request(
      '/telegram/webhook',
      {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            successful_payment: {
              telegram_payment_charge_id: 'charge_forged_999',
              invoice_payload: 'inv_completely_fake_payload_not_in_database',
              total_amount: 250,
            },
          },
        }),
      },
      env,
    );

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('UNKNOWN_INVOICE_PAYLOAD');
  });

  it('3. Supports additive pass stacking upon legitimate subsequent purchases', async () => {
    // Current entitlement is 30 days. Let's purchase a second 30-day pass.
    const invRes2 = await app.request(
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
    const invData2 = (await invRes2.json()) as { invoicePayload: string };

    const secondChargeId = `charge_second_purchase_${Date.now()}`;

    const fulfillRes = await app.request(
      '/telegram/webhook',
      {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            successful_payment: {
              telegram_payment_charge_id: secondChargeId,
              invoice_payload: invData2.invoicePayload,
              total_amount: 250,
            },
          },
        }),
      },
      env,
    );

    expect(fulfillRes.status).toBe(200);
    const fulfillBody = (await fulfillRes.json()) as {
      success: boolean;
      duplicate: boolean;
    };
    expect(fulfillBody.success).toBe(true);
    expect(fulfillBody.duplicate).toBe(false);

    // Verify player entitlement in DB: duration is now additive (+30 days on top of previous expiry => ~60 days)
    const entRows = await database.db.query<{
      starts_at: string;
      expires_at: string;
    }>(
      'select starts_at, expires_at from public.player_entitlements where user_id = $1',
      [testUser.userId],
    );
    const starts = new Date(entRows.rows[0]!.starts_at).getTime();
    const expires = new Date(entRows.rows[0]!.expires_at).getTime();
    const totalDiffDays = Math.round((expires - starts) / (86400 * 1000));
    expect(totalDiffDays).toBe(60);
  });

  it('4. Anti-P2W Guardrails: Rejects all P2W SKUs and preserves zero Season Points multiplier', async () => {
    const maliciousSkus = [
      'season_points_1000',
      'points_multiplier_2x',
      'instant_sru_500',
      'skip_production_timer',
      'pay_to_win_rank_boost',
      'infinite_cash_pack',
    ];

    // Check 1: Invoicing API rejects all malicious SKUs
    for (const sku of maliciousSkus) {
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
            sku,
            requestId: crypto.randomUUID(),
          }),
        },
        env,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe('FORBIDDEN_P2W_SKU');
    }

    // Check 2: Core validator throws P2WViolationError
    for (const sku of maliciousSkus) {
      expect(() => validateP2WSafety(sku)).toThrow(P2WViolationError);
    }

    // Check 3: Only canonical SKUs exist in DEFAULT_SKUS
    for (const item of DEFAULT_SKUS) {
      expect(validateP2WSafety(item.sku)).toEqual({ safe: true });
      expect(item.type).toMatch(/^(pass|cosmetic)$/);
    }

    // Check 4: Convenience Pass entitlement permanently locks seasonPointsMultiplier to 1.0
    const activeEntitlements = calculateConveniencePassEntitlements(true);
    const freeEntitlements = calculateConveniencePassEntitlements(false);
    expect(activeEntitlements.seasonPointsMultiplier).toBe(1.0);
    expect(freeEntitlements.seasonPointsMultiplier).toBe(1.0);

    // Check 5: Production & SRU formulas are invariant to pass ownership
    // Base production rate is purely mathematical and cannot take any money multiplier
    const baseProd = calculateProductionPerSecond(10, 5);
    expect(baseProd).toBeGreaterThan(0);

    // SRU calculation is purely tied to QAP
    const sru100 = calculateSRU(100);
    const sru1000 = calculateSRU(1000);
    expect(sru100).toBe(500);
    expect(sru1000).toBeLessThan(500);

    // Offline earnings formula: pass only extends the cap, does not inflate the earning rate
    const freeOffline = calculateOfflineEarnings(100, 7200, 14400); // 2 hours offline
    const passOffline = calculateOfflineEarnings(100, 7200, 43200); // 2 hours offline with pass
    expect(freeOffline.earned).toBe(passOffline.earned); // 100 * 7200 = 720000 in both!
  });
});
