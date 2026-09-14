import { Hono } from 'hono';
import type { HealthResponse } from '@empire/shared';
import type { Bindings } from './auth/env';
import type { AuthStore } from './auth/store';
import { createAuthRoutes } from './auth/routes';
import type { LeaderboardStore } from './leaderboard/store';
import { createLeaderboardRoutes } from './leaderboard/routes';
import type { ShopStore } from './shop/store';
import { createShopRoutes } from './shop/routes';
import type { ConfigStore } from './config/store';
import { createConfigRoutes } from './config/routes';
import type { AnalyticsStore } from './analytics/store';
import { createAnalyticsRoutes } from './analytics/routes';

const healthHandler = (c: { json: (data: HealthResponse) => Response }) =>
  c.json({
    apiVersion: 'v1',
    status: 'ok',
    service: 'empire-api',
  } satisfies HealthResponse);

export interface AppStoreFactories {
  makeAuthStore?: (env: Bindings) => AuthStore;
  makeLeaderboardStore?: (env: Bindings) => LeaderboardStore;
  makeShopStore?: (env: Bindings) => ShopStore;
  makeConfigStore?: (env: Bindings) => ConfigStore;
  makeAnalyticsStore?: (env: Bindings) => AnalyticsStore;
}

export function createApp(
  storesOrAuthStore?: AppStoreFactories | ((env: Bindings) => AuthStore),
  now?: () => number,
) {
  const app = new Hono<{ Bindings: Bindings }>();

  let factories: AppStoreFactories = {};
  if (typeof storesOrAuthStore === 'function') {
    factories.makeAuthStore = storesOrAuthStore;
  } else if (storesOrAuthStore) {
    factories = storesOrAuthStore;
  }

  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  // 1. Auth routes
  const auth = createAuthRoutes(factories.makeAuthStore, now);
  app.route('/', auth);
  app.route('/api', auth);

  // 2. Leaderboard routes
  const leaderboard = createLeaderboardRoutes(
    factories.makeLeaderboardStore,
    factories.makeAuthStore,
    now,
  );
  app.route('/', leaderboard);
  app.route('/api', leaderboard);

  // 3. Shop & Monetization routes
  const shop = createShopRoutes(
    factories.makeShopStore,
    factories.makeAuthStore,
    now,
  );
  app.route('/', shop);
  app.route('/api', shop);

  // 4. Remote config routes
  const config = createConfigRoutes(
    factories.makeConfigStore,
    factories.makeAuthStore,
    now,
  );
  app.route('/', config);
  app.route('/api', config);

  // 5. Analytics routes
  const analytics = createAnalyticsRoutes(
    factories.makeAnalyticsStore,
    factories.makeAuthStore,
    now,
  );
  app.route('/', analytics);
  app.route('/api', analytics);

  app.notFound((c) =>
    c.json({ apiVersion: 'v1', error: { code: 'NOT_FOUND' } }, 404),
  );

  return app;
}

export default createApp();
