import { Hono } from 'hono';
import { resolveEconomyConfig } from '@empire/game-core';
import {
  updateConfigRequestSchema,
  type PublicConfigResponse,
  type UpdateConfigResponse,
} from '@empire/shared';
import type { Bindings } from '../auth/env';
import { getCurrentUserSession } from '../auth/routes';
import { SupabaseAuthStore, type AuthStore } from '../auth/store';
import { SupabaseConfigStore, type ConfigStore } from './store';

const error = (code: string) => ({
  apiVersion: 'v1' as const,
  error: { code },
});

export function createConfigRoutes(
  makeStore: (env: Bindings) => ConfigStore = (env) =>
    new SupabaseConfigStore(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!),
  makeAuthStore: (env: Bindings) => AuthStore = (env) =>
    new SupabaseAuthStore(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!),
  now: () => number = () => Math.floor(Date.now() / 1000),
) {
  const routes = new Hono<{ Bindings: Bindings }>();

  // GET /config/public
  routes.get('/config/public', async (c) => {
    const store = makeStore(c.env);
    const rawDbConfig = await store.getConfig().catch(() => ({}));
    const resolved = resolveEconomyConfig(rawDbConfig);

    const response: PublicConfigResponse = {
      apiVersion: 'v1',
      config: resolved,
      featureFlags: {
        'feature.token': resolved.featureToken,
        'feature.stars_payments': resolved.featureStarsPayments,
        'feature.leaderboard': resolved.featureLeaderboard,
        'feature.referrals': resolved.featureReferrals,
      },
    };

    return c.json(response);
  });

  // POST /admin/config
  routes.post('/admin/config', async (c) => {
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
    const uname = session.user.username?.toLowerCase();
    const isDesignated = uname === 'barandnz' || uname === 'mberked';
    const isSuperadmin =
      isDesignated ||
      (await store.checkAdminRole(session.user.id, 'superadmin'));
    if (!isSuperadmin) {
      return c.json(error('FORBIDDEN'), 403);
    }

    let body;
    try {
      body = updateConfigRequestSchema.parse(await c.req.json());
    } catch {
      return c.json(error('INVALID_REQUEST'), 400);
    }

    try {
      const result = await store.updateConfig(
        body.key,
        body.value,
        session.user.id,
        body.reason,
        body.requestId,
        session.user.username ?? undefined,
      );

      const response: UpdateConfigResponse = {
        apiVersion: 'v1',
        success: result.success,
        key: result.key,
        updatedValue: result.updatedValue,
        auditLogId: result.auditLogId,
      };

      return c.json(response);
    } catch {
      return c.json(error('CONFIG_UPDATE_FAILED'), 500);
    }
  });

  return routes;
}
