import { Hono } from 'hono';
import {
  dailyComboStatusResponseSchema,
  submitDailyComboRequestSchema,
  submitDailyComboResponseSchema,
  submitDailyCipherRequestSchema,
  submitDailyCipherResponseSchema,
  type DailyComboStatusResponse,
} from '@empire/shared';
import { getUtcDateString, DAILY_COMBO_REWARD } from '@empire/game-core';
import type { Bindings } from '../auth/env';
import { getCurrentUserSession } from '../auth/routes';
import { SupabaseAuthStore, type AuthStore } from '../auth/store';
import { SupabaseComboStore, type ComboStore } from './store';

const error = (code: string, details?: unknown) => ({
  apiVersion: 'v1' as const,
  error: { code, ...(details ? { details } : {}) },
});

export function createComboRoutes(
  makeStore: (env: Bindings) => ComboStore = (env) =>
    new SupabaseComboStore(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY),
  makeAuthStore: (env: Bindings) => AuthStore = (env) =>
    new SupabaseAuthStore(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!),
  now: () => number = () => Math.floor(Date.now() / 1000),
) {
  const routes = new Hono<{ Bindings: Bindings }>();

  // GET /combo/status
  routes.get('/combo/status', async (c) => {
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

    const date = c.req.query('date') ?? getUtcDateString();
    const store = makeStore(c.env);
    const status = await store.getComboStatus(session.user.id, date);

    const response: DailyComboStatusResponse = {
      apiVersion: 'v1',
      date,
      isCompleted: status.isCompleted,
      claimedAt: status.claimedAt,
      rewardCash: DAILY_COMBO_REWARD.cash,
      rewardSeasonPoints: DAILY_COMBO_REWARD.seasonPoints,
    };

    return c.json(dailyComboStatusResponseSchema.parse(response), 200);
  });

  // POST /combo/claim
  routes.post('/combo/claim', async (c) => {
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

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(error('INVALID_JSON'), 400);
    }

    const parsed = submitDailyComboRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(error('INVALID_REQUEST', parsed.error.format()), 400);
    }

    const store = makeStore(c.env);
    const result = await store.claimDailyCombo(
      session.user.id,
      parsed.data.date,
      parsed.data.selectedSlugs,
    );

    if (result.error) {
      return c.json(error(result.error), 400);
    }

    return c.json(
      submitDailyComboResponseSchema.parse({
        apiVersion: 'v1',
        success: true,
        message: 'Günün gizli kombosunu başarıyla buldun!',
        rewardCash: result.rewardCash,
        rewardSeasonPoints: result.rewardSeasonPoints,
        newCash: result.newCash,
      }),
      200,
    );
  });

  // POST /combo/cipher-claim
  routes.post('/combo/cipher-claim', async (c) => {
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

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(error('INVALID_JSON'), 400);
    }

    const parsed = submitDailyCipherRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(error('INVALID_REQUEST', parsed.error.format()), 400);
    }

    const store = makeStore(c.env);
    const result = await store.claimDailyCipher(
      session.user.id,
      parsed.data.date,
      parsed.data.solvedWord,
    );

    if (result.error) {
      return c.json(error(result.error), 400);
    }

    return c.json(
      submitDailyCipherResponseSchema.parse({
        apiVersion: 'v1',
        success: true,
        message: 'Günün siber mors şifresini başarıyla çözdün!',
        rewardCash: result.rewardCash,
        rewardSeasonPoints: result.rewardSeasonPoints,
        newCash: result.newCash,
      }),
      200,
    );
  });

  return routes;
}
