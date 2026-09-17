import { Hono } from 'hono';
import {
  calculateActivationRate,
  calculateARPPU,
  calculatePayerConversion,
  calculateRetentionCohorts,
  isCanonicalAnalyticsEvent,
} from '@empire/game-core';
import {
  trackAnalyticsEventsRequestSchema,
  type AnalyticsMetricsResponse,
  type TrackAnalyticsEventsResponse,
} from '@empire/shared';
import type { Bindings } from '../auth/env';
import { getCurrentUserSession } from '../auth/routes';
import { SupabaseAuthStore, type AuthStore } from '../auth/store';
import { SupabaseAnalyticsStore, type AnalyticsStore } from './store';

const error = (code: string) => ({
  apiVersion: 'v1' as const,
  error: { code },
});

export function createAnalyticsRoutes(
  makeStore: (env: Bindings) => AnalyticsStore = (env) =>
    new SupabaseAnalyticsStore(
      env.SUPABASE_URL!,
      env.SUPABASE_SERVICE_ROLE_KEY!,
    ),
  makeAuthStore: (env: Bindings) => AuthStore = (env) =>
    new SupabaseAuthStore(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!),
  now: () => number = () => Math.floor(Date.now() / 1000),
) {
  const routes = new Hono<{ Bindings: Bindings }>();

  // POST /analytics/events
  routes.post('/analytics/events', async (c) => {
    const authStore = makeAuthStore(c.env);
    const session = await getCurrentUserSession(
      c.req.header('Cookie') ??
        c.req.header('Authorization') ??
        c.req.header('X-Empire-Session'),
      c.env,
      authStore,
      now,
    );

    let body;
    try {
      body = trackAnalyticsEventsRequestSchema.parse(await c.req.json());
    } catch {
      return c.json(error('INVALID_REQUEST'), 400);
    }

    // Verify canonical events taxonomy
    for (const event of body.events) {
      if (!isCanonicalAnalyticsEvent(event.eventName)) {
        return c.json(error('INVALID_EVENT_NAME'), 400);
      }
    }

    const store = makeStore(c.env);
    const acceptedCount = await store.recordEvents(
      body.events,
      session?.user.id ?? null,
    );

    const response: TrackAnalyticsEventsResponse = {
      apiVersion: 'v1',
      acceptedCount,
      receivedAt: new Date(now() * 1000).toISOString(),
    };

    return c.json(response, 202);
  });

  // GET /analytics/metrics
  routes.get('/analytics/metrics', async (c) => {
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

    const store = makeStore(c.env);
    const [cohortData, metrics] = await Promise.all([
      store.getCohortData(),
      store.getMetrics(),
    ]);

    const cohorts = calculateRetentionCohorts(cohortData);
    const activationRate = calculateActivationRate(
      metrics.totalUsers,
      metrics.activatedUsers,
    );
    const payerConversionRate = calculatePayerConversion(
      metrics.totalUsers,
      metrics.payingUsers,
    );
    const arppu = calculateARPPU(
      metrics.totalStarsRevenue,
      metrics.payingUsers,
    );

    const response: AnalyticsMetricsResponse = {
      apiVersion: 'v1',
      activationRate,
      payerConversionRate,
      totalStarsRevenue: metrics.totalStarsRevenue,
      arppu,
      cohorts,
    };

    return c.json(response);
  });

  return routes;
}
