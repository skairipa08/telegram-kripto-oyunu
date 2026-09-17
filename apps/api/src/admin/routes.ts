import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import type { Bindings } from '../auth/env';
import { getCurrentUserSession } from '../auth/routes';
import { SupabaseAuthStore, type AuthStore } from '../auth/store';
import { SupabaseAdminStore, type AdminStore } from './store';

const error = (code: string) => ({
  apiVersion: 'v1' as const,
  error: { code },
});

export const updateFeatureFlagSchema = z.object({
  key: z.string().min(1).max(128),
  value: z.unknown(),
  reason: z.string().max(1024).optional(),
  requestId: z.string().uuid().optional(),
});

export const unfreezeAccountSchema = z.object({
  reason: z.string().max(1024).optional().default('Account unfreeze by admin'),
  requestId: z.string().uuid().optional(),
});

export function createAdminRoutes(
  makeStore: (env: Bindings) => AdminStore = (env) =>
    new SupabaseAdminStore(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!),
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
      maxSize: 25000,
      onError: (c) => c.json(error('INVALID_REQUEST'), 413),
    }),
  );

  // Helper for session and RBAC check
  const checkSuperadmin = async (c: Context<{ Bindings: Bindings }>) => {
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
      return {
        ok: false as const,
        status: 401 as const,
        error: error('UNAUTHORIZED'),
      };
    }

    const adminStore = makeStore(c.env);
    const uname = session.user.username?.toLowerCase();
    const isDesignated = uname === 'barandnz' || uname === 'mberked';
    const isSuperadmin =
      isDesignated || (await adminStore.checkSuperadminRole(session.user.id));

    if (!isSuperadmin) {
      return {
        ok: false as const,
        status: 403 as const,
        error: error('FORBIDDEN'),
      };
    }

    return { ok: true as const, session, adminStore };
  };

  // GET /admin/feature-flags
  routes.get('/admin/feature-flags', async (c) => {
    const auth = await checkSuperadmin(c);
    if (!auth.ok) {
      return c.json(auth.error, auth.status);
    }

    const flags = await auth.adminStore.getFeatureFlags();
    return c.json({
      apiVersion: 'v1',
      flags,
      updatedAt: new Date(now() * 1000).toISOString(),
    });
  });

  // POST /admin/feature-flags
  routes.post('/admin/feature-flags', async (c) => {
    const auth = await checkSuperadmin(c);
    if (!auth.ok) {
      return c.json(auth.error, auth.status);
    }

    let body;
    try {
      body = updateFeatureFlagSchema.parse(await c.req.json());
    } catch {
      return c.json(error('INVALID_REQUEST'), 400);
    }

    try {
      const result = await auth.adminStore.updateConfigOrFlag({
        key: body.key,
        value: body.value,
        adminUserId: auth.session.user.id,
        reason: body.reason,
        requestId: body.requestId,
        adminUsername: auth.session.user.username ?? undefined,
      });

      return c.json({
        apiVersion: 'v1',
        success: true,
        key: result.key,
        updatedValue: result.updatedValue,
        auditLogId: result.auditLogId,
      });
    } catch {
      return c.json(error('FLAG_UPDATE_FAILED'), 500);
    }
  });

  // GET /admin/audit-logs
  routes.get('/admin/audit-logs', async (c) => {
    const auth = await checkSuperadmin(c);
    if (!auth.ok) {
      return c.json(auth.error, auth.status);
    }

    const limitQuery = c.req.query('limit');
    const offsetQuery = c.req.query('offset');
    const targetKey = c.req.query('targetKey') || undefined;
    const limit = limitQuery ? parseInt(limitQuery, 10) : 50;
    const offset = offsetQuery ? parseInt(offsetQuery, 10) : 0;

    const result = await auth.adminStore.getAuditLogs({
      limit: Number.isNaN(limit) ? 50 : limit,
      offset: Number.isNaN(offset) ? 0 : offset,
      targetKey,
    });

    return c.json({
      apiVersion: 'v1',
      logs: result.logs,
      total: result.total,
      limit: Number.isNaN(limit) ? 50 : limit,
      offset: Number.isNaN(offset) ? 0 : offset,
    });
  });

  // GET /admin/fraud/accounts
  routes.get('/admin/fraud/accounts', async (c) => {
    const auth = await checkSuperadmin(c);
    if (!auth.ok) {
      return c.json(auth.error, auth.status);
    }

    const limitQuery = c.req.query('limit');
    const offsetQuery = c.req.query('offset');
    const limit = limitQuery ? parseInt(limitQuery, 10) : 50;
    const offset = offsetQuery ? parseInt(offsetQuery, 10) : 0;

    const result = await auth.adminStore.getFlaggedAccounts({
      limit: Number.isNaN(limit) ? 50 : limit,
      offset: Number.isNaN(offset) ? 0 : offset,
    });

    return c.json({
      apiVersion: 'v1',
      accounts: result.accounts,
      total: result.total,
      limit: Number.isNaN(limit) ? 50 : limit,
      offset: Number.isNaN(offset) ? 0 : offset,
    });
  });

  // POST /admin/fraud/accounts/:id/unfreeze
  routes.post('/admin/fraud/accounts/:id/unfreeze', async (c) => {
    const auth = await checkSuperadmin(c);
    if (!auth.ok) {
      return c.json(auth.error, auth.status);
    }

    const targetUserId = c.req.param('id');
    if (!targetUserId) {
      return c.json(error('INVALID_REQUEST'), 400);
    }

    let body: z.infer<typeof unfreezeAccountSchema>;
    try {
      const raw = await c.req.json().catch(() => ({}));
      body = unfreezeAccountSchema.parse(raw);
    } catch {
      return c.json(error('INVALID_REQUEST'), 400);
    }

    try {
      const result = await auth.adminStore.unfreezeAccount({
        targetUserId,
        adminUserId: auth.session.user.id,
        reason: body.reason ?? 'Account unfreeze by admin',
        requestId: body.requestId,
        adminUsername: auth.session.user.username ?? undefined,
      });

      if (result.error === 'USER_NOT_FOUND') {
        return c.json(error('USER_NOT_FOUND'), 404);
      }
      if (!result.success) {
        return c.json(error(result.error ?? 'UNFREEZE_FAILED'), 400);
      }

      return c.json({
        apiVersion: 'v1',
        success: true,
        userId: result.userId,
        status: result.status,
        unfrozenRewardsCount: result.unfrozenRewardsCount ?? 0,
        creditedCash: result.creditedCash ?? 0,
        creditedSeasonPoints: result.creditedSeasonPoints ?? 0,
        reviewedAt: result.reviewedAt,
      });
    } catch {
      return c.json(error('UNFREEZE_FAILED'), 500);
    }
  });

  // POST /admin/fraud/accounts/:id/resolve (alias for unfreeze)
  routes.post('/admin/fraud/accounts/:id/resolve', async (c) => {
    const auth = await checkSuperadmin(c);
    if (!auth.ok) {
      return c.json(auth.error, auth.status);
    }

    const targetUserId = c.req.param('id');
    if (!targetUserId) {
      return c.json(error('INVALID_REQUEST'), 400);
    }

    let body: z.infer<typeof unfreezeAccountSchema>;
    try {
      const raw = await c.req.json().catch(() => ({}));
      body = unfreezeAccountSchema.parse(raw);
    } catch {
      return c.json(error('INVALID_REQUEST'), 400);
    }

    try {
      const result = await auth.adminStore.unfreezeAccount({
        targetUserId,
        adminUserId: auth.session.user.id,
        reason: body.reason ?? 'Account resolved by admin',
        requestId: body.requestId,
        adminUsername: auth.session.user.username ?? undefined,
      });

      if (result.error === 'USER_NOT_FOUND') {
        return c.json(error('USER_NOT_FOUND'), 404);
      }
      if (!result.success) {
        return c.json(error(result.error ?? 'RESOLVE_FAILED'), 400);
      }

      return c.json({
        apiVersion: 'v1',
        success: true,
        userId: result.userId,
        status: result.status,
        unfrozenRewardsCount: result.unfrozenRewardsCount ?? 0,
        creditedCash: result.creditedCash ?? 0,
        creditedSeasonPoints: result.creditedSeasonPoints ?? 0,
        reviewedAt: result.reviewedAt,
      });
    } catch {
      return c.json(error('RESOLVE_FAILED'), 500);
    }
  });

  return routes;
}
