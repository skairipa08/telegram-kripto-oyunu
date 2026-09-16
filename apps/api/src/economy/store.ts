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
  claimOfflineEarnings(
    userId: string,
    requestId: string,
  ): Promise<{
    error?: string | undefined;
    replayed?: boolean;
    claimedAmount: number;
    newBalance: number;
    claimedAt: string;
    isCapped: boolean;
  }>;
  upgradeBusiness(
    userId: string,
    businessSlug: string,
    requestId?: string,
  ): Promise<{
    error?: string | undefined;
    replayed?: boolean;
    business?:
      | {
          slug: string;
          name: string;
          level: number;
          baseCost: number;
          baseIncome: number;
          upgradeCost: number;
          productionPerSecond: number;
          lastClaimAt: string;
        }
      | undefined;
    remainingCash?: number | undefined;
    totalProductionPerSecond?: number | undefined;
  }>;
  getGameState(userId: string): Promise<Record<string, unknown>>;
  bindReferral(
    userId: string,
    referralCode: string,
    requestId: string,
  ): Promise<{
    success: boolean;
    error?: string | undefined;
    starterCashBoost: number;
  }>;
  getReferralStatus(userId: string): Promise<Record<string, unknown>>;
  getActiveMissions(userId: string): Promise<unknown[]>;
  claimMission(
    userId: string,
    missionInstanceId: string,
    requestId: string,
  ): Promise<Record<string, unknown>>;
  getStreak(userId: string): Promise<Record<string, unknown>>;
  claimStreak(
    userId: string,
    requestId?: string,
  ): Promise<Record<string, unknown>>;
  claimReferralReward(
    userId: string,
    eventId: string,
    requestId?: string,
  ): Promise<Record<string, unknown>>;
  assignDailyMissions(
    userId: string,
    targetDate?: string,
  ): Promise<Record<string, unknown>>;
  incrementMissionProgress(
    userId: string,
    actionKey: string,
    increment?: number,
  ): Promise<Record<string, unknown>>;
  evaluateReferralMilestones(
    inviteeUserId: string,
  ): Promise<Record<string, unknown>>;
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

  async claimOfflineEarnings(
    userId: string,
    requestId: string,
  ): Promise<{
    error?: string | undefined;
    replayed?: boolean;
    claimedAmount: number;
    newBalance: number;
    claimedAt: string;
    isCapped: boolean;
  }> {
    const res = (await this.rpc('empire_claim_offline_earnings', {
      p_user_id: userId,
      p_request_id: requestId,
    })) as {
      error?: string;
      _replayed?: boolean;
      claimedAmount: number;
      newBalance: number;
      claimedAt: string;
      isCapped: boolean;
    } | null;

    return {
      error: res?.error ? String(res.error) : undefined,
      replayed: Boolean(res?._replayed),
      claimedAmount: Number(res?.claimedAmount ?? 0),
      newBalance: Number(res?.newBalance ?? 0),
      claimedAt: res?.claimedAt ?? new Date().toISOString(),
      isCapped: Boolean(res?.isCapped),
    };
  }

  async upgradeBusiness(
    userId: string,
    businessSlug: string,
    requestId?: string,
  ): Promise<{
    error?: string | undefined;
    replayed?: boolean;
    business?:
      | {
          slug: string;
          name: string;
          level: number;
          baseCost: number;
          baseIncome: number;
          upgradeCost: number;
          productionPerSecond: number;
          lastClaimAt: string;
        }
      | undefined;
    remainingCash?: number | undefined;
    totalProductionPerSecond?: number | undefined;
  }> {
    const res = (await this.rpc('empire_upgrade_business', {
      p_user_id: userId,
      p_business_slug: businessSlug,
      p_request_id: requestId ?? null,
    })) as Record<string, unknown> | null;

    if (!res) {
      return { error: 'RPC_FAILED' };
    }

    if (res.error) {
      return { error: String(res.error) };
    }

    const biz = res.business as Record<string, unknown> | undefined;
    return {
      replayed: Boolean(res._replayed),
      business: biz
        ? {
            slug: String(biz.slug),
            name: String(biz.name),
            level: Number(biz.level),
            baseCost: Number(biz.baseCost),
            baseIncome: Number(biz.baseIncome),
            upgradeCost: Number(biz.upgradeCost),
            productionPerSecond: Number(biz.productionPerSecond),
            lastClaimAt: String(biz.lastClaimAt),
          }
        : undefined,
      remainingCash: Number(res.remainingCash ?? 0),
      totalProductionPerSecond: Number(res.totalProductionPerSecond ?? 0),
    };
  }

  async getGameState(userId: string): Promise<Record<string, unknown>> {
    const res = (await this.rpc('empire_get_game_state', {
      p_user_id: userId,
    })) as Record<string, unknown> | null;

    return res ?? {};
  }

  async bindReferral(
    userId: string,
    referralCode: string,
    requestId: string,
  ): Promise<{
    success: boolean;
    error?: string | undefined;
    starterCashBoost: number;
  }> {
    const res = (await this.rpc('empire_bind_referral', {
      p_user_id: userId,
      p_referral_code: referralCode,
      p_request_id: requestId,
    })) as {
      success: boolean;
      error?: string;
      starterCashBoost: number;
    } | null;

    return {
      success: Boolean(res?.success),
      error: res?.error ? String(res.error) : undefined,
      starterCashBoost: Number(res?.starterCashBoost ?? 0),
    };
  }

  async getReferralStatus(userId: string): Promise<Record<string, unknown>> {
    const res = (await this.rpc('empire_get_referral_status', {
      p_user_id: userId,
    })) as Record<string, unknown> | null;

    return res ?? {};
  }

  async getActiveMissions(userId: string): Promise<unknown[]> {
    const res = (await this.rpc('empire_get_active_missions', {
      p_user_id: userId,
    })) as unknown[] | null;

    return res ?? [];
  }

  async claimMission(
    userId: string,
    missionInstanceId: string,
    requestId: string,
  ): Promise<Record<string, unknown>> {
    const res = (await this.rpc('empire_claim_mission', {
      p_user_id: userId,
      p_mission_instance_id: missionInstanceId,
      p_request_id: requestId,
    })) as Record<string, unknown> | null;

    return res ?? {};
  }

  async getStreak(userId: string): Promise<Record<string, unknown>> {
    const res = (await this.rpc('empire_get_streak', {
      p_user_id: userId,
    })) as Record<string, unknown> | null;

    return res ?? {};
  }

  async claimStreak(
    userId: string,
    requestId?: string,
  ): Promise<Record<string, unknown>> {
    const res = (await this.rpc('empire_claim_streak', {
      p_user_id: userId,
      p_request_id: requestId ?? null,
    })) as Record<string, unknown> | null;

    return res ?? {};
  }

  async claimReferralReward(
    userId: string,
    eventId: string,
    requestId?: string,
  ): Promise<Record<string, unknown>> {
    const res = (await this.rpc('empire_claim_referral_reward', {
      p_referrer_user_id: userId,
      p_event_id: eventId,
      p_request_id: requestId ?? null,
    })) as Record<string, unknown> | null;

    return res ?? {};
  }

  async assignDailyMissions(
    userId: string,
    targetDate?: string,
  ): Promise<Record<string, unknown>> {
    const res = (await this.rpc('empire_assign_daily_missions', {
      p_user_id: userId,
      p_target_date: targetDate ?? new Date().toISOString().slice(0, 10),
    })) as Record<string, unknown> | null;

    return res ?? {};
  }

  async incrementMissionProgress(
    userId: string,
    actionKey: string,
    increment = 1,
  ): Promise<Record<string, unknown>> {
    const res = (await this.rpc('empire_increment_mission_progress', {
      p_user_id: userId,
      p_action_key: actionKey,
      p_increment: increment,
    })) as Record<string, unknown> | null;

    return res ?? {};
  }

  async evaluateReferralMilestones(
    inviteeUserId: string,
  ): Promise<Record<string, unknown>> {
    const res = (await this.rpc('empire_evaluate_referral_milestones', {
      p_invitee_user_id: inviteeUserId,
    })) as Record<string, unknown> | null;

    return res ?? {};
  }
}
