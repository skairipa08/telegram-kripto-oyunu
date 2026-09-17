import {
  calculateUpgradeCost,
  calculateProductionPerSecond,
  DEFAULT_BUSINESSES,
  calculateReferralKickback,
  evaluateInviteeCashMilestones,
  getReferralCommissionRate,
  getUnlockedReferralBadges,
  INVITEE_CASH_MILESTONES,
} from '@empire/game-core';
import { SESSION_SECONDS, type TelegramUser } from './auth/crypto';
import type { AuthStore, LoginResult, StoredSession } from './auth/store';
import type {
  EconomyStore,
  EconomyPlayerState,
  EconomyPlayerBusiness,
} from './economy/store';
import type {
  LeaderboardStore,
  LeaderboardSeasonInfo,
  FreezeSeasonResult,
} from './leaderboard/store';
import type { RawScoreEntry } from '@empire/game-core';
import type {
  ShopStore,
  UserPassStatus,
  CreatedInvoice,
  FulfillPaymentResult,
  InvoiceRecord,
} from './shop/store';
import type { ConfigStore, UpdateConfigResult } from './config/store';
import type { AnalyticsStore, AnalyticsMetricsRaw } from './analytics/store';
import type {
  TrackAnalyticsEventItem,
  AdminFraudFlagDto,
  AdminFrozenRewardDto,
} from '@empire/shared';
import type {
  FraudStore,
  AdminFraudReviewResult,
  GetFraudFlagsParams,
  GetFrozenRewardsParams,
  ReviewRewardParams,
  ReviewFlagParams,
  CreateFraudFlagParams,
  FreezeRewardParams,
  AssignAdminRoleParams,
} from './fraud/store';
import type {
  AdminStore,
  FeatureFlagsMap,
  AdminAuditLogEntry,
  FlaggedAccountDto,
  UnfreezeAccountResult,
  UpdateConfigOrFlagResult,
} from './admin/store';

// ============================================================================
// 1. In-Memory Auth Store
// ============================================================================
export class MemoryAuthStore implements AuthStore {
  private sessions = new Map<string, StoredSession>();
  private telegramUsers = new Map<string, string>(); // telegramId -> userId

  async login(
    user: TelegramUser,
    _fingerprint: string,
    _requestHash: string,
    authDate: number,
  ): Promise<LoginResult> {
    void _fingerprint;
    void _requestHash;
    const telegramIdStr = String(user.id);
    let userId = this.telegramUsers.get(telegramIdStr);
    if (!userId) {
      const padded = telegramIdStr.padStart(12, '0').slice(-12);
      userId = `00000000-0000-4000-a000-${padded}`;
      this.telegramUsers.set(telegramIdStr, userId);
    }

    const sid = crypto.randomUUID();
    const issuedAt = authDate || Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + SESSION_SECONDS;

    const session: StoredSession = {
      sid,
      issuedAt,
      expiresAt,
      user: {
        id: userId,
        telegramId: telegramIdStr,
        firstName: user.first_name,
        username: user.username ?? null,
        language: user.language_code ?? 'tr',
      },
    };

    this.sessions.set(sid, session);
    return { outcome: 'ok', session };
  }

  async getSession(sid: string): Promise<StoredSession | null> {
    return this.sessions.get(sid) ?? null;
  }

  async revoke(sid: string): Promise<void> {
    this.sessions.delete(sid);
  }
}

// ============================================================================
// 2. In-Memory Economy Store
// ============================================================================
interface PlayerEconomyData {
  cash: number;
  seasonPoints: number;
  hasConveniencePass: boolean;
  businesses: EconomyPlayerBusiness[];
  streak: {
    currentStreak: number;
    lastClaimDate: string | null;
  };
  claimedMissions: Set<string>;
  totalLifetimeEarnedCash: number;
  referralKickbackBalance: number;
  totalKickbackCashEarned: number;
  claimedMilestoneTargets: Set<number>;
  referrals: {
    referrerId: string | null;
    inviteeCount: number;
    invitees: string[];
  };
  requestCache: Map<string, unknown>;
}

export class MemoryEconomyStore implements EconomyStore {
  private players = new Map<string, PlayerEconomyData>();

  private findByReferralCode(
    code: string,
  ): { userId: string; data: PlayerEconomyData } | null {
    const cleanCode = code.toUpperCase().trim();
    for (const [id, p] of this.players.entries()) {
      if (`REF_${id.slice(0, 8)}`.toUpperCase() === cleanCode || id === code) {
        return { userId: id, data: p };
      }
    }
    return null;
  }

  processInviteeEarnings(inviteeUserId: string, earnedCash: number) {
    if (earnedCash <= 0) return;
    const invitee = this.getOrCreate(inviteeUserId);
    invitee.totalLifetimeEarnedCash =
      (invitee.totalLifetimeEarnedCash ?? 0) + earnedCash;

    if (!invitee.referrals.referrerId) return;
    const referrerEntry = this.findByReferralCode(invitee.referrals.referrerId);
    if (!referrerEntry) return;

    const referrer = referrerEntry.data;
    // 1. Direct Kickback = 0.1% (1/1000) of earned cash
    const kickback = calculateReferralKickback(earnedCash);
    if (kickback > 0) {
      referrer.referralKickbackBalance =
        (referrer.referralKickbackBalance ?? 0) + kickback;
      referrer.totalKickbackCashEarned =
        (referrer.totalKickbackCashEarned ?? 0) + kickback;
    }

    // 2. Cumulative milestone bonuses (100K -> 100, 1M -> 1,000, 10M -> 10,000, etc.)
    if (!invitee.claimedMilestoneTargets) {
      invitee.claimedMilestoneTargets = new Set();
    }
    const newlyReached = evaluateInviteeCashMilestones(
      invitee.totalLifetimeEarnedCash,
      Array.from(invitee.claimedMilestoneTargets),
    );
    for (const m of newlyReached) {
      invitee.claimedMilestoneTargets.add(m.targetCash);
      referrer.referralKickbackBalance =
        (referrer.referralKickbackBalance ?? 0) + m.rewardCash;
      referrer.totalKickbackCashEarned =
        (referrer.totalKickbackCashEarned ?? 0) + m.rewardCash;
    }
  }

  private getOrCreate(userId: string): PlayerEconomyData {
    let p = this.players.get(userId);
    if (!p) {
      const now = new Date().toISOString();
      const businesses: EconomyPlayerBusiness[] = DEFAULT_BUSINESSES.map(
        (b, index) => ({
          slug: b.id,
          name: b.name,
          level: index === 0 ? 1 : 0, // First business is unlocked at level 1
          baseCost: b.baseCost,
          baseIncome: b.baseIncome,
          sortOrder: b.order,
          lastClaimAt: now,
        }),
      );

      p = {
        cash: 10_000,
        seasonPoints: 500,
        hasConveniencePass: false,
        businesses,
        streak: {
          currentStreak: 1,
          lastClaimDate: null,
        },
        claimedMissions: new Set(),
        totalLifetimeEarnedCash: 10_000,
        referralKickbackBalance: 0,
        totalKickbackCashEarned: 0,
        claimedMilestoneTargets: new Set(),
        referrals: {
          referrerId: null,
          inviteeCount: 0,
          invitees: [],
        },
        requestCache: new Map(),
      };
      this.players.set(userId, p);
    }
    return p;
  }

  async getPlayerState(userId: string): Promise<EconomyPlayerState> {
    const p = this.getOrCreate(userId);
    return {
      cash: p.cash,
      seasonPoints: p.seasonPoints,
      hasConveniencePass: p.hasConveniencePass,
      businesses: p.businesses,
    };
  }

  async initPlayerEconomy(
    userId: string,
    isReferred = false,
  ): Promise<{ success: boolean; cash: number; isReferred: boolean }> {
    const p = this.getOrCreate(userId);
    if (isReferred) {
      p.cash += 5000;
    }
    return { success: true, cash: p.cash, isReferred };
  }

  async claimOfflineEarnings(
    userId: string,
    requestId: string,
  ): Promise<{
    error?: string;
    replayed?: boolean;
    claimedAmount: number;
    newBalance: number;
    claimedAt: string;
    isCapped: boolean;
  }> {
    const p = this.getOrCreate(userId);
    const cached = p.requestCache.get(requestId) as
      | {
          claimedAmount: number;
          newBalance: number;
          claimedAt: string;
          isCapped: boolean;
        }
      | undefined;
    if (cached) return { ...cached, replayed: true };

    let totalDps = 0;
    for (const b of p.businesses) {
      if (b.level > 0) {
        totalDps += calculateProductionPerSecond(b.baseIncome, b.level);
      }
    }

    const claimedAmount = Math.max(100, Math.floor(totalDps * 60));
    p.cash += claimedAmount;
    this.processInviteeEarnings(userId, claimedAmount);
    const nowStr = new Date().toISOString();
    for (const b of p.businesses) {
      b.lastClaimAt = nowStr;
    }

    const res = {
      claimedAmount,
      newBalance: p.cash,
      claimedAt: nowStr,
      isCapped: false,
    };
    p.requestCache.set(requestId, res);
    return res;
  }

  async upgradeBusiness(
    userId: string,
    businessSlug: string,
    requestId?: string,
  ): Promise<{
    error?: string;
    replayed?: boolean;
    business?: {
      slug: string;
      name: string;
      level: number;
      baseCost: number;
      baseIncome: number;
      upgradeCost: number;
      productionPerSecond: number;
      lastClaimAt: string;
    };
    remainingCash?: number;
    totalProductionPerSecond?: number;
  }> {
    const p = this.getOrCreate(userId);
    if (requestId) {
      const cached = p.requestCache.get(requestId);
      if (cached) return { ...(cached as object), replayed: true };
    }

    const business = p.businesses.find((b) => b.slug === businessSlug);
    if (!business) {
      return { error: 'BUSINESS_NOT_FOUND' };
    }

    const upgradeCost = calculateUpgradeCost(business.baseCost, business.level);
    if (p.cash < upgradeCost) {
      return { error: 'INSUFFICIENT_FUNDS' };
    }

    p.cash -= upgradeCost;
    business.level += 1;
    business.lastClaimAt = new Date().toISOString();

    let totalDps = 0;
    for (const b of p.businesses) {
      if (b.level > 0) {
        totalDps += calculateProductionPerSecond(b.baseIncome, b.level);
      }
    }

    const result = {
      business: {
        slug: business.slug,
        name: business.name,
        level: business.level,
        baseCost: business.baseCost,
        baseIncome: business.baseIncome,
        upgradeCost: calculateUpgradeCost(business.baseCost, business.level),
        productionPerSecond: calculateProductionPerSecond(
          business.baseIncome,
          business.level,
        ),
        lastClaimAt: business.lastClaimAt,
      },
      remainingCash: p.cash,
      totalProductionPerSecond: totalDps,
    };

    if (requestId) {
      p.requestCache.set(requestId, result);
    }
    return result;
  }

  async getGameState(userId: string): Promise<Record<string, unknown>> {
    const p = this.getOrCreate(userId);
    let totalDps = 0;
    for (const b of p.businesses) {
      if (b.level > 0) {
        totalDps += calculateProductionPerSecond(b.baseIncome, b.level);
      }
    }

    return {
      cash: p.cash,
      seasonPoints: p.seasonPoints,
      totalProductionPerSecond: totalDps,
      offlineCapSeconds: p.hasConveniencePass ? 28800 : 14400,
      businesses: p.businesses,
      referralCode: `REF_${userId.slice(0, 8)}`,
    };
  }

  async bindReferral(
    userId: string,
    referralCode: string,
    requestId: string,
  ): Promise<{
    success: boolean;
    error?: string;
    starterCashBoost: number;
  }> {
    void requestId;
    const p = this.getOrCreate(userId);
    if (p.referrals.referrerId) {
      return {
        success: false,
        error: 'ALREADY_REFERRED',
        starterCashBoost: 0,
      };
    }
    p.referrals.referrerId = referralCode;
    p.cash += 5000;
    this.processInviteeEarnings(userId, 5000);

    const ref = this.findByReferralCode(referralCode);
    if (ref) {
      ref.data.referrals.inviteeCount += 1;
      if (!ref.data.referrals.invitees.includes(userId)) {
        ref.data.referrals.invitees.push(userId);
      }
      ref.data.cash += 5000;
    }

    return { success: true, starterCashBoost: 5000 };
  }

  async getReferralStatus(userId: string): Promise<Record<string, unknown>> {
    const p = this.getOrCreate(userId);
    const rate = getReferralCommissionRate(p.referrals.inviteeCount);

    let maxInviteeCash = 0;
    for (const invId of p.referrals.invitees) {
      const inv = this.players.get(invId);
      if (inv && (inv.totalLifetimeEarnedCash ?? 0) > maxInviteeCash) {
        maxInviteeCash = inv.totalLifetimeEarnedCash;
      }
    }

    const inviteeMilestones = INVITEE_CASH_MILESTONES.map((m) => {
      const completed = maxInviteeCash >= m.targetCash;
      return {
        targetCash: m.targetCash,
        rewardCash: m.rewardCash,
        label: m.label,
        completed,
        claimed: completed,
      };
    });

    return {
      referralCode: `REF_${userId.slice(0, 8)}`,
      deepLink: `https://t.me/PemtokenBot?startapp=ref_REF_${userId.slice(0, 8)}`,
      totalInvites: p.referrals.inviteeCount,
      qualifiedCount: p.referrals.inviteeCount,
      totalEarnedPoints: p.seasonPoints,
      unlockedBadges: getUnlockedReferralBadges(p.referrals.inviteeCount).map(
        (b) => b.badgeKey,
      ),
      totalKickbackCashEarned: p.totalKickbackCashEarned ?? 0,
      unclaimedKickbackCash: p.referralKickbackBalance ?? 0,
      commissionRatePercent: Math.round(rate * 100),
      inviteeMilestones,
    };
  }

  async claimReferralKickback(
    userId: string,
    requestId?: string,
  ): Promise<{
    claimedCash: number;
    newCash: number;
    claimedAt: string;
  }> {
    void requestId;
    const p = this.getOrCreate(userId);
    const amount = p.referralKickbackBalance ?? 0;
    p.cash += amount;
    p.referralKickbackBalance = 0;
    return {
      claimedCash: amount,
      newCash: p.cash,
      claimedAt: new Date().toISOString(),
    };
  }

  async getActiveMissions(userId: string): Promise<unknown[]> {
    const p = this.getOrCreate(userId);
    const today = new Date().toISOString().slice(0, 10);
    const m1Id = '00000000-0000-4000-b000-000000000001';
    const m2Id = '00000000-0000-4000-b000-000000000002';
    const m3Id = '00000000-0000-4000-b000-000000000003';
    return [
      {
        id: m1Id,
        key: 'tap_10',
        difficulty: 'easy',
        title: '10 Kez Tıkla',
        description: 'Notcoin ekranında 10 tıklama yap.',
        progress: 10,
        target: 10,
        status: p.claimedMissions.has(m1Id) ? 'claimed' : 'completed',
        rewardPoints: 50,
        assignedDate: today,
        claimedAt: p.claimedMissions.has(m1Id)
          ? new Date().toISOString()
          : null,
      },
      {
        id: m2Id,
        key: 'upgrade_business',
        difficulty: 'normal',
        title: 'İlk İşletmeni Geliştir',
        description: 'Herhangi bir işletmenin seviyesini artır.',
        progress: 1,
        target: 1,
        status: p.claimedMissions.has(m2Id) ? 'claimed' : 'completed',
        rewardPoints: 100,
        assignedDate: today,
        claimedAt: p.claimedMissions.has(m2Id)
          ? new Date().toISOString()
          : null,
      },
      {
        id: m3Id,
        key: 'merge_boxes',
        difficulty: 'easy',
        title: 'Kutuları Birleştir',
        description: 'Birleştirme oyununda en az 3 birleştirme yap.',
        progress: 3,
        target: 3,
        status: p.claimedMissions.has(m3Id) ? 'claimed' : 'completed',
        rewardPoints: 75,
        assignedDate: today,
        claimedAt: p.claimedMissions.has(m3Id)
          ? new Date().toISOString()
          : null,
      },
    ];
  }

  async claimMission(
    userId: string,
    missionInstanceId: string,
    requestId: string,
  ): Promise<Record<string, unknown>> {
    void requestId;
    const p = this.getOrCreate(userId);
    p.claimedMissions.add(missionInstanceId);
    p.cash += 1000;
    p.seasonPoints += 100;
    return {
      success: true,
      claimedAt: new Date().toISOString(),
      rewardCash: 1000,
      rewardPoints: 100,
      rewardSeasonPoints: 100,
      newCash: p.cash,
      newSeasonPoints: p.seasonPoints,
    };
  }

  async getStreak(userId: string): Promise<Record<string, unknown>> {
    const p = this.getOrCreate(userId);
    return {
      currentStreak: p.streak.currentStreak,
      longestStreak: Math.max(p.streak.currentStreak, 1),
      canClaimToday: true,
      lastClaimDate: p.streak.lastClaimDate,
      todayRewardPoints: 50,
      isCycleBonusToday: p.streak.currentStreak % 7 === 0,
      streakMilestones: [
        { day: 7, cashReward: 500, pointsReward: 1.0, claimed: false },
        { day: 30, cashReward: 5000, pointsReward: 2.5, claimed: false },
        { day: 90, cashReward: 25000, pointsReward: 5.0, claimed: false },
        { day: 180, cashReward: 100000, pointsReward: 10.0, claimed: false },
        { day: 365, cashReward: 500000, pointsReward: 25.0, claimed: false },
      ],
    };
  }

  async claimStreak(
    userId: string,
    requestId?: string,
  ): Promise<Record<string, unknown>> {
    void requestId;
    const p = this.getOrCreate(userId);
    p.streak.currentStreak += 1;
    p.streak.lastClaimDate = new Date().toISOString();
    const rewardCash = 500 * p.streak.currentStreak;
    p.cash += rewardCash;
    return {
      success: true,
      currentStreak: p.streak.currentStreak,
      rewardCash,
      newCash: p.cash,
    };
  }

  async claimReferralReward(
    userId: string,
    eventId: string,
    requestId?: string,
  ): Promise<Record<string, unknown>> {
    void eventId;
    void requestId;
    const p = this.getOrCreate(userId);
    p.cash += 1000;
    return { success: true, claimedCash: 1000, newCash: p.cash };
  }

  async assignDailyMissions(userId: string, targetDate?: string) {
    void userId;
    void targetDate;
    return { success: true };
  }

  async incrementMissionProgress(
    userId: string,
    actionKey: string,
    increment = 1,
  ) {
    void userId;
    void actionKey;
    void increment;
    return { success: true };
  }

  async evaluateReferralMilestones(inviteeUserId: string) {
    void inviteeUserId;
    return { success: true };
  }
}

// ============================================================================
// 3. In-Memory Leaderboard Store
// ============================================================================
export class MemoryLeaderboardStore implements LeaderboardStore {
  async getActiveOrSpecifiedSeason(
    seasonId?: string,
  ): Promise<LeaderboardSeasonInfo | null> {
    return {
      id: seasonId ?? 'season-alpha-1',
      name: 'Sezon 1: İmparatorluk Başlangıcı',
      status: 'active',
      startsAt: new Date(Date.now() - 86400000 * 7).toISOString(),
      endsAt: new Date(Date.now() + 86400000 * 23).toISOString(),
      sruSnapshot: 1.0,
    };
  }

  async getScores(seasonId: string): Promise<RawScoreEntry[]> {
    void seasonId;
    const nowStr = new Date().toISOString();
    return [
      {
        userId: '00000000-0000-4000-a000-000000000001',
        firstName: 'Baran',
        username: 'Barandnz',
        points: 12500,
        missionPoints: 2500,
        referralPoints: 1000,
        updatedAt: nowStr,
      },
      {
        userId: '00000000-0000-4000-a000-000000000002',
        firstName: 'Berked',
        username: 'Mberked',
        points: 9800,
        missionPoints: 1800,
        referralPoints: 800,
        updatedAt: nowStr,
      },
      {
        userId: '00000000-0000-4000-a000-000000000003',
        firstName: 'Kripto Kralı',
        username: 'cryptoking',
        points: 6400,
        missionPoints: 1200,
        referralPoints: 400,
        updatedAt: nowStr,
      },
    ];
  }

  async getFriendUserIds(userId: string): Promise<string[]> {
    void userId;
    return ['00000000-0000-4000-a000-000000000002'];
  }

  async freezeSeason(
    seasonId: string,
    adminUserId?: string,
    reason?: string,
  ): Promise<FreezeSeasonResult> {
    void adminUserId;
    void reason;
    return {
      seasonId,
      status: 'frozen',
      frozenAt: new Date().toISOString(),
      archivedParticipantsCount: 50,
    };
  }
}

// ============================================================================
// 4. In-Memory Shop Store
// ============================================================================
export class MemoryShopStore implements ShopStore {
  private userPasses = new Map<string, boolean>();
  private invoices = new Map<string, InvoiceRecord>();

  async getUserPass(userId: string): Promise<UserPassStatus> {
    const isActive = this.userPasses.get(userId) ?? false;
    return {
      isActive,
      expiresAt: isActive
        ? new Date(Date.now() + 86400000 * 30).toISOString()
        : null,
    };
  }

  async createInvoice(
    userId: string,
    sku: string,
    requestId: string,
  ): Promise<CreatedInvoice> {
    const starsPrice = sku === 'pass_monthly' ? 250 : 50;
    const invoicePayload = `inv_${requestId}`;
    const invoice: InvoiceRecord = {
      id: crypto.randomUUID(),
      userId,
      sku,
      starsAmount: starsPrice,
      status: 'pending',
      telegramPaymentChargeId: null,
      invoicePayload,
      currency: 'XTR',
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    this.invoices.set(invoicePayload, invoice);
    return {
      sku,
      starsPrice,
      invoicePayload,
      invoiceLink: `https://t.me/$invoice_${requestId}`,
    };
  }

  async fulfillPayment(
    chargeId: string,
    invoicePayload: string,
    starsAmount: number,
    sku?: string,
  ): Promise<FulfillPaymentResult> {
    void starsAmount;
    void sku;
    const invoice = this.invoices.get(invoicePayload);
    if (invoice && invoice.status === 'completed') {
      return {
        success: true,
        duplicate: true,
        purchaseId: invoice.id,
        newPassExpiresAt: new Date(Date.now() + 86400000 * 30).toISOString(),
      };
    }

    if (invoice) {
      invoice.status = 'completed';
      invoice.telegramPaymentChargeId = chargeId;
      invoice.completedAt = new Date().toISOString();
      this.userPasses.set(invoice.userId, true);
    }

    const purchaseId = invoice?.id ?? crypto.randomUUID();
    return {
      success: true,
      duplicate: false,
      purchaseId,
      newPassExpiresAt: new Date(Date.now() + 86400000 * 30).toISOString(),
    };
  }

  async getInvoice(
    userId: string,
    invoiceIdOrPayload: string,
  ): Promise<InvoiceRecord | null> {
    void userId;
    return this.invoices.get(invoiceIdOrPayload) ?? null;
  }

  async findInvoiceByPayload(
    invoicePayload: string,
  ): Promise<InvoiceRecord | null> {
    return this.invoices.get(invoicePayload) ?? null;
  }
}

// ============================================================================
// 5. In-Memory Config Store
// ============================================================================
export class MemoryConfigStore implements ConfigStore {
  private config: Record<string, unknown> = {
    'feature.stars_payments': true,
    'feature.maintenance_mode': false,
    'feature.referrals': true,
    'economy.multiplier': 1.0,
  };

  async getConfig(): Promise<Record<string, unknown>> {
    return { ...this.config };
  }

  async updateConfig(
    key: string,
    value: unknown,
    adminUserId?: string,
    reason?: string,
    requestId?: string,
    adminUsername?: string,
  ): Promise<UpdateConfigResult> {
    void adminUserId;
    void reason;
    void requestId;
    void adminUsername;
    this.config[key] = value;
    return {
      success: true,
      key,
      updatedValue: value,
      auditLogId: crypto.randomUUID(),
    };
  }

  async checkAdminRole(
    userId: string,
    requiredRole = 'superadmin',
  ): Promise<boolean> {
    void userId;
    void requiredRole;
    return true;
  }
}

// ============================================================================
// 6. In-Memory Analytics Store
// ============================================================================
export class MemoryAnalyticsStore implements AnalyticsStore {
  async recordEvents(
    events: readonly TrackAnalyticsEventItem[],
    userId?: string | null,
    sessionId?: string | null,
  ): Promise<number> {
    void userId;
    void sessionId;
    return events.length;
  }

  async getCohortData() {
    return [];
  }

  async getMetrics(): Promise<AnalyticsMetricsRaw> {
    return {
      totalUsers: 24,
      payingUsers: 4,
      totalStarsRevenue: 1250,
      activatedUsers: 18,
    };
  }
}

// ============================================================================
// 7. In-Memory Fraud Store
// ============================================================================
export class MemoryFraudStore implements FraudStore {
  async checkAdminRole(
    userId: string,
    requiredRole?: string,
  ): Promise<boolean> {
    void userId;
    void requiredRole;
    return true;
  }

  async assignAdminRole(params: AssignAdminRoleParams): Promise<unknown> {
    void params;
    return { success: true };
  }

  async getFraudFlags(
    params?: GetFraudFlagsParams,
  ): Promise<{ flags: AdminFraudFlagDto[]; total: number }> {
    void params;
    return { flags: [], total: 0 };
  }

  async getFrozenRewards(
    params?: GetFrozenRewardsParams,
  ): Promise<{ rewards: AdminFrozenRewardDto[]; total: number }> {
    void params;
    return { rewards: [], total: 0 };
  }

  async reviewReward(
    params: ReviewRewardParams,
  ): Promise<AdminFraudReviewResult> {
    void params;
    return { success: true };
  }

  async reviewFlag(params: ReviewFlagParams): Promise<AdminFraudReviewResult> {
    void params;
    return { success: true };
  }

  async createFraudFlag(
    params: CreateFraudFlagParams,
  ): Promise<{ flagId?: string; success: boolean }> {
    void params;
    return { flagId: crypto.randomUUID(), success: true };
  }

  async freezeReward(
    params: FreezeRewardParams,
  ): Promise<{ frozenRewardId?: string; success: boolean }> {
    void params;
    return { frozenRewardId: crypto.randomUUID(), success: true };
  }

  async getUserRiskProfile(userId: string) {
    void userId;
    return { riskScore: 0, status: 'clean' };
  }
}

// ============================================================================
// 8. In-Memory Admin Store
// ============================================================================
export class MemoryAdminStore implements AdminStore {
  private flags: FeatureFlagsMap = {
    'feature.stars_payments': true,
    'feature.maintenance_mode': false,
    'feature.referrals': true,
    'economy.multiplier': 1.0,
  };
  private auditLogs: AdminAuditLogEntry[] = [
    {
      id: '00000000-0000-4000-a000-000000000000',
      adminUserId: '00000000-0000-4000-a000-000000000001',
      adminUsername: 'Barandnz',
      action: 'SYSTEM_BOOT',
      targetType: 'feature_flag',
      targetKey: 'feature.stars_payments',
      oldValue: null,
      newValue: true,
      reason: 'Local dev and Telegram Mini App initialized in memory',
      createdAt: '2026-09-17T00:00:00.000Z',
    },
  ];

  async checkSuperadminRole(userId: string): Promise<boolean> {
    void userId;
    return true;
  }

  async getFeatureFlags(): Promise<FeatureFlagsMap> {
    return { ...this.flags };
  }

  async updateConfigOrFlag(params: {
    key: string;
    value: unknown;
    adminUserId?: string;
    reason?: string;
    requestId?: string;
    adminUsername?: string;
  }): Promise<UpdateConfigOrFlagResult> {
    const oldValue = this.flags[params.key];
    this.flags[params.key] = params.value as boolean;

    const logId = crypto.randomUUID();
    this.auditLogs.unshift({
      id: logId,
      adminUserId: params.adminUserId ?? null,
      adminUsername: params.adminUsername ?? 'Admin',
      action: 'UPDATE_CONFIG',
      targetType: 'config',
      targetKey: params.key,
      oldValue,
      newValue: params.value,
      reason: params.reason ?? null,
      createdAt: new Date().toISOString(),
    });

    return {
      success: true,
      key: params.key,
      updatedValue: params.value,
      auditLogId: logId,
    };
  }

  async getAuditLogs(params?: {
    limit?: number;
    offset?: number;
    targetKey?: string;
  }): Promise<{ logs: AdminAuditLogEntry[]; total: number }> {
    let list = [...this.auditLogs];
    if (params?.targetKey) {
      list = list.filter((l) => l.targetKey === params.targetKey);
    }
    const offset = params?.offset ?? 0;
    const limit = params?.limit ?? 50;
    return {
      logs: list.slice(offset, offset + limit),
      total: list.length,
    };
  }

  async getFlaggedAccounts(params?: {
    limit?: number;
    offset?: number;
  }): Promise<{ accounts: FlaggedAccountDto[]; total: number }> {
    void params;
    return { accounts: [], total: 0 };
  }

  async unfreezeAccount(params: {
    targetUserId: string;
    adminUserId?: string;
    reason?: string;
    requestId?: string;
    adminUsername?: string;
  }): Promise<UnfreezeAccountResult> {
    void params;
    return { success: true };
  }
}
