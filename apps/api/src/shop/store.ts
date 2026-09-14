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
}
