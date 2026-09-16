import { ApiError } from '../api/client';
import type {
  AdminAuditLogDto,
  AdminFraudFlagDto,
  AdminFrozenRewardDto,
  PublicConfigResponse,
  UpdateConfigResponse,
} from '@empire/shared';
import type {
  AuditLogView,
  FeatureFlagItem,
  FraudAccountView,
  FrozenRewardView,
} from './admin-types';

async function parseApiError(response: Response): Promise<never> {
  let code = 'ADMIN_API_ERROR';
  try {
    const json = (await response.json()) as { error?: { code?: string } };
    if (json?.error?.code) code = json.error.code;
  } catch {
    /* Ignore parse error */
  }
  throw new ApiError(response.status, code);
}

export async function fetchPublicConfig(
  signal?: AbortSignal,
): Promise<PublicConfigResponse> {
  const timeout = AbortSignal.timeout(8000);
  const res = await fetch('/api/config/public', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!res.ok) await parseApiError(res);
  return res.json() as Promise<PublicConfigResponse>;
}

export async function updateFeatureFlag(
  key: string,
  value: boolean | number | string,
  reason: string,
  requestId: string = crypto.randomUUID(),
): Promise<UpdateConfigResponse> {
  const timeout = AbortSignal.timeout(8000);
  const res = await fetch('/api/admin/config', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ key, value, reason, requestId }),
    signal: timeout,
  });
  if (!res.ok) await parseApiError(res);
  return res.json() as Promise<UpdateConfigResponse>;
}

export async function fetchFraudFlags(
  params?: { status?: string; limit?: number },
  signal?: AbortSignal,
): Promise<{ flags: AdminFraudFlagDto[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.limit) query.set('limit', String(params.limit));

  const path = `/api/admin/fraud/flags${query.toString() ? `?${query}` : ''}`;
  const timeout = AbortSignal.timeout(8000);
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!res.ok) await parseApiError(res);
  return res.json() as Promise<{ flags: AdminFraudFlagDto[]; total: number }>;
}

export async function fetchFrozenRewards(
  params?: { status?: string; limit?: number },
  signal?: AbortSignal,
): Promise<{ rewards: AdminFrozenRewardDto[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.limit) query.set('limit', String(params.limit));

  const path = `/api/admin/fraud/frozen${query.toString() ? `?${query}` : ''}`;
  const timeout = AbortSignal.timeout(8000);
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!res.ok) await parseApiError(res);
  return res.json() as Promise<{
    rewards: AdminFrozenRewardDto[];
    total: number;
  }>;
}

export async function submitFraudReview(
  rewardId: string,
  decision: 'approve' | 'reject',
  reason: string,
): Promise<{ success: boolean; decision: string }> {
  const timeout = AbortSignal.timeout(8000);
  const res = await fetch('/api/admin/fraud/review', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ rewardId, decision, reason }),
    signal: timeout,
  });
  if (!res.ok) await parseApiError(res);
  return res.json() as Promise<{ success: boolean; decision: string }>;
}

export async function fetchAuditLogs(
  params?: { limit?: number; offset?: number },
  signal?: AbortSignal,
): Promise<{ logs: AdminAuditLogDto[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset) query.set('offset', String(params.offset));

  const path = `/api/admin/audit-logs${query.toString() ? `?${query}` : ''}`;
  const timeout = AbortSignal.timeout(8000);
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!res.ok) await parseApiError(res);
  return res.json() as Promise<{ logs: AdminAuditLogDto[]; total: number }>;
}

/**
 * Standard seed catalog for feature flags with their human-readable metadata.
 */
export const DEFAULT_FEATURE_FLAGS: FeatureFlagItem[] = [
  {
    key: 'feature.stars_payments',
    label: 'Telegram Stars (XTR) Ödemeleri',
    description:
      'Oyuncuların mağazadan Telegram Yıldızları ile Kolaylık Bileti ve ürün satın almasını kontrol eder.',
    enabled: true,
    category: 'monetization',
  },
  {
    key: 'feature.maintenance_mode',
    label: 'Bakım Modu (Acil Durum Kilidi)',
    description:
      'Tüm oyuncu işlemlerini (nakit toplama, işletme yükseltme) geçici olarak durdurur ve genel bakım bildirimi gösterir.',
    enabled: false,
    category: 'system',
  },
  {
    key: 'feature.referrals',
    label: 'Davet Sistemi ve Ödülleri',
    description:
      'Yeni davet bağlantısı oluşturma, referans bağlama ve aşama bazlı referans ödüllerini aktif veya pasif yapar.',
    enabled: true,
    category: 'social',
  },
  {
    key: 'feature.token',
    label: 'Token ve Airdrop Modülü',
    description:
      'Gelecek faz token tahsis ve airdrop hazırlık modülü (varsayılan: Devre Dışı).',
    enabled: false,
    category: 'web3',
  },
];

/**
 * Maps raw backend fraud flags and user details into view models.
 */
export function mapFraudFlagToView(flag: AdminFraudFlagDto): FraudAccountView {
  return {
    id: flag.id,
    userId: flag.userId,
    telegramId: flag.user?.telegramId ?? 'Bilinmiyor',
    username: flag.user?.username ?? null,
    firstName: flag.user?.firstName ?? 'Oyuncu',
    riskScore: flag.riskScore,
    reasonCodes: flag.reasonCodes,
    severity: flag.severity,
    status: flag.status,
    createdAt: flag.createdAt,
    metadata: flag.metadata,
  };
}

/**
 * Maps raw backend frozen rewards into view models.
 */
export function mapFrozenRewardToView(
  reward: AdminFrozenRewardDto,
): FrozenRewardView {
  return {
    id: reward.id,
    userId: reward.userId,
    telegramId: reward.user?.telegramId ?? 'Bilinmiyor',
    username: reward.user?.username ?? null,
    firstName: reward.user?.firstName ?? 'Oyuncu',
    rewardType: reward.rewardType,
    amountCash: reward.amountCash,
    amountSeasonPoints: reward.amountSeasonPoints,
    status: reward.status,
    freezeReason: reward.freezeReason,
    frozenAt: reward.frozenAt,
    reviewedBy: reward.reviewedBy,
    reviewedAt: reward.reviewedAt,
    reviewNotes: reward.reviewNotes,
  };
}

/**
 * Maps raw backend audit logs into view models.
 */
export function mapAuditLogToView(log: AdminAuditLogDto): AuditLogView {
  return {
    id: log.id,
    adminUserId: log.adminUserId,
    action: log.action,
    targetType: log.targetType,
    targetKey: log.targetKey,
    oldValue: log.oldValue,
    newValue: log.newValue,
    reason: log.reason,
    createdAt: log.createdAt,
  };
}
