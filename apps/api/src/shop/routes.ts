import { Hono } from 'hono';
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
  type ShopCatalogResponseDto,
} from '@empire/shared';
import type { Bindings } from '../auth/env';
import { getCurrentUserSession } from '../auth/routes';
import { SupabaseAuthStore, type AuthStore } from '../auth/store';
import { SupabaseShopStore, type ShopStore } from './store';

const error = (code: string) => ({
  apiVersion: 'v1' as const,
  error: { code },
});

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
      c.req.header('Cookie'),
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
      c.req.header('Cookie'),
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

  // POST /telegram/webhook (Handles Telegram Stars payment lifecycle)
  routes.post('/telegram/webhook', async (c) => {
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
      return c.json({ ok: true });
    }

    // Case 2: Telegram successful_payment or direct fulfill payment DTO
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
  });

  return routes;
}
