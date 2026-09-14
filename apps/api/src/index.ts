import { Hono } from 'hono';
import type { HealthResponse } from '@empire/shared';
import type { Bindings } from './auth/env';
import type { AuthStore } from './auth/store';
import { createAuthRoutes } from './auth/routes';

const healthHandler = (c: { json: (data: HealthResponse) => Response }) =>
  c.json({
    apiVersion: 'v1',
    status: 'ok',
    service: 'empire-api',
  } satisfies HealthResponse);

export function createApp(
  makeStore?: (env: Bindings) => AuthStore,
  now?: () => number,
) {
  const app = new Hono<{ Bindings: Bindings }>();

  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  const auth = createAuthRoutes(makeStore, now);
  app.route('/', auth);
  app.route('/api', auth);

  app.notFound((c) =>
    c.json({ apiVersion: 'v1', error: { code: 'NOT_FOUND' } }, 404),
  );

  return app;
}
export default createApp();
