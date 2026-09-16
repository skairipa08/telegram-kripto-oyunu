import type { AdminFraudFlagDto, AdminFrozenRewardDto } from '@empire/shared';

export interface AdminFraudReviewResult {
  success?: boolean | undefined;
  error?: string | undefined;
  decision?: ('approved' | 'rejected') | undefined;
  frozenRewardId?: string | undefined;
  creditedCash?: number | undefined;
  creditedSeasonPoints?: number | undefined;
  canceledCash?: number | undefined;
  canceledSeasonPoints?: number | undefined;
  newCash?: number | undefined;
  newSeasonPoints?: number | undefined;
  reviewedAt?: string | undefined;
  currentStatus?: string | undefined;
}

export interface GetFraudFlagsParams {
  status?: string | undefined;
  userId?: string | undefined;
  severity?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface GetFrozenRewardsParams {
  status?: string | undefined;
  userId?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface ReviewRewardParams {
  rewardId: string;
  adminUserId: string;
  decision: 'approve' | 'reject';
  reason: string;
}

export interface ReviewFlagParams {
  flagId: string;
  adminUserId: string;
  decision: string;
  notes: string;
}

export interface CreateFraudFlagParams {
  userId: string;
  targetType: string;
  targetId: string;
  riskScore: number;
  reasonCodes: string[];
  severity?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface FreezeRewardParams {
  userId: string;
  rewardType: string;
  amountCash: number;
  amountSeasonPoints: number;
  freezeReason: string;
  fraudFlagId?: string | undefined;
  sourceRefId?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface AssignAdminRoleParams {
  targetUserId: string;
  role: string;
  assignedBy?: string | undefined;
}

export interface FraudStore {
  checkAdminRole(userId: string, requiredRole?: string): Promise<boolean>;
  getFraudFlags(
    params?: GetFraudFlagsParams,
  ): Promise<{ flags: AdminFraudFlagDto[]; total: number }>;
  getFrozenRewards(
    params?: GetFrozenRewardsParams,
  ): Promise<{ rewards: AdminFrozenRewardDto[]; total: number }>;
  reviewReward(params: ReviewRewardParams): Promise<AdminFraudReviewResult>;
  reviewFlag(params: ReviewFlagParams): Promise<unknown>;
  createFraudFlag(params: CreateFraudFlagParams): Promise<unknown>;
  freezeReward(params: FreezeRewardParams): Promise<unknown>;
  assignAdminRole(params: AssignAdminRoleParams): Promise<unknown>;
}

export class SupabaseFraudStore implements FraudStore {
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

  async checkAdminRole(
    userId: string,
    requiredRole: string = 'admin',
  ): Promise<boolean> {
    const data = await this.rpc('empire_admin_check_role', {
      p_user_id: userId,
      p_required_role: requiredRole,
    });
    return Boolean(data);
  }

  async getFraudFlags(
    params: GetFraudFlagsParams = {},
  ): Promise<{ flags: AdminFraudFlagDto[]; total: number }> {
    const data = (await this.rpc('empire_admin_get_fraud_flags', {
      p_status: params.status ?? null,
      p_user_id: params.userId ?? null,
      p_severity: params.severity ?? null,
      p_limit: params.limit ?? 50,
      p_offset: params.offset ?? 0,
    })) as { flags?: AdminFraudFlagDto[]; total?: number };

    return {
      flags: data.flags ?? [],
      total: data.total ?? 0,
    };
  }

  async getFrozenRewards(
    params: GetFrozenRewardsParams = {},
  ): Promise<{ rewards: AdminFrozenRewardDto[]; total: number }> {
    const data = (await this.rpc('empire_admin_get_frozen_rewards', {
      p_status: params.status ?? 'frozen',
      p_user_id: params.userId ?? null,
      p_limit: params.limit ?? 50,
      p_offset: params.offset ?? 0,
    })) as { rewards?: AdminFrozenRewardDto[]; total?: number };

    return {
      rewards: data.rewards ?? [],
      total: data.total ?? 0,
    };
  }

  async reviewReward(
    params: ReviewRewardParams,
  ): Promise<AdminFraudReviewResult> {
    const data = (await this.rpc('empire_admin_review_reward', {
      p_frozen_reward_id: params.rewardId,
      p_admin_user_id: params.adminUserId,
      p_decision: params.decision,
      p_notes: params.reason,
    })) as AdminFraudReviewResult;

    return data;
  }

  async reviewFlag(params: ReviewFlagParams): Promise<unknown> {
    return this.rpc('empire_admin_review_flag', {
      p_flag_id: params.flagId,
      p_admin_user_id: params.adminUserId,
      p_decision: params.decision,
      p_notes: params.notes,
    });
  }

  async createFraudFlag(params: CreateFraudFlagParams): Promise<unknown> {
    return this.rpc('empire_fraud_create_flag', {
      p_user_id: params.userId,
      p_target_type: params.targetType,
      p_target_id: params.targetId,
      p_risk_score: params.riskScore,
      p_reason_codes: params.reasonCodes,
      p_severity: params.severity ?? null,
      p_metadata: params.metadata ?? {},
    });
  }

  async freezeReward(params: FreezeRewardParams): Promise<unknown> {
    return this.rpc('empire_fraud_freeze_reward', {
      p_user_id: params.userId,
      p_reward_type: params.rewardType,
      p_amount_cash: params.amountCash,
      p_amount_season_points: params.amountSeasonPoints,
      p_freeze_reason: params.freezeReason,
      p_fraud_flag_id: params.fraudFlagId ?? null,
      p_source_ref_id: params.sourceRefId ?? null,
      p_metadata: params.metadata ?? {},
    });
  }

  async assignAdminRole(params: AssignAdminRoleParams): Promise<unknown> {
    return this.rpc('empire_admin_assign_role', {
      p_target_user_id: params.targetUserId,
      p_role: params.role,
      p_assigned_by: params.assignedBy ?? null,
    });
  }
}
