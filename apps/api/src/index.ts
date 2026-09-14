import { Hono } from 'hono';
import type { HealthResponse } from '@empire/shared';

const app = new Hono();

app.get('/health', (c) =>
  c.json({
    apiVersion: 'v1',
    status: 'ok',
    service: 'empire-api',
  } satisfies HealthResponse),
);

app.notFound((c) =>
  c.json({ apiVersion: 'v1', error: { code: 'NOT_FOUND' } }, 404),
);

export default app;
