import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { setCookie } from 'hono/cookie';
import { telegramLoginSchema, type PlayerState } from '@empire/shared';
import { z } from 'zod';
import { authConfig, type Bindings } from './env';
import {
  keyedDigest,
  signSession,
  validateInitData,
  verifySession,
} from './crypto';
import { SupabaseAuthStore, type AuthStore, type StoredSession } from './store';

const COOKIE = '__Host-empire_session';
function sessionCookie(header: string) {
  if (header.length > 8192) return null;
  const values = header
    .split(';')
    .map((v) => v.trim())
    .filter((v) => v.startsWith(`${COOKIE}=`));
  return values.length === 1 ? values[0]!.slice(COOKIE.length + 1) : null;
}
function state(session: StoredSession): PlayerState {
  return {
    apiVersion: 'v1',
    user: session.user,
    session: { expiresAt: new Date(session.expiresAt * 1000).toISOString() },
    game: { status: 'not_initialized' },
  };
}
const error = (code: string) => ({
  apiVersion: 'v1' as const,
  error: { code },
});

export function createAuthRoutes(
  makeStore: (env: Bindings) => AuthStore = (env) =>
    new SupabaseAuthStore(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!),
  now: () => number = () => Math.floor(Date.now() / 1000),
) {
  const routes = new Hono<{ Bindings: Bindings }>();
  routes.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'no-referrer');
    await next();
  });
  routes.use(
    '*',
    bodyLimit({
      maxSize: 20000,
      onError: (c) => c.json(error('INVALID_REQUEST'), 413),
    }),
  );
  routes.use('*', async (c, next) => {
    if (c.req.method === 'POST') {
      const config = authConfig(c.env ?? {});
      if (!config) return c.json(error('AUTH_UNAVAILABLE'), 503);
      if (c.req.header('Origin') !== config.origin)
        return c.json(error('FORBIDDEN'), 403);
      if (
        c.req.header('Content-Type')?.split(';')[0]?.trim().toLowerCase() !==
        'application/json'
      )
        return c.json(error('INVALID_REQUEST'), 415);
    }
    await next();
  });
  async function current(header: string, env: Bindings, store: AuthStore) {
    const token = sessionCookie(header);
    if (!token) return null;
    let claims;
    try {
      claims = await verifySession(token, env.SESSION_SECRET!, now());
    } catch {
      return null;
    }
    const record = await store.getSession(claims.sid);
    if (
      !record ||
      record.issuedAt !== claims.iat ||
      record.expiresAt !== claims.exp ||
      record.expiresAt <= now()
    )
      return null;
    return record;
  }
  routes.post('/auth/telegram', async (c) => {
    const config = authConfig(c.env)!;
    // Cloudflare overwrites CF-Connecting-IP. No X-Forwarded-For trust.
    const ip = c.req.header('CF-Connecting-IP') ?? 'local-unidentified';
    const key = await keyedDigest(`empire.auth.ip:${ip}`, config.secret);
    if (!(await config.limiter.limit({ key })).success)
      return c.json(error('RATE_LIMITED'), 429, { 'Retry-After': '60' });
    let body;
    try {
      body = telegramLoginSchema.parse(await c.req.json());
    } catch {
      return c.json(error('INVALID_REQUEST'), 400);
    }
    let verified;
    try {
      verified = await validateInitData(body.initData, config.bot, now());
    } catch {
      return c.json(error('INVALID_INIT_DATA'), 401);
    }
    const userLimit = await config.limiter.limit({
      key: await keyedDigest(
        `empire.auth.user:${verified.user.id}`,
        config.secret,
      ),
    });
    if (!userLimit.success)
      return c.json(error('RATE_LIMITED'), 429, { 'Retry-After': '60' });
    const requestHash = await keyedDigest(
      `empire.auth.retry:${body.requestId}`,
      config.secret,
    );
    const result = await makeStore(c.env).login(
      verified.user,
      verified.fingerprint,
      requestHash,
      verified.authDate,
    );
    if (result.outcome !== 'ok') {
      return result.outcome === 'replay'
        ? c.json(error('AUTH_REPLAY'), 409)
        : c.json(error('ACCOUNT_UNAVAILABLE'), 403);
    }
    if (
      result.session.user.telegramId !== String(verified.user.id) ||
      result.session.expiresAt <= now()
    )
      throw new Error('Invalid stored session');
    const { sid, issuedAt: iat, expiresAt: exp } = result.session;
    setCookie(c, COOKIE, await signSession({ sid, iat, exp }, config.secret), {
      secure: true,
      httpOnly: true,
      sameSite: 'None',
      path: '/',
      maxAge: Math.max(0, exp - now()),
    });
    return c.json(state(result.session));
  });
  routes.get('/me/state', async (c) => {
    if (!sessionCookie(c.req.header('Cookie') ?? ''))
      return c.json(error('UNAUTHORIZED'), 401);
    if (!authConfig(c.env ?? {})) return c.json(error('AUTH_UNAVAILABLE'), 503);
    const record = await current(
      c.req.header('Cookie') ?? '',
      c.env,
      makeStore(c.env),
    );
    return record ? c.json(state(record)) : c.json(error('UNAUTHORIZED'), 401);
  });
  routes.post('/auth/logout', async (c) => {
    try {
      z.object({})
        .strict()
        .parse(await c.req.json());
    } catch {
      return c.json(error('INVALID_REQUEST'), 400);
    }
    const store = makeStore(c.env);
    const record = await current(c.req.header('Cookie') ?? '', c.env, store);
    if (record) await store.revoke(record.sid);
    setCookie(c, COOKIE, '', {
      secure: true,
      httpOnly: true,
      sameSite: 'None',
      path: '/',
      maxAge: 0,
    });
    return c.body(null, 204);
  });
  routes.onError((_err, c) => c.json(error('AUTH_UNAVAILABLE'), 503));
  return routes;
}
