import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import {
  adminFraudReviewRequestSchema,
  type AdminFraudFlagsResponse,
  type AdminFraudReviewResponse,
  type AdminFrozenRewardsResponse,
} from '@empire/shared';
import type { Bindings } from '../auth/env';
import { getCurrentUserSession } from '../auth/routes';
import { SupabaseAuthStore, type AuthStore } from '../auth/store';
import { SupabaseFraudStore, type FraudStore } from './store';

const error = (code: string) => ({
  apiVersion: 'v1' as const,
  error: { code },
});

export function createFraudRoutes(
  makeStore: (env: Bindings) => FraudStore = (env) =>
    new SupabaseFraudStore(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!),
  makeAuthStore: (env: Bindings) => AuthStore = (env) =>
    new SupabaseAuthStore(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!),
  now: () => number = () => Math.floor(Date.now() / 1000),
) {
  const routes = new Hono<{ Bindings: Bindings }>();

  // Security headers
  routes.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'no-referrer');
    await next();
  });

  // Body limit middleware
  routes.use(
    '*',
    bodyLimit({
      maxSize: 20000,
      onError: (c) => c.json(error('INVALID_REQUEST'), 413),
    }),
  );

  // GET /admin/fraud/flags
  routes.get('/admin/fraud/flags', async (c) => {
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

    const fraudStore = makeStore(c.env);
    const hasRole = await fraudStore.checkAdminRole(session.user.id, 'auditor');
    if (!hasRole) {
      return c.json(error('FORBIDDEN'), 403);
    }

    const status = c.req.query('status') || undefined;
    const userId = c.req.query('userId') || undefined;
    const severity = c.req.query('severity') || undefined;
    const limitQuery = c.req.query('limit');
    const offsetQuery = c.req.query('offset');
    const limit = limitQuery ? parseInt(limitQuery, 10) : 50;
    const offset = offsetQuery ? parseInt(offsetQuery, 10) : 0;

    const result = await fraudStore.getFraudFlags({
      status,
      userId,
      severity,
      limit: Number.isNaN(limit) ? 50 : limit,
      offset: Number.isNaN(offset) ? 0 : offset,
    });

    const response: AdminFraudFlagsResponse = {
      apiVersion: 'v1',
      flags: result.flags,
      total: result.total,
      limit,
      offset,
    };

    return c.json(response);
  });

  // GET /admin/fraud/frozen
  routes.get('/admin/fraud/frozen', async (c) => {
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

    const fraudStore = makeStore(c.env);
    const hasRole = await fraudStore.checkAdminRole(session.user.id, 'auditor');
    if (!hasRole) {
      return c.json(error('FORBIDDEN'), 403);
    }

    const status = c.req.query('status') || 'frozen';
    const userId = c.req.query('userId') || undefined;
    const limitQuery = c.req.query('limit');
    const offsetQuery = c.req.query('offset');
    const limit = limitQuery ? parseInt(limitQuery, 10) : 50;
    const offset = offsetQuery ? parseInt(offsetQuery, 10) : 0;

    const result = await fraudStore.getFrozenRewards({
      status,
      userId,
      limit: Number.isNaN(limit) ? 50 : limit,
      offset: Number.isNaN(offset) ? 0 : offset,
    });

    const response: AdminFrozenRewardsResponse = {
      apiVersion: 'v1',
      rewards: result.rewards,
      total: result.total,
      limit,
      offset,
    };

    return c.json(response);
  });

  // POST /admin/fraud/review
  routes.post('/admin/fraud/review', async (c) => {
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

    const fraudStore = makeStore(c.env);
    // Requires 'admin' role ('admin' or 'superadmin'; 'auditor' is NOT allowed to mutate)
    const hasRole = await fraudStore.checkAdminRole(session.user.id, 'admin');
    if (!hasRole) {
      return c.json(error('FORBIDDEN'), 403);
    }

    let body;
    try {
      const raw = await c.req.json();
      body = adminFraudReviewRequestSchema.parse(raw);
    } catch {
      return c.json(error('INVALID_REQUEST'), 400);
    }

    try {
      const result = await fraudStore.reviewReward({
        rewardId: body.rewardId,
        adminUserId: session.user.id,
        decision: body.decision,
        reason: body.reason,
      });

      if (result.error) {
        if (result.error === 'FORBIDDEN') {
          return c.json(error('FORBIDDEN'), 403);
        }
        if (result.error === 'ALREADY_REVIEWED') {
          return c.json(error('ALREADY_REVIEWED'), 409);
        }
        if (result.error === 'REWARD_NOT_FOUND') {
          return c.json(error('REWARD_NOT_FOUND'), 404);
        }
        if (result.error === 'REASONING_REQUIRED') {
          return c.json(error('REASONING_REQUIRED'), 400);
        }
        return c.json(error(result.error), 400);
      }

      const response: AdminFraudReviewResponse = {
        apiVersion: 'v1',
        success: true,
        decision:
          result.decision ??
          (body.decision === 'approve' ? 'approved' : 'rejected'),
        frozenRewardId: result.frozenRewardId ?? body.rewardId,
        creditedCash: result.creditedCash,
        creditedSeasonPoints: result.creditedSeasonPoints,
        canceledCash: result.canceledCash,
        canceledSeasonPoints: result.canceledSeasonPoints,
        newCash: result.newCash,
        newSeasonPoints: result.newSeasonPoints,
        reviewedAt: result.reviewedAt ?? new Date(now() * 1000).toISOString(),
      };

      return c.json(response);
    } catch {
      return c.json(error('REVIEW_FAILED'), 500);
    }
  });

  return routes;
}
