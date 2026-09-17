import { Hono, type Context } from 'hono';
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
import type { ClanStore } from './clans/store';
import { createClanRoutes } from './clans/routes';
import type { ComboStore } from './combo/store';
import { createComboRoutes } from './combo/routes';

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
  makeClanStore?: (env: Bindings) => ClanStore;
  makeComboStore?: (env: Bindings) => ComboStore;
}

import { setCookie } from 'hono/cookie';
import { COOKIE } from './auth/routes';
import { signSession } from './auth/crypto';
import { authConfig } from './auth/env';
import { SupabaseAuthStore } from './auth/store';
import { SupabaseLeaderboardStore } from './leaderboard/store';
import { SupabaseShopStore } from './shop/store';
import { SupabaseConfigStore } from './config/store';
import { SupabaseAnalyticsStore } from './analytics/store';
import { SupabaseEconomyStore } from './economy/store';
import { SupabaseFraudStore } from './fraud/store';
import { SupabaseAdminStore } from './admin/store';
import {
  MemoryAuthStore,
  MemoryEconomyStore,
  MemoryLeaderboardStore,
  MemoryShopStore,
  MemoryConfigStore,
  MemoryAnalyticsStore,
  MemoryFraudStore,
  MemoryAdminStore,
} from './dev-store';

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

  // Singleton in-memory stores for dev mode when SUPABASE_URL is not set
  const defaultAuthStore = new MemoryAuthStore();
  const defaultEconomyStore = new MemoryEconomyStore();
  const defaultLeaderboardStore = new MemoryLeaderboardStore();
  const defaultShopStore = new MemoryShopStore();
  const defaultConfigStore = new MemoryConfigStore();
  const defaultAnalyticsStore = new MemoryAnalyticsStore();
  const defaultFraudStore = new MemoryFraudStore();
  const defaultAdminStore = new MemoryAdminStore();

  const getAuthStore =
    factories.makeAuthStore ??
    ((env: Bindings) =>
      env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
        ? new SupabaseAuthStore(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
        : defaultAuthStore);

  const getEconomyStore =
    factories.makeEconomyStore ??
    ((env: Bindings) =>
      env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
        ? new SupabaseEconomyStore(
            env.SUPABASE_URL,
            env.SUPABASE_SERVICE_ROLE_KEY,
          )
        : defaultEconomyStore);

  const getLeaderboardStore =
    factories.makeLeaderboardStore ??
    ((env: Bindings) =>
      env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
        ? new SupabaseLeaderboardStore(
            env.SUPABASE_URL,
            env.SUPABASE_SERVICE_ROLE_KEY,
          )
        : defaultLeaderboardStore);

  const getShopStore =
    factories.makeShopStore ??
    ((env: Bindings) =>
      env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
        ? new SupabaseShopStore(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
        : defaultShopStore);

  const getConfigStore =
    factories.makeConfigStore ??
    ((env: Bindings) =>
      env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
        ? new SupabaseConfigStore(
            env.SUPABASE_URL,
            env.SUPABASE_SERVICE_ROLE_KEY,
          )
        : defaultConfigStore);

  const getAnalyticsStore =
    factories.makeAnalyticsStore ??
    ((env: Bindings) =>
      env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
        ? new SupabaseAnalyticsStore(
            env.SUPABASE_URL,
            env.SUPABASE_SERVICE_ROLE_KEY,
          )
        : defaultAnalyticsStore);

  const getFraudStore =
    factories.makeFraudStore ??
    ((env: Bindings) =>
      env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
        ? new SupabaseFraudStore(
            env.SUPABASE_URL,
            env.SUPABASE_SERVICE_ROLE_KEY,
          )
        : defaultFraudStore);

  const getAdminStore =
    factories.makeAdminStore ??
    ((env: Bindings) =>
      env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
        ? new SupabaseAdminStore(
            env.SUPABASE_URL,
            env.SUPABASE_SERVICE_ROLE_KEY,
          )
        : defaultAdminStore);

  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  // DEV-ONLY: Optional query param bypass (?dev=true) for browser testing outside Telegram.
  // In real Telegram Mini App, requests authenticate via standard initData -> POST /auth/telegram.
  const devBypassHandler = async (c: Context<{ Bindings: Bindings }>) => {
    if ((c.env as Record<string, unknown>).DEV_AUTH_BYPASS !== 'true')
      return null;
    const isDevRequest =
      c.req.query('dev') === 'true' || c.req.header('X-Dev-Bypass') === 'true';
    if (!isDevRequest) return null;

    const authStore = getAuthStore(c.env);
    const loginRes = await authStore.login(
      {
        id: 99999999,
        first_name: 'Dev',
        username: 'dev_user',
        language_code: 'tr',
      },
      'dev-fingerprint',
      'dev-hash',
      Math.floor(Date.now() / 1000),
    );
    if (loginRes.outcome === 'ok') {
      const config = authConfig(c.env);
      if (config) {
        const { sid, issuedAt: iat, expiresAt: exp } = loginRes.session;
        setCookie(
          c,
          COOKIE,
          await signSession({ sid, iat, exp }, config.secret),
          {
            secure: true,
            httpOnly: true,
            sameSite: 'None',
            path: '/',
            maxAge: Math.max(0, exp - Math.floor(Date.now() / 1000)),
          },
        );
      }
      return c.json({
        apiVersion: 'v1',
        user: loginRes.session.user,
        session: {
          expiresAt: new Date(loginRes.session.expiresAt * 1000).toISOString(),
        },
        game: { status: 'not_initialized' },
      });
    }
    return null;
  };

  app.use('/me/state', async (c, next) => {
    const bypassed = await devBypassHandler(c);
    if (bypassed) return bypassed;
    await next();
  });
  app.use('/api/me/state', async (c, next) => {
    const bypassed = await devBypassHandler(c);
    if (bypassed) return bypassed;
    await next();
  });

  // 1. Auth routes (real Telegram + Supabase auth / dev store fallback)
  const auth = createAuthRoutes(getAuthStore, now);
  app.route('/', auth);
  app.route('/api', auth);

  // 2. Leaderboard routes
  const leaderboard = createLeaderboardRoutes(
    getLeaderboardStore,
    getAuthStore,
    now,
  );
  app.route('/', leaderboard);
  app.route('/api', leaderboard);

  // 3. Shop & Monetization routes
  const shop = createShopRoutes(getShopStore, getAuthStore, now);
  app.route('/', shop);
  app.route('/api', shop);

  // 4. Remote config routes
  const config = createConfigRoutes(getConfigStore, getAuthStore, now);
  app.route('/', config);
  app.route('/api', config);

  // 5. Analytics routes
  const analytics = createAnalyticsRoutes(getAnalyticsStore, getAuthStore, now);
  app.route('/', analytics);
  app.route('/api', analytics);

  // 6. Economy routes
  const economy = createEconomyRoutes(getEconomyStore, getAuthStore, now);
  app.route('/', economy);
  app.route('/api', economy);

  // 7. Anti-fraud & Admin review routes
  const fraud = createFraudRoutes(getFraudStore, getAuthStore, now);
  app.route('/', fraud);
  app.route('/api', fraud);

  // 8. Admin governance & feature flags routes
  const admin = createAdminRoutes(getAdminStore, getAuthStore, now);
  app.route('/', admin);
  app.route('/api', admin);

  // 9. Arcade routes (Notcoin Tap, Catizen Merge, Candlestick Crash, Dynasty Cipher)
  const arcade = createArcadeRoutes(
    factories.makeArcadeStore,
    getAuthStore,
    now,
  );
  app.route('/', arcade);
  app.route('/api', arcade);

  // 10. Clan & Cartel routes
  const clans = createClanRoutes(factories.makeClanStore, getAuthStore, now);
  app.route('/', clans);
  app.route('/api', clans);

  // 11. Daily Combo & Daily Cipher routes
  const combo = createComboRoutes(factories.makeComboStore, getAuthStore, now);
  app.route('/', combo);
  app.route('/api', combo);

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
export { createClanRoutes } from './clans/routes';
export type { ClanStore } from './clans/store';
export { createComboRoutes } from './combo/routes';
export type { ComboStore } from './combo/store';

export default createApp();
