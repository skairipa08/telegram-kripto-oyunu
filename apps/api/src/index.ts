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
import type { EconomyStore } from './economy/store';
import { createEconomyRoutes } from './economy/routes';
import type { FraudStore } from './fraud/store';
import { createFraudRoutes } from './fraud/routes';
import type { AdminStore } from './admin/store';
import { createAdminRoutes } from './admin/routes';
import type { ArcadeStore } from './arcade/store';
import { createArcadeRoutes } from './arcade/routes';

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
  makeEconomyStore?: (env: Bindings) => EconomyStore;
  makeFraudStore?: (env: Bindings) => FraudStore;
  makeAdminStore?: (env: Bindings) => AdminStore;
  makeArcadeStore?: (env: Bindings) => ArcadeStore;
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

  // 6. Economy routes
  const economy = createEconomyRoutes(
    factories.makeEconomyStore,
    factories.makeAuthStore,
    now,
  );
  app.route('/', economy);
  app.route('/api', economy);

  // 7. Anti-fraud & Admin review routes
  const fraud = createFraudRoutes(
    factories.makeFraudStore,
    factories.makeAuthStore,
    now,
  );
  app.route('/', fraud);
  app.route('/api', fraud);

  // 8. Admin governance & feature flags routes
  const admin = createAdminRoutes(
    factories.makeAdminStore,
    factories.makeAuthStore,
    now,
  );
  app.route('/', admin);
  app.route('/api', admin);

  // 9. Arcade routes (Notcoin Tap, Catizen Merge, Candlestick Crash, Dynasty Cipher)
  const arcade = createArcadeRoutes(
    factories.makeArcadeStore,
    factories.makeAuthStore,
    now,
  );
  app.route('/', arcade);
  app.route('/api', arcade);

  app.notFound((c) =>
    c.json({ apiVersion: 'v1', error: { code: 'NOT_FOUND' } }, 404),
  );

  return app;
}

export { createFraudRoutes } from './fraud/routes';
export type { FraudStore } from './fraud/store';
export { createAdminRoutes } from './admin/routes';
export type { AdminStore } from './admin/store';
export { createArcadeRoutes } from './arcade/routes';
export type { ArcadeStore } from './arcade/store';

export default createApp();
