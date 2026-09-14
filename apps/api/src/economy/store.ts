export interface EconomyPlayerBusiness {
  slug: string;
  name: string;
  level: number;
  baseCost: number;
  baseIncome: number;
  sortOrder: number;
  lastClaimAt: string;
}

export interface EconomyPlayerState {
  cash: number;
  seasonPoints: number;
  hasConveniencePass: boolean;
  businesses: EconomyPlayerBusiness[];
}

export interface EconomyStore {
  getPlayerState(userId: string): Promise<EconomyPlayerState>;
  initPlayerEconomy(
    userId: string,
    isReferred?: boolean,
  ): Promise<{ success: boolean; cash: number; isReferred: boolean }>;
}

export class SupabaseEconomyStore implements EconomyStore {
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

  async getPlayerState(userId: string): Promise<EconomyPlayerState> {
    const res = (await this.rpc('empire_economy_get_player_state', {
      p_user_id: userId,
    })) as {
      cash: number;
      seasonPoints: number;
      hasConveniencePass: boolean;
      businesses: EconomyPlayerBusiness[];
    } | null;

    if (!res) {
      return {
        cash: 100,
        seasonPoints: 0,
        hasConveniencePass: false,
        businesses: [],
      };
    }

    return {
      cash: Number(res.cash ?? 100),
      seasonPoints: Number(res.seasonPoints ?? 0),
      hasConveniencePass: Boolean(res.hasConveniencePass),
      businesses: res.businesses ?? [],
    };
  }

  async initPlayerEconomy(
    userId: string,
    isReferred = false,
  ): Promise<{ success: boolean; cash: number; isReferred: boolean }> {
    const res = (await this.rpc('empire_init_player_economy', {
      p_user_id: userId,
      p_is_referred: isReferred,
    })) as { success: boolean; cash: number; isReferred: boolean } | null;

    return {
      success: Boolean(res?.success),
      cash: Number(res?.cash ?? (isReferred ? 600 : 100)),
      isReferred: Boolean(res?.isReferred ?? isReferred),
    };
  }
}
