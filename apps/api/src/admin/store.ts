export interface FeatureFlagsMap {
  'feature.stars_payments': boolean;
  'feature.maintenance_mode': boolean;
  'feature.referrals': boolean;
  'economy.multiplier': number;
  [key: string]: unknown;
}

export interface AdminAuditLogEntry {
  id: string;
  adminUserId: string | null;
  adminUsername: string | null;
  action: string;
  targetType: string;
  targetKey: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string | null;
  createdAt: string;
}

export interface FlaggedAccountDto {
  userId: string;
  telegramId: string;
  username: string | null;
  firstName: string;
  riskScore: number;
  status: string;
  pendingFlagsCount: number;
  frozenRewardsCount: number;
  totalFrozenCash: number;
  totalFrozenSeasonPoints: number;
  highestSeverity: string;
  createdAt: string;
}

export interface UnfreezeAccountResult {
  success: boolean;
  userId?: string;
  status?: string;
  unfrozenRewardsCount?: number;
  creditedCash?: number;
  creditedSeasonPoints?: number;
  reviewedAt?: string;
  error?: string;
}

export interface UpdateConfigOrFlagResult {
  success: boolean;
  key: string;
  updatedValue: unknown;
  auditLogId: string;
  error?: string;
}

export interface AdminStore {
  checkSuperadminRole(userId: string): Promise<boolean>;
  getFeatureFlags(): Promise<FeatureFlagsMap>;
  updateConfigOrFlag(params: {
    key: string;
    value: unknown;
    adminUserId?: string | undefined;
    reason?: string | undefined;
    requestId?: string | undefined;
    adminUsername?: string | undefined;
  }): Promise<UpdateConfigOrFlagResult>;
  getAuditLogs(params?: {
    limit?: number | undefined;
    offset?: number | undefined;
    targetKey?: string | undefined;
  }): Promise<{ logs: AdminAuditLogEntry[]; total: number }>;
  getFlaggedAccounts(params?: {
    limit?: number | undefined;
    offset?: number | undefined;
  }): Promise<{ accounts: FlaggedAccountDto[]; total: number }>;
  unfreezeAccount(params: {
    targetUserId: string;
    adminUserId?: string | undefined;
    reason?: string | undefined;
    requestId?: string | undefined;
    adminUsername?: string | undefined;
  }): Promise<UnfreezeAccountResult>;
}

export class SupabaseAdminStore implements AdminStore {
  private readonly fetcher: typeof fetch;
  constructor(
    private readonly url: string,
    private readonly serviceKey: string,
    fetcher: typeof fetch = fetch,
  ) {
    this.fetcher = (...args: Parameters<typeof fetch>) => fetcher(...args);
  }

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
      redirect: 'manual',
    });
    if (!response.ok) {
      throw new Error(
        `Database RPC ${name} failed with status ${response.status}`,
      );
    }
    return response.json();
  }

  async checkSuperadminRole(userId: string): Promise<boolean> {
    try {
      const data = await this.rpc('empire_admin_check_role', {
        p_user_id: userId,
        p_required_role: 'superadmin',
      });
      return Boolean(data);
    } catch {
      return false;
    }
  }

  async getFeatureFlags(): Promise<FeatureFlagsMap> {
    const raw = (await this.rpc('empire_config_get', {}).catch(
      () => ({}),
    )) as Record<string, unknown>;
    return {
      'feature.stars_payments': Boolean(raw['feature.stars_payments'] ?? false),
      'feature.maintenance_mode': Boolean(
        raw['feature.maintenance_mode'] ?? false,
      ),
      'feature.referrals':
        raw['feature.referrals'] === undefined
          ? true
          : Boolean(raw['feature.referrals']),
      'economy.multiplier':
        typeof raw['economy.multiplier'] === 'number'
          ? raw['economy.multiplier']
          : 1.0,
      ...raw,
    };
  }

  async updateConfigOrFlag(params: {
    key: string;
    value: unknown;
    adminUserId?: string;
    reason?: string;
    requestId?: string;
    adminUsername?: string;
  }): Promise<UpdateConfigOrFlagResult> {
    const data = (await this.rpc('empire_admin_update_config', {
      p_key: params.key,
      p_value: params.value,
      p_admin_user_id: params.adminUserId ?? null,
      p_reason: params.reason ?? null,
      p_request_id: params.requestId ?? null,
      p_admin_username: params.adminUsername ?? null,
    })) as UpdateConfigOrFlagResult;

    if (data.error) {
      throw new Error(data.error);
    }
    return data;
  }

  async getAuditLogs(params?: {
    limit?: number;
    offset?: number;
    targetKey?: string;
  }): Promise<{ logs: AdminAuditLogEntry[]; total: number }> {
    const data = (await this.rpc('empire_admin_get_audit_logs', {
      p_limit: params?.limit ?? 50,
      p_offset: params?.offset ?? 0,
      p_target_key: params?.targetKey ?? null,
    })) as { logs?: AdminAuditLogEntry[]; total?: number };

    return {
      logs: data.logs ?? [],
      total: data.total ?? 0,
    };
  }

  async getFlaggedAccounts(params?: {
    limit?: number;
    offset?: number;
  }): Promise<{ accounts: FlaggedAccountDto[]; total: number }> {
    const data = (await this.rpc('empire_admin_get_flagged_accounts', {
      p_limit: params?.limit ?? 50,
      p_offset: params?.offset ?? 0,
    })) as { accounts?: FlaggedAccountDto[]; total?: number };

    return {
      accounts: data.accounts ?? [],
      total: data.total ?? 0,
    };
  }

  async unfreezeAccount(params: {
    targetUserId: string;
    adminUserId?: string;
    reason?: string;
    requestId?: string;
    adminUsername?: string;
  }): Promise<UnfreezeAccountResult> {
    const data = (await this.rpc('empire_admin_unfreeze_account', {
      p_target_user_id: params.targetUserId,
      p_admin_user_id: params.adminUserId ?? null,
      p_notes: params.reason ?? 'Account unfreeze by admin',
      p_request_id: params.requestId ?? null,
      p_admin_username: params.adminUsername ?? null,
    })) as UnfreezeAccountResult;

    return data;
  }
}
