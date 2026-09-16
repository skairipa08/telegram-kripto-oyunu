import { Hono } from 'hono';
import {
  tapClickRequestSchema,
  tapUpgradeRequestSchema,
  tapClaimBotRequestSchema,
  mergeActionRequestSchema,
  mergeAutoRequestSchema,
  mergeClaimPassiveRequestSchema,
  crashStartRequestSchema,
  crashCashoutRequestSchema,
  cipherSubmitRequestSchema,
  type TapClickResponse,
  type TapUpgradeResponse,
  type TapClaimBotResponse,
  type MergeBoardStateDto,
  type MergeActionResponse,
  type MergeAutoResponse,
  type MergeClaimPassiveResponse,
  type CrashStartResponse,
  type CrashCashoutResponse,
  type CipherSubmitResponse,
} from '@empire/shared';
import type { Bindings } from '../auth/env';
import { getCurrentUserSession } from '../auth/routes';
import { SupabaseAuthStore, type AuthStore } from '../auth/store';
import { SupabaseArcadeStore, type ArcadeStore } from './store';

const error = (code: string, details?: unknown) => ({
  apiVersion: 'v1' as const,
  error: { code, ...(details ? { details } : {}) },
});

export function createArcadeRoutes(
  makeStore: (env: Bindings) => ArcadeStore = (env) =>
    new SupabaseArcadeStore(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY),
  makeAuthStore: (env: Bindings) => AuthStore = (env) =>
    new SupabaseAuthStore(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!),
  now: () => number = () => Math.floor(Date.now() / 1000),
) {
  const routes = new Hono<{ Bindings: Bindings }>();

  // ==========================================================================
  // 1. Notcoin Tap Routes
  // ==========================================================================

  // GET /arcade/tap/state
  routes.get('/arcade/tap/state', async (c) => {
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

    const store = makeStore(c.env);
    const state = await store.getTapState(session.user.id);
    return c.json({ apiVersion: 'v1' as const, ...state });
  });

  // POST /arcade/tap/click
  routes.post('/arcade/tap/click', async (c) => {
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

    const body = await c.req.json().catch(() => null);
    const parsed = tapClickRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(error('INVALID_REQUEST', parsed.error.format()), 400);
    }

    const store = makeStore(c.env);
    const result = await store.recordTapClick(
      session.user.id,
      parsed.data.tapCount,
      parsed.data.requestId,
    );

    if (result.error) {
      return c.json(error(result.error), 400);
    }

    return c.json({
      apiVersion: 'v1' as const,
      tapsExecuted: result.tapsExecuted,
      coinsEarned: result.coinsEarned,
      newCash: result.newCash,
      remainingEnergy: result.remainingEnergy,
      criticalHitsCount: result.criticalHitsCount,
      energyRechargeRate: result.energyRechargeRate,
    } satisfies TapClickResponse);
  });

  // POST /arcade/tap/upgrade
  routes.post('/arcade/tap/upgrade', async (c) => {
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

    const body = await c.req.json().catch(() => null);
    const parsed = tapUpgradeRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(error('INVALID_REQUEST', parsed.error.format()), 400);
    }

    const store = makeStore(c.env);
    const result = await store.upgradeTap(
      session.user.id,
      parsed.data.upgradeType,
      parsed.data.currency,
      parsed.data.requestId,
    );

    if (result.error) {
      return c.json(error(result.error), 400);
    }

    return c.json({
      apiVersion: 'v1' as const,
      upgradeType: result.upgradeType,
      newLevel: result.newLevel,
      cashCost: result.cashCost,
      newCash: result.newCash,
    } satisfies TapUpgradeResponse);
  });

  // POST /arcade/tap/claim-bot
  routes.post('/arcade/tap/claim-bot', async (c) => {
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

    const body = await c.req.json().catch(() => null);
    const parsed = tapClaimBotRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(error('INVALID_REQUEST', parsed.error.format()), 400);
    }

    const store = makeStore(c.env);
    const result = await store.claimTapBot(
      session.user.id,
      parsed.data.requestId,
    );
    if (result.error) {
      return c.json(error(result.error), 400);
    }

    return c.json({
      apiVersion: 'v1' as const,
      claimedCash: result.claimedCash,
      newCash: result.newCash,
      offlineSecondsElapsed: result.offlineSecondsElapsed,
      botTapsCount: result.botTapsCount,
    } satisfies TapClaimBotResponse);
  });

  // ==========================================================================
  // 2. Catizen Merge Routes
  // ==========================================================================

  // GET /arcade/merge/state
  routes.get('/arcade/merge/state', async (c) => {
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

    const store = makeStore(c.env);
    const state = await store.getMergeState(session.user.id);
    return c.json({ apiVersion: 'v1' as const, ...state } satisfies {
      apiVersion: 'v1';
    } & MergeBoardStateDto);
  });

  // POST /arcade/merge/action
  routes.post('/arcade/merge/action', async (c) => {
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

    const body = await c.req.json().catch(() => null);
    const parsed = mergeActionRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(error('INVALID_REQUEST', parsed.error.format()), 400);
    }

    const store = makeStore(c.env);
    const result = await store.executeMergeAction(
      session.user.id,
      parsed.data.sourceIndex,
      parsed.data.targetIndex,
      parsed.data.actionType,
      parsed.data.requestId,
    );

    if (result.error) {
      return c.json(error(result.error), 400);
    }

    return c.json({
      apiVersion: 'v1' as const,
      grid: result.grid,
      rewardCash: result.rewardCash,
      newCash: result.newCash,
      unlockedTier: result.unlockedTier,
    } satisfies MergeActionResponse);
  });

  // POST /arcade/merge/auto
  routes.post('/arcade/merge/auto', async (c) => {
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

    const body = await c.req.json().catch(() => null);
    const parsed = mergeAutoRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(error('INVALID_REQUEST', parsed.error.format()), 400);
    }

    const store = makeStore(c.env);
    const result = await store.executeMergeAuto(
      session.user.id,
      parsed.data.autoUnbox,
      parsed.data.requestId,
    );

    if (result.error) {
      return c.json(error(result.error), 400);
    }

    return c.json({
      apiVersion: 'v1' as const,
      grid: result.grid,
      totalMergesExecuted: result.totalMergesExecuted,
      parcelsOpened: result.parcelsOpened,
      totalRewardCash: result.totalRewardCash,
      newCash: result.newCash,
      newPassiveRatePerSecond: result.newPassiveRatePerSecond,
    } satisfies MergeAutoResponse);
  });

  // POST /arcade/merge/claim-passive
  routes.post('/arcade/merge/claim-passive', async (c) => {
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

    const body = await c.req.json().catch(() => null);
    const parsed = mergeClaimPassiveRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(error('INVALID_REQUEST', parsed.error.format()), 400);
    }

    const store = makeStore(c.env);
    const result = await store.claimMergePassive(
      session.user.id,
      parsed.data.requestId,
    );
    if (result.error) {
      return c.json(error(result.error), 400);
    }

    return c.json({
      apiVersion: 'v1' as const,
      claimedCash: result.claimedCash,
      newCash: result.newCash,
      elapsedSeconds: result.elapsedSeconds,
    } satisfies MergeClaimPassiveResponse);
  });

  // ==========================================================================
  // 3. Crypto Crash Routes
  // ==========================================================================

  // POST /arcade/crash/start
  routes.post('/arcade/crash/start', async (c) => {
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

    const body = await c.req.json().catch(() => null);
    const parsed = crashStartRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(error('INVALID_REQUEST', parsed.error.format()), 400);
    }

    const store = makeStore(c.env);
    const result = await store.startCrashRound(
      session.user.id,
      parsed.data.stake,
      parsed.data.clientSeed,
      parsed.data.requestId,
    );

    if (result.error) {
      return c.json(error(result.error), 400);
    }

    return c.json({
      apiVersion: 'v1' as const,
      roundId: result.roundId,
      stake: result.stake,
      serverSeedHash: result.serverSeedHash,
      startTime: result.startTime,
    } satisfies CrashStartResponse);
  });

  // POST /arcade/crash/cashout
  routes.post('/arcade/crash/cashout', async (c) => {
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

    const body = await c.req.json().catch(() => null);
    const parsed = crashCashoutRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(error('INVALID_REQUEST', parsed.error.format()), 400);
    }

    const store = makeStore(c.env);
    const result = await store.cashoutCrashRound(
      session.user.id,
      parsed.data.roundId,
      parsed.data.claimMultiplier,
      parsed.data.requestId,
    );

    if (result.error) {
      return c.json(error(result.error), 400);
    }

    return c.json({
      apiVersion: 'v1' as const,
      roundId: result.roundId,
      status: result.status,
      crashMultiplier: result.crashMultiplier,
      cashoutMultiplier: result.cashoutMultiplier,
      payoutCash: result.payoutCash,
      netProfit: result.netProfit,
      newCash: result.newCash,
      serverSeed: result.serverSeed,
    } satisfies CrashCashoutResponse);
  });

  // ==========================================================================
  // 4. Dynasty Cipher Routes
  // ==========================================================================

  // POST /arcade/cipher/submit
  routes.post('/arcade/cipher/submit', async (c) => {
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

    const body = await c.req.json().catch(() => null);
    const parsed = cipherSubmitRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(error('INVALID_REQUEST', parsed.error.format()), 400);
    }

    const store = makeStore(c.env);
    const result = await store.submitCipher(
      session.user.id,
      parsed.data.round,
      parsed.data.combo,
      parsed.data.completedSuccessfully,
      parsed.data.requestId,
    );

    if (result.error) {
      return c.json(error(result.error), 400);
    }

    return c.json({
      apiVersion: 'v1' as const,
      round: result.round,
      combo: result.combo,
      rewardCash: result.rewardCash,
      newCash: result.newCash,
    } satisfies CipherSubmitResponse);
  });

  return routes;
}
