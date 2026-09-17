import { Hono, type Context } from 'hono';
import {
  calculateConveniencePassEntitlements,
  DEFAULT_SKUS,
  P2WViolationError,
  validateP2WSafety,
} from '@empire/game-core';
import {
  createInvoiceRequestSchema,
  fulfillPaymentRequestSchema,
  type CreateInvoiceResponse,
  type FulfillPaymentResponse,
  type InvoiceStatusResponse,
  type ShopCatalogResponseDto,
} from '@empire/shared';
import type { Bindings } from '../auth/env';
import { getCurrentUserSession } from '../auth/routes';
import { SupabaseAuthStore, type AuthStore } from '../auth/store';
import { SupabaseShopStore, type ShopStore } from './store';
import { handleTelegramBotMessage } from '../telegram/bot-handler';

const error = (code: string) => ({
  apiVersion: 'v1' as const,
  error: { code },
});

async function sha256Hex(data: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(data),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function createShopRoutes(
  makeStore: (env: Bindings) => ShopStore = (env) =>
    new SupabaseShopStore(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!),
  makeAuthStore: (env: Bindings) => AuthStore = (env) =>
    new SupabaseAuthStore(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!),
  now: () => number = () => Math.floor(Date.now() / 1000),
) {
  const routes = new Hono<{ Bindings: Bindings }>();

  // GET /shop
  routes.get('/shop', async (c) => {
    const authStore = makeAuthStore(c.env);
    const session = await getCurrentUserSession(
      c.req.header('Cookie') ??
        c.req.header('Authorization') ??
        c.req.header('X-Empire-Session'),
      c.env,
      authStore,
      now,
    );
    if (!session) {
      return c.json(error('UNAUTHORIZED'), 401);
    }

    const store = makeStore(c.env);
    const passStatus = await store.getUserPass(session.user.id);
    const entitlements = calculateConveniencePassEntitlements(
      passStatus.isActive,
    );

    const response: ShopCatalogResponseDto = {
      apiVersion: 'v1',
      skus: DEFAULT_SKUS.map((s) => ({
        sku: s.sku,
        name: s.name,
        description: s.description,
        starsPrice: s.starsPrice,
        type: s.type,
        durationDays: s.durationDays,
      })),
      pass: {
        isActive: passStatus.isActive,
        expiresAt: passStatus.expiresAt,
        offlineCapSeconds: entitlements.offlineCapSeconds,
        upgradeQueueSlots: entitlements.upgradeQueueSlots,
        missionRerolls: entitlements.missionRerolls,
        autoClaimEnabled: entitlements.autoClaimEnabled,
        seasonPointsMultiplier: entitlements.seasonPointsMultiplier,
      },
    };

    return c.json(response);
  });

  // POST /shop/invoice
  routes.post('/shop/invoice', async (c) => {
    const authStore = makeAuthStore(c.env);
    const session = await getCurrentUserSession(
      c.req.header('Cookie') ??
        c.req.header('Authorization') ??
        c.req.header('X-Empire-Session'),
      c.env,
      authStore,
      now,
    );
    if (!session) {
      return c.json(error('UNAUTHORIZED'), 401);
    }

    let body;
    try {
      body = createInvoiceRequestSchema.parse(await c.req.json());
    } catch {
      return c.json(error('INVALID_REQUEST'), 400);
    }

    // Strict Anti-P2W Contract Check
    try {
      validateP2WSafety(body.sku);
    } catch (err) {
      if (err instanceof P2WViolationError) {
        return c.json(error('FORBIDDEN_P2W_SKU'), 400);
      }
      return c.json(error('INVALID_SKU'), 400);
    }

    const store = makeStore(c.env);
    try {
      const invoice = await store.createInvoice(
        session.user.id,
        body.sku,
        body.requestId,
      );
      const response: CreateInvoiceResponse = {
        apiVersion: 'v1',
        sku: invoice.sku,
        starsPrice: invoice.starsPrice,
        invoicePayload: invoice.invoicePayload,
        invoiceLink: invoice.invoiceLink,
      };
      return c.json(response);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('FORBIDDEN_P2W_SKU')) {
        return c.json(error('FORBIDDEN_P2W_SKU'), 400);
      }
      return c.json(error('SERVER_ERROR'), 500);
    }
  });

  // GET /shop/invoices/:id
  routes.get('/shop/invoices/:id', async (c) => {
    const authStore = makeAuthStore(c.env);
    const session = await getCurrentUserSession(
      c.req.header('Cookie') ??
        c.req.header('Authorization') ??
        c.req.header('X-Empire-Session'),
      c.env,
      authStore,
      now,
    );
    if (!session) {
      return c.json(error('UNAUTHORIZED'), 401);
    }

    const id = c.req.param('id');
    const store = makeStore(c.env);
    const invoice = await store.getInvoice(session.user.id, id);
    if (!invoice) {
      return c.json(error('INVOICE_NOT_FOUND'), 404);
    }

    if (invoice.userId !== session.user.id) {
      return c.json(error('FORBIDDEN'), 403);
    }

    const response: InvoiceStatusResponse = {
      apiVersion: 'v1',
      invoice: {
        id: invoice.id,
        userId: invoice.userId,
        sku: invoice.sku,
        starsAmount: invoice.starsAmount,
        status: invoice.status,
        telegramPaymentChargeId: invoice.telegramPaymentChargeId,
        invoicePayload: invoice.invoicePayload,
        currency: 'XTR',
        createdAt: invoice.createdAt,
        completedAt: invoice.completedAt,
      },
    };

    return c.json(response);
  });

  // Telegram Stars webhook handler (supports both /telegram/webhook and /shop/webhook)
  const webhookHandler = async (c: Context<{ Bindings: Bindings }>) => {
    const configuredSecret = c.env.TELEGRAM_WEBHOOK_SECRET;
    if (configuredSecret) {
      const incomingSecret = c.req.header('x-telegram-bot-api-secret-token');
      if (!incomingSecret || incomingSecret !== configuredSecret) {
        return c.json(error('UNAUTHORIZED'), 401);
      }
    }

    const raw = await c.req.json().catch(() => null);
    if (!raw || typeof raw !== 'object') {
      return c.json(error('INVALID_PAYLOAD'), 400);
    }

    const payloadObj = raw as Record<string, unknown>;

    // Case 1: Telegram Pre-checkout query
    if (payloadObj.pre_checkout_query) {
      const pcq = payloadObj.pre_checkout_query as {
        id: string;
        currency: string;
        total_amount: number;
        invoice_payload: string;
      };
      if (pcq.currency !== 'XTR') {
        return c.json({
          ok: false,
          error_message: 'Currency must be XTR (Telegram Stars).',
        });
      }

      const store = makeStore(c.env);
      const invoice = await store.findInvoiceByPayload(pcq.invoice_payload);
      if (!invoice) {
        return c.json({
          ok: false,
          error_message: 'Invoice not found or invalid payload.',
        });
      }

      if (invoice.status !== 'pending') {
        return c.json({
          ok: false,
          error_message:
            'Invoice has already been fulfilled or is no longer pending.',
        });
      }

      if (invoice.starsAmount !== pcq.total_amount) {
        return c.json({
          ok: false,
          error_message: 'Amount mismatch.',
        });
      }

      // Outbound call to Telegram Bot API answerPreCheckoutQuery if token present
      if (c.env.TELEGRAM_BOT_TOKEN) {
        try {
          await fetch(
            `https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/answerPreCheckoutQuery`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                pre_checkout_query_id: pcq.id,
                ok: true,
              }),
              signal: AbortSignal.timeout(5000),
            },
          ).catch(() => null);
        } catch {
          // Graceful fallback for offline / test environments
        }
      }

      return c.json({ ok: true });
    }

    // Case 2: Telegram Bot Standard Message (/start, /admin, /help)
    if (
      payloadObj.message &&
      typeof payloadObj.message === 'object' &&
      !('successful_payment' in (payloadObj.message as Record<string, unknown>))
    ) {
      const msg = payloadObj.message as {
        chat?: { id: number | string };
        from?: {
          id: number | string;
          username?: string;
          first_name?: string;
          language_code?: string;
        };
        text?: string;
      };
      const chatId = msg.chat?.id;
      const text = msg.text?.trim() || '';
      const username = msg.from?.username;
      const firstName = msg.from?.first_name || 'Girişimci';
      const languageCode = msg.from?.language_code;

      if (chatId && c.env.TELEGRAM_BOT_TOKEN) {
        await handleTelegramBotMessage({
          token: c.env.TELEGRAM_BOT_TOKEN,
          appOrigin: c.env.APP_ORIGIN || 'https://empire.example',
          chatId,
          text,
          username,
          firstName,
          languageCode,
          withPhoto: true,
        });
      }

      return c.json({ ok: true });
    }

    // Case 3: Telegram successful_payment or direct fulfill payment DTO
    let chargeId: string | undefined;
    let invoicePayload: string | undefined;
    let starsAmount: number | undefined;
    let sku: string | undefined;

    if (
      payloadObj.message &&
      typeof payloadObj.message === 'object' &&
      'successful_payment' in (payloadObj.message as Record<string, unknown>)
    ) {
      const sp = (payloadObj.message as Record<string, unknown>)
        .successful_payment as {
        telegram_payment_charge_id: string;
        invoice_payload: string;
        total_amount: number;
      };
      chargeId = sp.telegram_payment_charge_id;
      invoicePayload = sp.invoice_payload;
      starsAmount = sp.total_amount;
    } else {
      try {
        const parsed = fulfillPaymentRequestSchema.parse(raw);
        chargeId = parsed.telegramPaymentChargeId;
        invoicePayload = parsed.invoicePayload;
        starsAmount = parsed.starsAmount;
        sku = parsed.sku;
      } catch {
        return c.json(error('INVALID_PAYLOAD'), 400);
      }
    }

    if (!chargeId || !invoicePayload || !starsAmount) {
      return c.json(error('INVALID_PAYMENT_DATA'), 400);
    }

    const store = makeStore(c.env);
    try {
      const result = await store.fulfillPayment(
        chargeId,
        invoicePayload,
        starsAmount,
        sku,
      );

      // Record immutable ledger entry and entitlement metadata on first fulfillment
      if (!result.duplicate) {
        const idempotencyKey = await sha256Hex(chargeId);
        const invoice = await store.findInvoiceByPayload(invoicePayload);
        const userId = invoice?.userId;
        const effectiveSku = invoice?.sku ?? sku;

        if (userId && store.recordRewardLedger) {
          await store.recordRewardLedger({
            userId,
            deltaCash: 0,
            deltaSeasonPoints: 0,
            reason: 'stars_purchase',
            idempotencyKey,
            metadata: {
              sku: effectiveSku,
              starsAmount,
              telegramPaymentChargeId: chargeId,
              purchaseId: result.purchaseId,
            },
          });
        }

        if (
          effectiveSku &&
          effectiveSku !== 'convenience_pass_30d' &&
          store.updatePurchaseMetadata
        ) {
          await store.updatePurchaseMetadata(result.purchaseId, {
            entitlement_granted: true,
            badge: effectiveSku,
            granted_at: new Date().toISOString(),
          });
        }
      }

      const response: FulfillPaymentResponse = {
        apiVersion: 'v1',
        success: result.success,
        duplicate: result.duplicate,
        purchaseId: result.purchaseId,
        newPassExpiresAt: result.newPassExpiresAt,
      };
      return c.json(response);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('UNKNOWN_INVOICE_PAYLOAD')) {
        return c.json(error('UNKNOWN_INVOICE_PAYLOAD'), 404);
      }
      return c.json(error('PAYMENT_FULFILLMENT_FAILED'), 500);
    }
  };

  routes.post('/telegram/webhook', webhookHandler);
  routes.post('/shop/webhook', webhookHandler);

  return routes;
}
