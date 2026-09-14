import { createHmac } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Bindings } from '../auth/env';
import { createTestDatabase } from '../auth/test-db';
import { createApp } from '../index';

const now = Math.floor(Date.now() / 1000);
const origin = 'https://empire.example';
const env: Bindings = {
  TELEGRAM_BOT_TOKEN: '123456:test-bot',
  SESSION_SECRET: 'test-only-session-secret-with-enough-entropy',
  APP_ORIGIN: origin,
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-only-key',
  AUTH_RATE_LIMIT: { limit: async () => ({ success: true }) },
};

let database: Awaited<ReturnType<typeof createTestDatabase>>;
let app: ReturnType<typeof createApp>;
let u1: { cookie: string; userId: string };
let u2: { cookie: string; userId: string };
let u3: { cookie: string; userId: string };

function initData(id: number, username: string) {
  const fields = {
    auth_date: String(now),
    query_id: `query-${id}`,
    user: JSON.stringify({ id, first_name: `User${id}`, username }),
  };
  const check = Object.entries(fields)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const key = createHmac('sha256', 'WebAppData')
    .update(env.TELEGRAM_BOT_TOKEN!)
    .digest();
  return new URLSearchParams({
    ...fields,
    hash: createHmac('sha256', key).update(check).digest('hex'),
  }).toString();
}

async function loginUser(id: number, username: string) {
  const res = await app.request(
    '/auth/telegram',
    {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData: initData(id, username),
        requestId: crypto.randomUUID(),
      }),
    },
    env,
  );
  const cookie = res.headers.get('set-cookie')?.split(';')[0];
  const body = (await res.json()) as { user: { id: string } };
  return { cookie: cookie ?? '', userId: body.user.id };
}

describe('Leaderboard API Routes', () => {
  beforeAll(async () => {
    database = await createTestDatabase();
    app = createApp(
      {
        makeAuthStore: () => database.store,
        makeLeaderboardStore: () => database.leaderboardStore,
        makeShopStore: () => database.shopStore,
        makeConfigStore: () => database.configStore,
        makeAnalyticsStore: () => database.analyticsStore,
      },
      () => now,
    );

    u1 = await loginUser(101, 'player_one');
    u2 = await loginUser(102, 'player_two');
    u3 = await loginUser(103, 'player_three');
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await app.request('/leaderboard', {}, env);
    expect(res.status).toBe(401);
  });

  it('queries global leaderboard with deterministic tie-breaking and rank pinning', async () => {
    // Query active season id from db
    const seasonRes = await database.db.query<{ id: string }>(
      "select id from public.seasons where status = 'active' limit 1",
    );
    const activeSeasonId = seasonRes.rows[0]?.id;
    expect(activeSeasonId).toBeDefined();

    // Insert test scores with a tie:
    // u3 has 2500 points
    // u2 has 1000 points (earlier updated_at)
    // u1 has 1000 points (later updated_at)
    await database.db.exec(`
      insert into public.season_scores (season_id, user_id, points, mission_points, referral_points, updated_at)
      values
        ('${activeSeasonId}', '${u3.userId}', 2500, 500, 2000, now()),
        ('${activeSeasonId}', '${u2.userId}', 1000, 1000, 0, now() - interval '1 hour'),
        ('${activeSeasonId}', '${u1.userId}', 1000, 500, 500, now())
      on conflict (season_id, user_id) do update set points = excluded.points, updated_at = excluded.updated_at;
    `);

    // Request global leaderboard as user 1
    const res = await app.request(
      '/leaderboard',
      {
        headers: { Cookie: u1.cookie },
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      apiVersion: string;
      entries: Array<{ rank: number; userId: string; points: number }>;
      currentUser: { rank: number; points: number };
      totalCount: number;
    };

    expect(body.apiVersion).toBe('v1');
    expect(body.totalCount).toBe(3);

    // Rank 1: u3 (2500 pts)
    expect(body.entries[0]?.userId).toBe(u3.userId);
    expect(body.entries[0]?.rank).toBe(1);

    // Rank 2: u2 (1000 pts, earlier time wins tie-break)
    expect(body.entries[1]?.userId).toBe(u2.userId);
    expect(body.entries[1]?.rank).toBe(2);

    // Rank 3: u1 (1000 pts, later time)
    expect(body.entries[2]?.userId).toBe(u1.userId);
    expect(body.entries[2]?.rank).toBe(3);

    // Current user rank pinning for u1
    expect(body.currentUser.rank).toBe(3);
    expect(body.currentUser.points).toBe(1000);
  });

  it('supports keyset cursor pagination', async () => {
    // Fetch page 1 with limit 1
    const page1Res = await app.request(
      '/leaderboard?limit=1',
      { headers: { Cookie: u1.cookie } },
      env,
    );
    expect(page1Res.status).toBe(200);
    const page1 = (await page1Res.json()) as {
      entries: Array<{ rank: number }>;
      nextCursor: string;
      hasMore: boolean;
    };
    expect(page1.entries).toHaveLength(1);
    expect(page1.entries[0]?.rank).toBe(1);
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).not.toBeNull();

    // Fetch page 2 using cursor
    const page2Res = await app.request(
      `/leaderboard?limit=1&cursor=${encodeURIComponent(page1.nextCursor)}`,
      { headers: { Cookie: u1.cookie } },
      env,
    );
    expect(page2Res.status).toBe(200);
    const page2 = (await page2Res.json()) as {
      entries: Array<{ rank: number }>;
    };
    expect(page2.entries).toHaveLength(1);
    expect(page2.entries[0]?.rank).toBe(2);
  });

  it('filters leaderboard to friend network', async () => {
    // Create a referral link between u1 and u2
    await database.db.exec(`
      insert into public.referrals (invitee_user_id, referrer_user_id, code)
      values ('${u2.userId}', '${u1.userId}', 'ref_player1')
      on conflict (invitee_user_id) do nothing;
    `);

    // Fetch friend leaderboard for u1
    const res = await app.request(
      '/leaderboard?scope=friends',
      { headers: { Cookie: u1.cookie } },
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      entries: Array<{ userId: string }>;
      totalCount: number;
    };

    // Should only contain u1 and u2 (u3 excluded)
    expect(body.totalCount).toBe(2);
    const userIds = body.entries.map((e) => e.userId);
    expect(userIds).toContain(u1.userId);
    expect(userIds).toContain(u2.userId);
  });

  it('freezes an active season, archives final scores, and prevents double-freeze', async () => {
    const seasonRes = await database.db.query<{ id: string }>(
      "select id from public.seasons where status = 'active' limit 1",
    );
    const seasonId = seasonRes.rows[0]!.id;

    // Freeze season
    const freezeRes = await app.request(
      `/admin/seasons/${seasonId}/freeze`,
      {
        method: 'POST',
        headers: {
          Cookie: u1.cookie,
          Origin: origin,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Season 1 Conclusion' }),
      },
      env,
    );

    expect(freezeRes.status).toBe(200);
    const freezeBody = (await freezeRes.json()) as {
      status: string;
      archivedParticipantsCount: number;
    };
    expect(freezeBody.status).toBe('frozen');
    expect(freezeBody.archivedParticipantsCount).toBe(3);

    // Verify season_archives table has the snapshot rows
    const archives = await database.db.query<{
      user_id: string;
      final_rank: number;
      final_points: number;
    }>(
      `select user_id, final_rank, final_points from public.season_archives where season_id = '${seasonId}' order by final_rank asc`,
    );
    expect(archives.rows).toHaveLength(3);
    expect(archives.rows[0]?.final_rank).toBe(1);
    expect(Number(archives.rows[0]?.final_points)).toBe(2500);

    // Attempt to freeze already-frozen season should return 409 Conflict
    const doubleFreezeRes = await app.request(
      `/admin/seasons/${seasonId}/freeze`,
      {
        method: 'POST',
        headers: {
          Cookie: u1.cookie,
          Origin: origin,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Duplicate freeze attempt' }),
      },
      env,
    );
    expect(doubleFreezeRes.status).toBe(409);
  });
});
