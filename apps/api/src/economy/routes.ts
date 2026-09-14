import { Hono } from 'hono';
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
import type {
  EconomyRoiResponse,
  EconomySimulationResponse,
  PlayerBusiness,
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
      c.req.header('Cookie'),
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
      const upgradeCost =
        currentLevel <= 0
          ? calculateUpgradeCost(b.baseCost, 0)
          : calculateUpgradeCost(b.baseCost, nextLevel);
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
        lastClaimAt: b.lastClaimAt,
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

  return routes;
}
