export type GameTab =
  'empire' | 'arcade' | 'missions' | 'friends' | 'leaderboard' | 'shop';
export type ScreenResource<T> = {
  status: 'loading' | 'ready' | 'error' | 'unavailable';
  data: T | null;
  onRetry?: (() => void) | undefined;
};
export type BusinessView = {
  slug: string;
  name: string;
  level: number;
  production: number;
  upgradeCost: number;
  paybackSeconds: number | null;
  recommended: boolean;
};
export type EmpireView = {
  cash: number;
  seasonPoints: number | null;
  production: number;
  claimable: number | null;
  offlineHours: number;
  businesses: BusinessView[];
};
export type MissionView = {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'normal' | 'hard' | 'weekly' | 'lifetime';
  progress: number;
  target: number;
  reward: number;
  status: 'in_progress' | 'completed' | 'claimed';
};
export type MissionsView = { streak: number; missions: MissionView[] };
export type InviteeMilestoneView = {
  targetCash: number;
  rewardCash: number;
  label: string;
  completed: boolean;
  claimed: boolean;
};

export type FriendsView = {
  link: string;
  totalInvites: number;
  qualified: number;
  earnedPoints: number;
  totalKickbackCashEarned?: number;
  unclaimedKickbackCash?: number;
  commissionRatePercent?: number;
  inviteeMilestones?: InviteeMilestoneView[];
  friends:
    { name: string; initial: string; stage: string; days: number }[] | null;
};
export type LeaderboardView = {
  scope: 'global' | 'friends';
  seasonName: string;
  entries: {
    rank: number;
    userId: string;
    name: string;
    points: number;
    isYou: boolean;
  }[];
  ownRank: number | null;
  ownPoints: number;
  total: number;
  hasMore: boolean;
};
export type ShopView = {
  passActive: boolean;
  expiresAt: string | null;
  products: {
    sku: string;
    name: string;
    description: string;
    price: number;
    type: 'convenience_pass' | 'cosmetic';
    durationDays: number | null;
  }[];
};
export type AnalyticsView = {
  activation: number;
  payerConversion: number;
  revenue: number;
  arppu: number;
  cohorts: { date: string; signups: number; d1: number; d7: number }[];
};
