import { Hono } from 'hono';
import {
  createClanRequestSchema,
  createClanResponseSchema,
  joinClanRequestSchema,
  joinClanResponseSchema,
  clanLeaderboardResponseSchema,
  type ClanLeaderboardResponse,
} from '@empire/shared';
import type { Bindings } from '../auth/env';
import { getCurrentUserSession } from '../auth/routes';
import { SupabaseAuthStore, type AuthStore } from '../auth/store';
import { SupabaseClanStore, type ClanStore } from './store';

const error = (code: string, details?: unknown) => ({
  apiVersion: 'v1' as const,
  error: { code, ...(details ? { details } : {}) },
});

export function createClanRoutes(
  makeStore: (env: Bindings) => ClanStore = (env) =>
    new SupabaseClanStore(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY),
  makeAuthStore: (env: Bindings) => AuthStore = (env) =>
    new SupabaseAuthStore(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!),
  now: () => number = () => Math.floor(Date.now() / 1000),
) {
  const routes = new Hono<{ Bindings: Bindings }>();

  // GET /clans/leaderboard
  routes.get('/clans/leaderboard', async (c) => {
    const authStore = makeAuthStore(c.env);
    const session = await getCurrentUserSession(
      c.req.header('Cookie') ??
        c.req.header('Authorization') ??
        c.req.header('X-Empire-Session'),
      c.env,
      authStore,
      now,
    );

    const store = makeStore(c.env);
    const clans = await store.getClanLeaderboard(20);
    const userClan = session ? await store.getUserClan(session.user.id) : null;

    const responseData: ClanLeaderboardResponse = {
      apiVersion: 'v1',
      clans: clans.map((clan, index) => ({
        rank: index + 1,
        clanId: clan.id,
        name: clan.name,
        tag: clan.tag,
        emblem: clan.emblem,
        memberCount: clan.memberCount,
        clanLevel: clan.clanLevel,
        totalProductionPerSecond: clan.totalProductionPerSecond,
      })),
      userClanId: userClan?.id ?? null,
    };

    return c.json(clanLeaderboardResponseSchema.parse(responseData), 200);
  });

  // GET /clans/my
  routes.get('/clans/my', async (c) => {
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
    const clan = await store.getUserClan(session.user.id);
    return c.json({ apiVersion: 'v1', clan }, 200);
  });

  // GET /clans/:id
  routes.get('/clans/:id', async (c) => {
    const clanId = c.req.param('id');
    const store = makeStore(c.env);
    const clan = await store.getClan(clanId);
    if (!clan) {
      return c.json(error('CLAN_NOT_FOUND'), 404);
    }
    return c.json({ apiVersion: 'v1', clan }, 200);
  });

  // POST /clans/create
  routes.post('/clans/create', async (c) => {
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

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(error('INVALID_JSON'), 400);
    }

    const parsed = createClanRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(error('INVALID_REQUEST', parsed.error.format()), 400);
    }

    const store = makeStore(c.env);
    const result = await store.createClan(
      session.user.id,
      session.user.username ?? 'AnonBoss',
      parsed.data.name,
      parsed.data.tag,
      parsed.data.emblem,
      parsed.data.telegramChannelUrl,
    );

    if (result.error) {
      return c.json(error(result.error), 400);
    }

    return c.json(
      createClanResponseSchema.parse({
        apiVersion: 'v1',
        clan: result.clan,
        newCash: result.newCash,
      }),
      200,
    );
  });

  // POST /clans/join
  routes.post('/clans/join', async (c) => {
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

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(error('INVALID_JSON'), 400);
    }

    const parsed = joinClanRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(error('INVALID_REQUEST', parsed.error.format()), 400);
    }

    const store = makeStore(c.env);
    const result = await store.joinClan(
      session.user.id,
      session.user.username ?? 'AnonPlayer',
      parsed.data.clanId,
    );

    if (result.error) {
      return c.json(error(result.error), 400);
    }

    return c.json(
      joinClanResponseSchema.parse({
        apiVersion: 'v1',
        clanId: result.clanId,
        joinedAt: new Date().toISOString(),
        newMemberCount: result.newMemberCount,
      }),
      200,
    );
  });

  return routes;
}
