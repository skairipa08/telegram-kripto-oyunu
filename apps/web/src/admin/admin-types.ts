export type AdminTab = 'flags' | 'fraud' | 'audit';

export type FeatureFlagKey =
  | 'feature.stars_payments'
  | 'feature.maintenance_mode'
  | 'feature.referrals'
  | 'feature.token'
  | string;

export interface FeatureFlagItem {
  key: FeatureFlagKey;
  label: string;
  description: string;
  enabled: boolean;
  category: 'monetization' | 'system' | 'social' | 'web3';
}

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface FraudAccountView {
  id: string;
  userId: string;
  telegramId: string;
  username: string | null;
  firstName: string;
  riskScore: number;
  reasonCodes: string[];
  severity: RiskSeverity;
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed';
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface FrozenRewardView {
  id: string;
  userId: string;
  telegramId: string;
  username: string | null;
  firstName: string;
  rewardType: string;
  amountCash: number;
  amountSeasonPoints: number;
  status: 'frozen' | 'approved' | 'rejected';
  freezeReason: string;
  frozenAt: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
}

export interface AuditLogView {
  id: string;
  adminUserId: string | null;
  adminUsername?: string;
  action: string;
  targetType: string;
  targetKey: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string | null;
  createdAt: string;
}

export interface FraudSummaryMetrics {
  pendingReviews: number;
  highRiskCount: number;
  totalFrozenCash: number;
  totalFrozenPoints: number;
}
