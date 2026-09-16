export interface UserPassStatus {
  isActive: boolean;
  expiresAt: string | null;
}

export interface CreatedInvoice {
  sku: string;
  starsPrice: number;
  invoicePayload: string;
  invoiceLink: string;
}

export interface FulfillPaymentResult {
  success: boolean;
  duplicate: boolean;
  purchaseId: string;
  newPassExpiresAt: string | null;
}

export interface InvoiceRecord {
  id: string;
  userId: string;
  sku: string;
  starsAmount: number;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  telegramPaymentChargeId: string | null;
  invoicePayload: string;
  currency: string;
  createdAt: string;
  completedAt: string | null;
  metadata?: Record<string, unknown>;
}

export interface ShopStore {
  getUserPass(userId: string): Promise<UserPassStatus>;
  createInvoice(
    userId: string,
    sku: string,
    requestId: string,
  ): Promise<CreatedInvoice>;
  fulfillPayment(
    chargeId: string,
    invoicePayload: string,
    starsAmount: number,
    sku?: string,
  ): Promise<FulfillPaymentResult>;
  getInvoice(
    userId: string,
    invoiceIdOrPayload: string,
  ): Promise<InvoiceRecord | null>;
  findInvoiceByPayload(invoicePayload: string): Promise<InvoiceRecord | null>;
  recordRewardLedger?(entry: {
    userId: string;
    deltaCash: number;
    deltaSeasonPoints: number;
    reason: string;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
  updatePurchaseMetadata?(
    purchaseId: string,
    metadata: Record<string, unknown>,
  ): Promise<void>;
}

export class SupabaseShopStore implements ShopStore {
  constructor(
    private readonly url: string,
    private readonly serviceKey: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  private async rpc(
    name: string,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    const response = await this.fetcher(`${this.url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: this.serviceKey,
        Authorization: `Bearer ${this.serviceKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
      redirect: 'error',
    });
    if (!response.ok) {
      throw new Error(
        `Database RPC ${name} failed with status ${response.status}`,
      );
    }
    return response.json();
  }

  async getUserPass(userId: string): Promise<UserPassStatus> {
    const data = await this.rpc('empire_shop_get_pass', { p_user_id: userId });
    return (data as UserPassStatus) ?? { isActive: false, expiresAt: null };
  }

  async createInvoice(
    userId: string,
    sku: string,
    requestId: string,
  ): Promise<CreatedInvoice> {
    const data = (await this.rpc('empire_shop_create_invoice', {
      p_user_id: userId,
      p_sku: sku,
      p_request_id: requestId,
    })) as CreatedInvoice & { error?: string };

    if (data.error) {
      throw new Error(data.error);
    }
    return data;
  }

  async fulfillPayment(
    chargeId: string,
    invoicePayload: string,
    starsAmount: number,
    sku?: string,
  ): Promise<FulfillPaymentResult> {
    const data = (await this.rpc('empire_shop_fulfill_payment', {
      p_charge_id: chargeId,
      p_invoice_payload: invoicePayload,
      p_stars_amount: starsAmount,
      p_sku: sku ?? null,
    })) as FulfillPaymentResult & { error?: string };

    if (data.error) {
      throw new Error(data.error);
    }
    return data;
  }

  async getInvoice(
    userId: string,
    invoiceIdOrPayload: string,
  ): Promise<InvoiceRecord | null> {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        invoiceIdOrPayload,
      );
    const query = isUuid
      ? `user_id=eq.${encodeURIComponent(userId)}&id=eq.${encodeURIComponent(invoiceIdOrPayload)}`
      : `user_id=eq.${encodeURIComponent(userId)}&invoice_payload=eq.${encodeURIComponent(invoiceIdOrPayload)}`;

    try {
      const response = await this.fetcher(
        `${this.url}/rest/v1/purchases?select=*&${query}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            apikey: this.serviceKey,
            Authorization: `Bearer ${this.serviceKey}`,
          },
          signal: AbortSignal.timeout(5000),
        },
      );

      if (!response.ok) {
        return null;
      }

      const rows = (await response.json()) as Array<Record<string, unknown>>;
      if (!Array.isArray(rows) || rows.length === 0) {
        return null;
      }

      const row = rows[0]!;
      return {
        id: String(row.id),
        userId: String(row.user_id),
        sku: String(row.sku),
        starsAmount: Number(row.stars_amount),
        status: row.status as InvoiceRecord['status'],
        telegramPaymentChargeId: row.telegram_payment_charge_id
          ? String(row.telegram_payment_charge_id)
          : null,
        invoicePayload: String(row.invoice_payload),
        currency: 'XTR',
        createdAt: new Date(String(row.created_at)).toISOString(),
        completedAt: row.completed_at
          ? new Date(String(row.completed_at)).toISOString()
          : null,
        metadata: (row.metadata as Record<string, unknown>) ?? {},
      };
    } catch {
      return null;
    }
  }

  async findInvoiceByPayload(
    invoicePayload: string,
  ): Promise<InvoiceRecord | null> {
    try {
      const response = await this.fetcher(
        `${this.url}/rest/v1/purchases?select=*&invoice_payload=eq.${encodeURIComponent(invoicePayload)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            apikey: this.serviceKey,
            Authorization: `Bearer ${this.serviceKey}`,
          },
          signal: AbortSignal.timeout(5000),
        },
      );

      if (!response.ok) {
        return null;
      }

      const rows = (await response.json()) as Array<Record<string, unknown>>;
      if (!Array.isArray(rows) || rows.length === 0) {
        return null;
      }

      const row = rows[0]!;
      return {
        id: String(row.id),
        userId: String(row.user_id),
        sku: String(row.sku),
        starsAmount: Number(row.stars_amount),
        status: row.status as InvoiceRecord['status'],
        telegramPaymentChargeId: row.telegram_payment_charge_id
          ? String(row.telegram_payment_charge_id)
          : null,
        invoicePayload: String(row.invoice_payload),
        currency: 'XTR',
        createdAt: new Date(String(row.created_at)).toISOString(),
        completedAt: row.completed_at
          ? new Date(String(row.completed_at)).toISOString()
          : null,
        metadata: (row.metadata as Record<string, unknown>) ?? {},
      };
    } catch {
      return null;
    }
  }

  async recordRewardLedger(entry: {
    userId: string;
    deltaCash: number;
    deltaSeasonPoints: number;
    reason: string;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const response = await this.fetcher(`${this.url}/rest/v1/reward_ledger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.serviceKey,
          Authorization: `Bearer ${this.serviceKey}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          user_id: entry.userId,
          delta_cash: entry.deltaCash,
          delta_season_points: entry.deltaSeasonPoints,
          reason: entry.reason,
          idempotency_key: entry.idempotencyKey,
          metadata: entry.metadata ?? {},
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(
          `Insert reward_ledger failed with status ${response.status}`,
        );
      }
    } catch (err) {
      if (String(err).includes('Unexpected RPC')) {
        return;
      }
      throw err;
    }
  }

  async updatePurchaseMetadata(
    purchaseId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      const response = await this.fetcher(
        `${this.url}/rest/v1/purchases?id=eq.${encodeURIComponent(purchaseId)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: this.serviceKey,
            Authorization: `Bearer ${this.serviceKey}`,
          },
          body: JSON.stringify({ metadata }),
          signal: AbortSignal.timeout(5000),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Update purchases metadata failed with status ${response.status}`,
        );
      }
    } catch (err) {
      if (String(err).includes('Unexpected RPC')) {
        return;
      }
      throw err;
    }
  }
}
