import { createHash, createHmac } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
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
  TELEGRAM_WEBHOOK_SECRET: 'super-secret-telegram-token-xyz789',
};

let database: Awaited<ReturnType<typeof createTestDatabase>>;
let app: ReturnType<typeof createApp>;
let testUser: { cookie: string; userId: string };

function initData(id: number, username: string) {
  const fields = {
    auth_date: String(now),
    query_id: `query-adv-${id}`,
    user: JSON.stringify({ id, first_name: `AdvUser${id}`, username }),
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

describe('Adversarial Challenge: Telegram Stars Payments & Webhook Security (R1)', () => {
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

    const res = await app.request(
      '/auth/telegram',
      {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: initData(301, 'adversarial_tester'),
          requestId: crypto.randomUUID(),
        }),
      },
      env,
    );
    const cookie = res.headers.get('set-cookie')?.split(';')[0];
    const body = (await res.json()) as { user: { id: string } };
    testUser = { cookie: cookie ?? '', userId: body.user.id };
  });

  describe('1. Secret Token Header Verification Stress', () => {
    it('rejects requests missing X-Telegram-Bot-Api-Secret-Token on /telegram/webhook with 401', async () => {
      const res = await app.request(
        '/telegram/webhook',
        {
          method: 'POST',
          headers: { Origin: origin, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: { chat: { id: 1001 }, text: '/start' },
          }),
        },
        env,
      );
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects requests missing X-Telegram-Bot-Api-Secret-Token on /shop/webhook with 401', async () => {
      const res = await app.request(
        '/shop/webhook',
        {
          method: 'POST',
          headers: { Origin: origin, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: { chat: { id: 1001 }, text: '/start' },
          }),
        },
        env,
      );
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects requests with incorrect X-Telegram-Bot-Api-Secret-Token with 401', async () => {
      const wrongSecrets = [
        'invalid',
        'super-secret-telegram-token-xyz78',
        'super-secret-telegram-token-xyz7890',
        'SUPER-SECRET-TELEGRAM-TOKEN-XYZ789',
        '',
      ];

      for (const secret of wrongSecrets) {
        const res = await app.request(
          '/telegram/webhook',
          {
            method: 'POST',
            headers: {
              Origin: origin,
              'Content-Type': 'application/json',
              'X-Telegram-Bot-Api-Secret-Token': secret,
            },
            body: JSON.stringify({
              message: { chat: { id: 1001 }, text: '/start' },
            }),
          },
          env,
        );
        expect(res.status).toBe(401);
      }
    });

    it('accepts requests when X-Telegram-Bot-Api-Secret-Token matches configured secret', async () => {
      const res = await app.request(
        '/telegram/webhook',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            'Content-Type': 'application/json',
            'X-Telegram-Bot-Api-Secret-Token':
              'super-secret-telegram-token-xyz789',
          },
          body: JSON.stringify({
            message: { chat: { id: 1001 }, text: '/start' },
          }),
        },
        env,
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
    });

    it('allows requests without header when TELEGRAM_WEBHOOK_SECRET is not configured', async () => {
      const openEnv: Bindings = { ...env };
      delete openEnv.TELEGRAM_WEBHOOK_SECRET;
      const res = await app.request(
        '/telegram/webhook',
        {
          method: 'POST',
          headers: { Origin: origin, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: { chat: { id: 1001 }, text: '/start' },
          }),
        },
        openEnv,
      );
      expect(res.status).toBe(200);
    });
  });

  describe('2. Pre-Checkout Query Edge Cases & Boundaries', () => {
    let activeInvoicePayload: string;
    const price = 250;

    beforeAll(async () => {
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
      const inv = await invRes.json();
      activeInvoicePayload = inv.invoicePayload;
    });

    it('rejects currency != XTR with explanatory error', async () => {
      const badCurrencies = ['USD', 'EUR', 'RUB', 'TON', 'xtr', 'XTR '];
      for (const cur of badCurrencies) {
        const res = await app.request(
          '/telegram/webhook',
          {
            method: 'POST',
            headers: {
              Origin: origin,
              'Content-Type': 'application/json',
              'X-Telegram-Bot-Api-Secret-Token':
                'super-secret-telegram-token-xyz789',
            },
            body: JSON.stringify({
              pre_checkout_query: {
                id: `pcq_cur_${cur}`,
                currency: cur,
                total_amount: price,
                invoice_payload: activeInvoicePayload,
              },
            }),
          },
          env,
        );
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.ok).toBe(false);
        expect(json.error_message).toContain('XTR');
      }
    });

    it('rejects non-existent invoice payload', async () => {
      const forgedPayloads = [
        'inv_fake_00000000000000000000',
        'random_string_payload',
        "' OR '1'='1",
        'inv_' + 'a'.repeat(64),
      ];

      for (const payload of forgedPayloads) {
        const res = await app.request(
          '/telegram/webhook',
          {
            method: 'POST',
            headers: {
              Origin: origin,
              'Content-Type': 'application/json',
              'X-Telegram-Bot-Api-Secret-Token':
                'super-secret-telegram-token-xyz789',
            },
            body: JSON.stringify({
              pre_checkout_query: {
                id: `pcq_fake_${payload.slice(0, 8)}`,
                currency: 'XTR',
                total_amount: price,
                invoice_payload: payload,
              },
            }),
          },
          env,
        );
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.ok).toBe(false);
        expect(json.error_message).toContain('Invoice not found');
      }
    });

    it('rejects total_amount mismatch (higher, lower, zero, negative)', async () => {
      const mismatchedAmounts = [price + 1, price - 1, 0, -100, 99999];
      for (const amt of mismatchedAmounts) {
        const res = await app.request(
          '/telegram/webhook',
          {
            method: 'POST',
            headers: {
              Origin: origin,
              'Content-Type': 'application/json',
              'X-Telegram-Bot-Api-Secret-Token':
                'super-secret-telegram-token-xyz789',
            },
            body: JSON.stringify({
              pre_checkout_query: {
                id: `pcq_amt_${amt}`,
                currency: 'XTR',
                total_amount: amt,
                invoice_payload: activeInvoicePayload,
              },
            }),
          },
          env,
        );
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.ok).toBe(false);
        expect(json.error_message).toContain('Amount mismatch');
      }
    });

    it('approves valid pending invoice with ok: true', async () => {
      const res = await app.request(
        '/telegram/webhook',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            'Content-Type': 'application/json',
            'X-Telegram-Bot-Api-Secret-Token':
              'super-secret-telegram-token-xyz789',
          },
          body: JSON.stringify({
            pre_checkout_query: {
              id: 'pcq_valid_test_approval',
              currency: 'XTR',
              total_amount: price,
              invoice_payload: activeInvoicePayload,
            },
          }),
        },
        env,
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
    });

    it('rejects pre_checkout_query when invoice is already fulfilled/completed', async () => {
      // First fulfill the invoice
      const chargeId = `charge_fulfill_for_pcq_${Date.now()}`;
      const fulfillRes = await app.request(
        '/telegram/webhook',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            'Content-Type': 'application/json',
            'X-Telegram-Bot-Api-Secret-Token':
              'super-secret-telegram-token-xyz789',
          },
          body: JSON.stringify({
            message: {
              successful_payment: {
                telegram_payment_charge_id: chargeId,
                invoice_payload: activeInvoicePayload,
                total_amount: price,
              },
            },
          }),
        },
        env,
      );
      expect(fulfillRes.status).toBe(200);

      // Now query pre_checkout again for this fulfilled invoice
      const res = await app.request(
        '/telegram/webhook',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            'Content-Type': 'application/json',
            'X-Telegram-Bot-Api-Secret-Token':
              'super-secret-telegram-token-xyz789',
          },
          body: JSON.stringify({
            pre_checkout_query: {
              id: 'pcq_after_fulfill',
              currency: 'XTR',
              total_amount: price,
              invoice_payload: activeInvoicePayload,
            },
          }),
        },
        env,
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error_message).toContain('no longer pending');
    });
  });

  describe('3. Concurrency Idempotency & Reward Ledger Verification', () => {
    it('handles 20 racing concurrent duplicate webhooks with exact 1 fulfillment, 19 duplicate detections, and valid SHA-256 reward_ledger entry', async () => {
      // 1. Create fresh invoice
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
      const inv = await invRes.json();
      const chargeId = `charge_race_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      // 2. Launch 20 concurrent requests
      const CONCURRENCY = 20;
      const tasks = Array.from({ length: CONCURRENCY }, () =>
        app.request(
          '/telegram/webhook',
          {
            method: 'POST',
            headers: {
              Origin: origin,
              'Content-Type': 'application/json',
              'X-Telegram-Bot-Api-Secret-Token':
                'super-secret-telegram-token-xyz789',
            },
            body: JSON.stringify({
              message: {
                successful_payment: {
                  telegram_payment_charge_id: chargeId,
                  invoice_payload: inv.invoicePayload,
                  total_amount: inv.starsPrice,
                },
              },
            }),
          },
          env,
        ),
      );

      const responses = await Promise.all(tasks);
      for (const r of responses) {
        expect(r.status).toBe(200);
      }

      const bodies = await Promise.all(
        responses.map(
          (r) =>
            r.json() as Promise<{
              success: boolean;
              duplicate: boolean;
              purchaseId: string;
            }>,
        ),
      );

      const originals = bodies.filter((b) => b.success && !b.duplicate);
      const duplicates = bodies.filter((b) => b.success && b.duplicate);

      expect(originals).toHaveLength(1);
      expect(duplicates).toHaveLength(CONCURRENCY - 1);

      // Verify all duplicates returned the same purchaseId
      const canonicalPurchaseId = originals[0]!.purchaseId;
      for (const dup of duplicates) {
        expect(dup.purchaseId).toBe(canonicalPurchaseId);
      }

      // 3. Inspect public.reward_ledger
      const expectedSha256 = createHash('sha256')
        .update(chargeId)
        .digest('hex')
        .toLowerCase();

      // Check SHA-256 string validity: exactly 64 lowercase hex characters
      expect(expectedSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(expectedSha256.length).toBe(64);

      const ledgerQuery = await database.db.query<{
        id: string;
        user_id: string;
        delta_cash: number | string;
        delta_season_points: number | string;
        reason: string;
        idempotency_key: string;
        metadata: unknown;
      }>('select * from public.reward_ledger where idempotency_key = $1', [
        expectedSha256,
      ]);

      // Exactly ONE row inserted
      expect(ledgerQuery.rows).toHaveLength(1);
      const ledgerEntry = ledgerQuery.rows[0]!;
      expect(ledgerEntry.user_id).toBe(testUser.userId);
      expect(Number(ledgerEntry.delta_cash)).toBe(0);
      expect(Number(ledgerEntry.delta_season_points)).toBe(0);
      expect(ledgerEntry.reason).toBe('stars_purchase');
      expect(ledgerEntry.idempotency_key).toBe(expectedSha256);
      expect(ledgerEntry.idempotency_key).toMatch(/^[a-f0-9]{64}$/);

      // Verify purchases record in DB has status completed
      const purchaseQuery = await database.db.query<{
        status: string;
        telegram_payment_charge_id: string;
      }>(
        'select status, telegram_payment_charge_id from public.purchases where id = $1',
        [canonicalPurchaseId],
      );
      expect(purchaseQuery.rows[0]!.status).toBe('completed');
      expect(purchaseQuery.rows[0]!.telegram_payment_charge_id).toBe(chargeId);
    });

    it('proves pre_checkout_query blocks re-checkout and identical charge ID is idempotent on retries', async () => {
      // 1. Create a convenience pass invoice
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
      const inv = await invRes.json();
      const firstChargeId = `charge_legit_${Date.now()}`;

      // 2. Fulfill legitimately first time
      const legitRes = await app.request(
        '/telegram/webhook',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            'Content-Type': 'application/json',
            'X-Telegram-Bot-Api-Secret-Token':
              'super-secret-telegram-token-xyz789',
          },
          body: JSON.stringify({
            message: {
              successful_payment: {
                telegram_payment_charge_id: firstChargeId,
                invoice_payload: inv.invoicePayload,
                total_amount: 250,
              },
            },
          }),
        },
        env,
      );
      expect(legitRes.status).toBe(200);
      const legitData = await legitRes.json();
      expect(legitData.success).toBe(true);
      expect(legitData.duplicate).toBe(false);

      // 3. Pre-checkout query for this invoice is now blocked (prevents Telegram checkout replay)
      const pcqRes = await app.request(
        '/telegram/webhook',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            'Content-Type': 'application/json',
            'X-Telegram-Bot-Api-Secret-Token':
              'super-secret-telegram-token-xyz789',
          },
          body: JSON.stringify({
            pre_checkout_query: {
              id: 'pcq_replay_prevented',
              currency: 'XTR',
              total_amount: 250,
              invoice_payload: inv.invoicePayload,
            },
          }),
        },
        env,
      );
      const pcqData = await pcqRes.json();
      expect(pcqData.ok).toBe(false);
      expect(pcqData.error_message).toContain('no longer pending');

      // 4. Exact duplicate webhook (Telegram retry with identical charge ID) is handled idempotently
      const retryRes = await app.request(
        '/telegram/webhook',
        {
          method: 'POST',
          headers: {
            Origin: origin,
            'Content-Type': 'application/json',
            'X-Telegram-Bot-Api-Secret-Token':
              'super-secret-telegram-token-xyz789',
          },
          body: JSON.stringify({
            message: {
              successful_payment: {
                telegram_payment_charge_id: firstChargeId,
                invoice_payload: inv.invoicePayload,
                total_amount: 250,
              },
            },
          }),
        },
        env,
      );
      expect(retryRes.status).toBe(200);
      const retryData = await retryRes.json();
      expect(retryData.success).toBe(true);
      expect(retryData.duplicate).toBe(true);
      expect(retryData.newPassExpiresAt).toBe(legitData.newPassExpiresAt);
    });
  });
});
