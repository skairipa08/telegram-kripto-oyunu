import { Hono, type Context } from 'hono';
import {
  calculateUpgradeCost,
  calculateProductionPerSecond,
  calculatePaybackPeriodSeconds,
  calculateMarginalRoi,
  calculateOptimalNextUpgrade,
  simulateProgression,
  DEFAULT_BUSINESSES,
  DEFAULT_ECONOMY_CONFIG,
  type SimulationStrategyType,
} from '@empire/game-core';
import {
  claimCashRequestSchema,
  upgradeBusinessRequestSchema,
  claimMissionRequestSchema,
  bindReferralRequestSchema,
  claimStreakRequestSchema,
  claimReferralRewardRequestSchema,
  type ClaimCashRequest,
  type ClaimCashResponse,
  type UpgradeBusinessRequest,
  type UpgradeBusinessResponse,
  type ClaimMissionRequest,
  type ClaimMissionResponse,
  type ClaimStreakRequest,
  type ClaimStreakResponse,
  type ClaimReferralRewardRequest,
  type ClaimReferralRewardResponse,
  type BindReferralRequest,
  type BindReferralResponse,
  type EconomyRoiResponse,
  type EconomySimulationResponse,
  type PlayerBusiness,
  type PlayerStreakDto,
  type PlayerReferralOverview,
  type PlayerState,
  type InviteeMilestoneStatus,
} from '@empire/shared';
import type { Bindings } from '../auth/env';
import { getCurrentUserSession } from '../auth/routes';
import { SupabaseAuthStore, type AuthStore } from '../auth/store';
import { SupabaseEconomyStore, type EconomyStore } from './store';

const error = (code: string) => ({
  apiVersion: 'v1' as const,
  error: { code },
});

export function createEconomyRoutes(
  makeStore: (env: Bindings) => EconomyStore = (env) =>
    new SupabaseEconomyStore(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!),
  makeAuthStore: (env: Bindings) => AuthStore = (env) =>
    new SupabaseAuthStore(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!),
  now: () => number = () => Math.floor(Date.now() / 1000),
) {
  const routes = new Hono<{ Bindings: Bindings }>();

  // GET /economy/roi
  routes.get('/economy/roi', async (c) => {
    const authStore = makeAuthStore(c.env);
    const session = await getCurrentUserSession(
      c.req.header('Cookie') ??
        c.req.header('Authorization') ??
        c.req.header('X-Empire-Session'),
      c.env,
      authStore,
      now,
    );

    if (!session) {
      return c.json(error('UNAUTHORIZED'), 401);
    }

    const economyStore = makeStore(c.env);
    const playerState = await economyStore.getPlayerState(session.user.id);

    // If businesses list from DB is empty, use default canonical businesses with level 0
    const rawBusinesses =
      playerState.businesses.length > 0
        ? playerState.businesses
        : DEFAULT_BUSINESSES.map((b) => ({
            slug: b.id,
            name: b.name,
            level: 0,
            baseCost: b.baseCost,
            baseIncome: b.baseIncome,
            sortOrder: b.order,
            lastClaimAt: new Date().toISOString(),
          }));

    const businesses: PlayerBusiness[] = rawBusinesses.map((b) => {
      const currentLevel = b.level;
      const nextLevel = currentLevel + 1;
      const upgradeCost = calculateUpgradeCost(b.baseCost, currentLevel);
      const currentProd = calculateProductionPerSecond(
        b.baseIncome,
        currentLevel,
      );
      const nextProd = calculateProductionPerSecond(b.baseIncome, nextLevel);
      const payback = calculatePaybackPeriodSeconds(
        upgradeCost,
        currentProd,
        nextProd,
      );
      const marginalRoi = calculateMarginalRoi(
        upgradeCost,
        currentProd,
        nextProd,
      );

      return {
        slug: b.slug,
        name: b.name,
        level: currentLevel,
        baseCost: b.baseCost,
        baseIncome: b.baseIncome,
        upgradeCost,
        productionPerSecond: currentProd,
        lastClaimAt: new Date(
          String(b.lastClaimAt ?? Date.now()),
        ).toISOString(),
        paybackPeriodSeconds: payback,
        marginalRoi,
        nextProductionPerSecond: nextProd,
      };
    });

    const totalProduction = businesses.reduce(
      (sum, b) => sum + b.productionPerSecond,
      0,
    );

    const optimal = calculateOptimalNextUpgrade(
      rawBusinesses.map((b) => ({
        slug: b.slug,
        name: b.name,
        level: b.level,
        baseCost: b.baseCost,
        baseIncome: b.baseIncome,
      })),
      playerState.cash,
    );

    const recommendedUpgrade = optimal.bestOverall
      ? {
          slug: optimal.bestOverall.slug,
          name: optimal.bestOverall.name,
          currentLevel: optimal.bestOverall.currentLevel,
          upgradeCost: optimal.bestOverall.upgradeCost,
          paybackPeriodSeconds: optimal.bestOverall.paybackPeriodSeconds,
          marginalRoi: optimal.bestOverall.marginalRoi,
          isAffordable: optimal.bestOverall.isAffordable,
        }
      : null;

    const response: EconomyRoiResponse = {
      apiVersion: 'v1',
      currentCash: playerState.cash,
      totalProductionPerSecond: totalProduction,
      optimalUpgrade: recommendedUpgrade,
      businesses,
      multipliers: {
        offlineCapSeconds: playerState.hasConveniencePass
          ? DEFAULT_ECONOMY_CONFIG.offlineCapPassSec
          : DEFAULT_ECONOMY_CONFIG.offlineCapFreeSec,
        upgradeCostGrowth: DEFAULT_ECONOMY_CONFIG.upgradeCostGrowth,
        productionLevelGrowth: DEFAULT_ECONOMY_CONFIG.productionLevelGrowth,
        hasConveniencePass: playerState.hasConveniencePass,
      },
    };

    return c.json(response, 200);
  });

  // GET /economy/simulation
  routes.get('/economy/simulation', async (c) => {
    const durationParam = c.req.query('duration');
    const strategyParam = c.req.query('strategy');
    const hasPassParam = c.req.query('hasPass');
    const isReferredParam = c.req.query('isReferred');

    let durationSeconds = 86400; // default 24 hours
    if (durationParam !== undefined) {
      const parsed = Number(durationParam);
      if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 2592000) {
        return c.json(error('INVALID_DURATION'), 400);
      }
      durationSeconds = Math.floor(parsed);
    }

    let strategy: SimulationStrategyType = 'greedy_roi';
    if (
      strategyParam === 'cheapest' ||
      strategyParam === 'balanced' ||
      strategyParam === 'greedy_roi'
    ) {
      strategy = strategyParam;
    }

    const hasConveniencePass = hasPassParam === 'true';
    const isReferred = isReferredParam === 'true';

    const result = simulateProgression(durationSeconds, {
      strategy,
      hasConveniencePass,
      isReferred,
    });

    const response: EconomySimulationResponse = {
      apiVersion: 'v1',
      durationSeconds: result.durationSeconds,
      totalCashEarned: result.totalCashEarned,
      finalCashBalance: result.finalCashBalance,
      finalProductionPerSecond: result.finalProductionPerSecond,
      unlockedBusinessCount: result.unlockedBusinessCount,
      businessLevels: result.businessLevels,
      timeToUnlockSeconds: result.timeToUnlockSeconds,
      totalUpgradesPurchased: result.totalUpgradesPurchased,
      conveniencePassImpact: result.conveniencePassImpact,
    };

    return c.json(response, 200);
  });

  // POST /economy/claim
  routes.post('/economy/claim', async (c) => {
    const authStore = makeAuthStore(c.env);
    const session = await getCurrentUserSession(
      c.req.header('Cookie') ??
        c.req.header('Authorization') ??
        c.req.header('X-Empire-Session'),
      c.env,
      authStore,
      now,
    );

    if (!session) {
      return c.json(error('UNAUTHORIZED'), 401);
    }

    let body: ClaimCashRequest;
    try {
      body = claimCashRequestSchema.parse(await c.req.json());
    } catch {
      return c.json(error('INVALID_REQUEST'), 400);
    }
    const economyStore = makeStore(c.env);
    const playerState = await economyStore.getPlayerState(session.user.id);
    const result = await economyStore.claimOfflineEarnings(
      session.user.id,
      body.requestId,
    );
    if (result.error) {
      return c.json(
        error(result.error),
        result.error === 'IDEMPOTENCY_CONFLICT' ? 409 : 400,
      );
    }

    if (result.claimedAmount > 0 && !result.replayed) {
      // Increment claim_cash_* missions
      await economyStore.incrementMissionProgress(
        session.user.id,
        'claim_cash',
        1,
      );

      // Check if offline duration >= 14,400s (4 hours)
      const maxElapsed = playerState.businesses.reduce((max, b) => {
        const elapsed = (Date.now() - new Date(b.lastClaimAt).getTime()) / 1000;
        return elapsed > max ? elapsed : max;
      }, 0);
      if (maxElapsed >= 14400 || result.isCapped) {
        await economyStore.incrementMissionProgress(
          session.user.id,
          'claim_offline_4h',
          1,
        );
      }
    }

    const response: ClaimCashResponse = {
      apiVersion: 'v1',
      claimedAmount: result.claimedAmount,
      newBalance: result.newBalance,
      claimedAt: new Date(String(result.claimedAt ?? Date.now())).toISOString(),
      isCapped: result.isCapped,
    };

    return c.json(response, 200);
  });

  // POST /economy/upgrade
  routes.post('/economy/upgrade', async (c) => {
    const authStore = makeAuthStore(c.env);
    const session = await getCurrentUserSession(
      c.req.header('Cookie') ??
        c.req.header('Authorization') ??
        c.req.header('X-Empire-Session'),
      c.env,
      authStore,
      now,
    );

    if (!session) {
      return c.json(error('UNAUTHORIZED'), 401);
    }

    let body: UpgradeBusinessRequest;
    try {
      body = upgradeBusinessRequestSchema.parse(await c.req.json());
    } catch {
      return c.json(error('INVALID_REQUEST'), 400);
    }

    const economyStore = makeStore(c.env);
    const result = await economyStore.upgradeBusiness(
      session.user.id,
      body.businessSlug,
      body.requestId,
    );

    if (result.error) {
      return c.json(
        error(result.error),
        result.error === 'IDEMPOTENCY_CONFLICT' ? 409 : 400,
      );
    }

    if (!result.replayed) {
      // Action progression hooks:
      // 1. Increment upgrade_any_*
      await economyStore.incrementMissionProgress(
        session.user.id,
        'upgrade_any',
        1,
      );

      // 2. reach_milestone when level reaches 10, 25, 50, 100, 200
      if ([10, 25, 50, 100, 200].includes(result.business!.level)) {
        await economyStore.incrementMissionProgress(
          session.user.id,
          'reach_milestone',
          1,
        );
      }

      // 3. upgrade_factory_tier when business is factory or higher
      if (
        ['factory', 'tech_company', 'global_holding'].includes(
          result.business!.slug,
        )
      ) {
        await economyStore.incrementMissionProgress(
          session.user.id,
          'upgrade_factory_tier',
          1,
        );
      }

      // 4. Evaluate invitee referral milestones (activation, progression)
      await economyStore.evaluateReferralMilestones(session.user.id);
    }

    const biz = result.business!;
    const nextLevel = biz.level + 1;
    const nextUpgradeCost = calculateUpgradeCost(biz.baseCost, biz.level);
    const currentProd = biz.productionPerSecond;
    const nextProd = calculateProductionPerSecond(biz.baseIncome, nextLevel);
    const payback = calculatePaybackPeriodSeconds(
      nextUpgradeCost,
      currentProd,
      nextProd,
    );
    const marginalRoi = calculateMarginalRoi(
      nextUpgradeCost,
      currentProd,
      nextProd,
    );

    const business: PlayerBusiness = {
      slug: biz.slug,
      name: biz.name,
      level: biz.level,
      baseCost: biz.baseCost,
      baseIncome: biz.baseIncome,
      upgradeCost: biz.upgradeCost,
      productionPerSecond: biz.productionPerSecond,
      lastClaimAt: new Date(
        String(biz.lastClaimAt ?? Date.now()),
      ).toISOString(),
      paybackPeriodSeconds: payback,
      marginalRoi,
      nextProductionPerSecond: nextProd,
    };

    const response: UpgradeBusinessResponse = {
      apiVersion: 'v1',
      business,
      remainingCash: result.remainingCash!,
      totalProductionPerSecond: result.totalProductionPerSecond!,
    };

    return c.json(response, 200);
  });

  // GET /game/state
  routes.get('/game/state', async (c) => {
    const authStore = makeAuthStore(c.env);
    const session = await getCurrentUserSession(
      c.req.header('Cookie') ??
        c.req.header('Authorization') ??
        c.req.header('X-Empire-Session'),
      c.env,
      authStore,
      now,
    );

    if (!session) {
      return c.json(error('UNAUTHORIZED'), 401);
    }

    const economyStore = makeStore(c.env);
    await economyStore.assignDailyMissions(session.user.id);
    await economyStore.evaluateReferralMilestones(session.user.id);
    const state = await economyStore.getGameState(session.user.id);

    const rawBusinesses = (state.businesses as Record<string, unknown>[]) ?? [];
    const businesses: PlayerBusiness[] = rawBusinesses.map((b) => {
      const currentLevel = Number(b.level ?? 0);
      const nextLevel = currentLevel + 1;
      const baseCost = Number(b.baseCost ?? 100);
      const baseIncome = Number(b.baseIncome ?? 1);
      const upgradeCost = calculateUpgradeCost(baseCost, currentLevel);
      const currentProd = calculateProductionPerSecond(
        baseIncome,
        currentLevel,
      );
      const nextProd = calculateProductionPerSecond(baseIncome, nextLevel);
      const payback = calculatePaybackPeriodSeconds(
        upgradeCost,
        currentProd,
        nextProd,
      );
      const marginalRoi = calculateMarginalRoi(
        upgradeCost,
        currentProd,
        nextProd,
      );

      return {
        slug: String(b.slug),
        name: String(b.name),
        level: currentLevel,
        baseCost,
        baseIncome,
        upgradeCost: Number(b.upgradeCost ?? upgradeCost),
        productionPerSecond: Number(b.productionPerSecond ?? currentProd),
        lastClaimAt: new Date(
          String(b.lastClaimAt ?? Date.now()),
        ).toISOString(),
        paybackPeriodSeconds: payback,
        marginalRoi,
        nextProductionPerSecond: nextProd,
      };
    });

    const response: PlayerState & Record<string, unknown> = {
      apiVersion: 'v1',
      user: session.user,
      session: { expiresAt: new Date(session.expiresAt * 1000).toISOString() },
      game: {
        status: 'active',
        economy: {
          cash: Number(state.cash ?? 100),
          seasonPoints: Number(state.seasonPoints ?? 0),
          totalProductionPerSecond: Number(state.totalProductionPerSecond ?? 0),
          offlineCapSeconds: Number(state.offlineCapSeconds ?? 14400),
          businesses,
        },
      },
      ...state,
      businesses,
    };

    return c.json(response, 200);
  });

  // GET /missions/active and GET /missions
  const handleGetActiveMissions = async (
    c: Context<{ Bindings: Bindings }>,
  ) => {
    const authStore = makeAuthStore(c.env);
    const session = await getCurrentUserSession(
      c.req.header('Cookie') ??
        c.req.header('Authorization') ??
        c.req.header('X-Empire-Session'),
      c.env,
      authStore,
      now,
    );

    if (!session) {
      return c.json(error('UNAUTHORIZED'), 401);
    }

    const economyStore = makeStore(c.env);
    await economyStore.assignDailyMissions(session.user.id);
    const rawMissions = (await economyStore.getActiveMissions(
      session.user.id,
    )) as Record<string, unknown>[];
    const missions = rawMissions.map((m) => ({
      ...m,
      claimedAt: m.claimedAt
        ? new Date(String(m.claimedAt)).toISOString()
        : null,
    }));

    return c.json(missions, 200);
  };

  routes.get('/missions/active', handleGetActiveMissions);
  routes.get('/missions', handleGetActiveMissions);

  const handleClaimMission = async (c: Context<{ Bindings: Bindings }>) => {
    const authStore = makeAuthStore(c.env);
    const session = await getCurrentUserSession(
      c.req.header('Cookie') ??
        c.req.header('Authorization') ??
        c.req.header('X-Empire-Session'),
      c.env,
      authStore,
      now,
    );

    if (!session) {
      return c.json(error('UNAUTHORIZED'), 401);
    }

    const paramId = c.req.param('id');
    let body: ClaimMissionRequest;
    try {
      const raw = (await c.req.json()) as Record<string, unknown>;
      const toValidate = {
        missionInstanceId: raw.missionInstanceId ?? paramId,
        requestId: raw.requestId,
      };
      body = claimMissionRequestSchema.parse(toValidate);
    } catch {
      return c.json(error('INVALID_REQUEST'), 400);
    }

    const economyStore = makeStore(c.env);
    const result = await economyStore.claimMission(
      session.user.id,
      body.missionInstanceId,
      body.requestId,
    );

    if (result.error) {
      return c.json(
        error(String(result.error)),
        result.error === 'IDEMPOTENCY_CONFLICT' ? 409 : 400,
      );
    }

    const response: ClaimMissionResponse = {
      apiVersion: 'v1',
      missionInstanceId: String(
        result.missionInstanceId ?? body.missionInstanceId,
      ),
      rewardPoints: Number(
        result.rewardPoints ?? result.rewardSeasonPoints ?? 50,
      ),
      newSeasonPoints: Number(result.newSeasonPoints ?? 0),
      claimedAt: new Date(String(result.claimedAt ?? Date.now())).toISOString(),
    };

    return c.json(response, 200);
  };

  // POST /missions/:id/claim
  routes.post('/missions/:id/claim', handleClaimMission);
  routes.post('/missions/claim', handleClaimMission);

  // GET /streak
  routes.get('/streak', async (c) => {
    const authStore = makeAuthStore(c.env);
    const session = await getCurrentUserSession(
      c.req.header('Cookie') ??
        c.req.header('Authorization') ??
        c.req.header('X-Empire-Session'),
      c.env,
      authStore,
      now,
    );

    if (!session) {
      return c.json(error('UNAUTHORIZED'), 401);
    }

    const economyStore = makeStore(c.env);
    const streak = await economyStore.getStreak(session.user.id);

    const response: PlayerStreakDto & { apiVersion: 'v1' } = {
      apiVersion: 'v1',
      currentStreak: Number(streak.currentStreak ?? 0),
      longestStreak: Number(streak.longestStreak ?? 0),
      lastClaimDate: streak.lastClaimDate ? String(streak.lastClaimDate) : null,
      canClaimToday: Boolean(streak.canClaimToday),
      todayRewardPoints: Number(streak.todayRewardPoints ?? 50),
      isCycleBonusToday: Boolean(streak.isCycleBonusToday),
    };

    return c.json(response, 200);
  });

  // POST /streak/claim
  const handleClaimStreak = async (c: Context<{ Bindings: Bindings }>) => {
    const authStore = makeAuthStore(c.env);
    const session = await getCurrentUserSession(
      c.req.header('Cookie') ??
        c.req.header('Authorization') ??
        c.req.header('X-Empire-Session'),
      c.env,
      authStore,
      now,
    );

    if (!session) {
      return c.json(error('UNAUTHORIZED'), 401);
    }

    let body: ClaimStreakRequest;
    try {
      body = claimStreakRequestSchema.parse(await c.req.json());
    } catch {
      return c.json(error('INVALID_REQUEST'), 400);
    }

    const economyStore = makeStore(c.env);
    const result = await economyStore.claimStreak(
      session.user.id,
      body.requestId,
    );

    if (result.error) {
      if (result.error === 'IDEMPOTENCY_CONFLICT') {
        return c.json(error('IDEMPOTENCY_CONFLICT'), 409);
      }
      return c.json(error(String(result.error)), 400);
    }

    const response: ClaimStreakResponse = {
      apiVersion: 'v1',
      rewardPoints: Number(result.rewardPoints ?? 0),
      newStreak: Number(result.newStreak ?? result.currentStreak ?? 1),
      newSeasonPoints: Number(result.newSeasonPoints ?? 0),
      isCycleBonus: Boolean(result.isCycleBonus),
      claimedAt: new Date(String(result.claimedAt ?? Date.now())).toISOString(),
    };

    return c.json(response, 200);
  };

  routes.post('/streak/claim', handleClaimStreak);

  // POST /referral/bind
  routes.post('/referral/bind', async (c) => {
    const authStore = makeAuthStore(c.env);
    const session = await getCurrentUserSession(
      c.req.header('Cookie') ??
        c.req.header('Authorization') ??
        c.req.header('X-Empire-Session'),
      c.env,
      authStore,
      now,
    );

    if (!session) {
      return c.json(error('UNAUTHORIZED'), 401);
    }

    let body: BindReferralRequest;
    try {
      body = bindReferralRequestSchema.parse(await c.req.json());
    } catch {
      return c.json(error('INVALID_REQUEST'), 400);
    }

    const economyStore = makeStore(c.env);
    const result = await economyStore.bindReferral(
      session.user.id,
      body.referralCode,
      body.requestId,
    );

    if (!result.success || result.error) {
      return c.json(
        error(result.error ?? 'REFERRAL_BIND_FAILED'),
        result.error === 'IDEMPOTENCY_CONFLICT' ? 409 : 400,
      );
    }

    const response: BindReferralResponse = {
      apiVersion: 'v1',
      success: true,
      starterCashBoost: result.starterCashBoost,
    };

    return c.json(response, 200);
  });

  // GET /referral/status
  routes.get('/referral/status', async (c) => {
    const authStore = makeAuthStore(c.env);
    const session = await getCurrentUserSession(
      c.req.header('Cookie') ??
        c.req.header('Authorization') ??
        c.req.header('X-Empire-Session'),
      c.env,
      authStore,
      now,
    );

    if (!session) {
      return c.json(error('UNAUTHORIZED'), 401);
    }

    const economyStore = makeStore(c.env);
    await economyStore.incrementMissionProgress(
      session.user.id,
      'view_friends',
      1,
    );
    const status = await economyStore.getReferralStatus(session.user.id);

    const response: PlayerReferralOverview & { apiVersion: 'v1' } = {
      apiVersion: 'v1',
      referralCode: String(status.referralCode ?? ''),
      deepLink: String(status.deepLink ?? ''),
      totalInvites: Number(status.totalInvites ?? 0),
      qualifiedCount: Number(status.qualifiedCount ?? 0),
      totalEarnedPoints: Number(status.totalEarnedPoints ?? 0),
      unlockedBadges: Array.isArray(status.unlockedBadges)
        ? (status.unlockedBadges as string[])
        : [],
      totalKickbackCashEarned: Number(status.totalKickbackCashEarned ?? 0),
      unclaimedKickbackCash: Number(status.unclaimedKickbackCash ?? 0),
      commissionRatePercent: Number(status.commissionRatePercent ?? 3),
      inviteeMilestones: Array.isArray(status.inviteeMilestones)
        ? (status.inviteeMilestones as InviteeMilestoneStatus[])
        : [],
    };

    return c.json(response, 200);
  });

  // POST /referral/claim-kickback
  routes.post('/referral/claim-kickback', async (c) => {
    const authStore = makeAuthStore(c.env);
    const session = await getCurrentUserSession(
      c.req.header('Cookie') ??
        c.req.header('Authorization') ??
        c.req.header('X-Empire-Session'),
      c.env,
      authStore,
      now,
    );

    if (!session) {
      return c.json(error('UNAUTHORIZED'), 401);
    }

    const economyStore = makeStore(c.env);
    if (economyStore.claimReferralKickback) {
      const res = await economyStore.claimReferralKickback(session.user.id);
      return c.json(
        {
          apiVersion: 'v1',
          claimedCash: res.claimedCash,
          newCash: res.newCash,
          claimedAt: res.claimedAt,
        },
        200,
      );
    }

    return c.json(error('NOT_IMPLEMENTED'), 501);
  });

  // POST /referral/claim
  const handleClaimReferralReward = async (
    c: Context<{ Bindings: Bindings }>,
  ) => {
    const authStore = makeAuthStore(c.env);
    const session = await getCurrentUserSession(
      c.req.header('Cookie') ??
        c.req.header('Authorization') ??
        c.req.header('X-Empire-Session'),
      c.env,
      authStore,
      now,
    );

    if (!session) {
      return c.json(error('UNAUTHORIZED'), 401);
    }

    let body: ClaimReferralRewardRequest;
    try {
      body = claimReferralRewardRequestSchema.parse(await c.req.json());
    } catch {
      return c.json(error('INVALID_REQUEST'), 400);
    }

    const economyStore = makeStore(c.env);
    const result = await economyStore.claimReferralReward(
      session.user.id,
      body.eventId,
      body.requestId,
    );

    if (result.error) {
      if (result.error === 'EVENT_NOT_FOUND') {
        return c.json(error('EVENT_NOT_FOUND'), 404);
      }
      if (result.error === 'IDEMPOTENCY_CONFLICT') {
        return c.json(error('IDEMPOTENCY_CONFLICT'), 409);
      }
      return c.json(error(String(result.error)), 400);
    }

    const response: ClaimReferralRewardResponse = {
      apiVersion: 'v1',
      eventId: String(result.eventId ?? body.eventId),
      rewardPoints: Number(result.rewardPoints ?? 0),
      newSeasonPoints: Number(result.newSeasonPoints ?? 0),
      claimedAt: new Date(String(result.claimedAt ?? Date.now())).toISOString(),
    };

    return c.json(response, 200);
  };

  routes.post('/referral/claim', handleClaimReferralReward);

  return routes;
}
