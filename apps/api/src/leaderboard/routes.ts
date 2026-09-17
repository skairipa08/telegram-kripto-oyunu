import { Hono } from 'hono';
import {
  filterFriendsLeaderboard,
  paginateLeaderboard,
  pinUserRank,
  rankLeaderboardEntries,
} from '@empire/game-core';
import type {
  FreezeSeasonResponse,
  LeaderboardResponseDto,
} from '@empire/shared';
import type { Bindings } from '../auth/env';
import { getCurrentUserSession } from '../auth/routes';
import { SupabaseAuthStore, type AuthStore } from '../auth/store';
import { SupabaseLeaderboardStore, type LeaderboardStore } from './store';

const error = (code: string) => ({
  apiVersion: 'v1' as const,
  error: { code },
});

export function createLeaderboardRoutes(
  makeStore: (env: Bindings) => LeaderboardStore = (env) =>
    new SupabaseLeaderboardStore(
      env.SUPABASE_URL!,
      env.SUPABASE_SERVICE_ROLE_KEY!,
    ),
  makeAuthStore: (env: Bindings) => AuthStore = (env) =>
    new SupabaseAuthStore(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!),
  now: () => number = () => Math.floor(Date.now() / 1000),
) {
  const routes = new Hono<{ Bindings: Bindings }>();

  // GET /leaderboard
  routes.get('/leaderboard', async (c) => {
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

    const seasonIdParam = c.req.query('seasonId');
    const scopeParam =
      c.req.query('scope') === 'friends' ? 'friends' : 'global';
    const limitParam = Number(c.req.query('limit') ?? '20');
    const limit = Number.isFinite(limitParam)
      ? Math.max(1, Math.min(limitParam, 100))
      : 20;
    const cursor = c.req.query('cursor') ?? null;
    const offsetParam = c.req.query('offset');
    const offset = offsetParam ? Number(offsetParam) : undefined;

    const store = makeStore(c.env);
    const season = await store.getActiveOrSpecifiedSeason(seasonIdParam);
    if (!season) {
      return c.json(error('SEASON_NOT_FOUND'), 404);
    }

    let rawScores = await store.getScores(season.id);

    if (scopeParam === 'friends') {
      const friendIds = await store.getFriendUserIds(session.user.id);
      rawScores = filterFriendsLeaderboard(
        rawScores,
        session.user.id,
        friendIds,
      );
    }

    const ranked = rankLeaderboardEntries(rawScores, session.user.id);
    const currentUserPinned = pinUserRank(ranked, session.user.id);
    const paginated = paginateLeaderboard(ranked, { limit, cursor, offset });

    const response: LeaderboardResponseDto = {
      apiVersion: 'v1',
      seasonId: season.id,
      scope: scopeParam,
      entries: paginated.entries.map((entry) => ({
        rank: entry.rank,
        userId: entry.userId,
        username: entry.username,
        firstName: entry.firstName,
        points: entry.points,
        missionPoints: entry.missionPoints,
        referralPoints: entry.referralPoints,
        isCurrentUser: entry.isCurrentUser,
      })),
      currentUser: currentUserPinned,
      totalCount: paginated.totalCount,
      nextCursor: paginated.nextCursor,
      hasMore: paginated.hasMore,
    };

    return c.json(response);
  });

  // POST /admin/seasons/:id/freeze
  routes.post('/admin/seasons/:id/freeze', async (c) => {
    const seasonId = c.req.param('id');
    const authStore = makeAuthStore(c.env);
    const session = await getCurrentUserSession(
      c.req.header('Cookie') ??
        c.req.header('Authorization') ??
        c.req.header('X-Empire-Session'),
      c.env,
      authStore,
      now,
    );

    let reason: string | undefined;
    try {
      const body = (await c.req.json()) as { reason?: string };
      reason = body.reason;
    } catch {
      // Body is optional
    }

    const store = makeStore(c.env);
    try {
      const result = await store.freezeSeason(
        seasonId,
        session?.user.id,
        reason,
      );
      const response: FreezeSeasonResponse = {
        apiVersion: 'v1',
        seasonId: result.seasonId,
        status: 'frozen',
        frozenAt: result.frozenAt,
        archivedParticipantsCount: result.archivedParticipantsCount,
      };
      return c.json(response);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('SEASON_NOT_FOUND')) {
        return c.json(error('SEASON_NOT_FOUND'), 404);
      }
      if (msg.includes('SEASON_ALREADY_FROZEN')) {
        return c.json(error('SEASON_ALREADY_FROZEN'), 409);
      }
      return c.json(error('SERVER_ERROR'), 500);
    }
  });

  return routes;
}
