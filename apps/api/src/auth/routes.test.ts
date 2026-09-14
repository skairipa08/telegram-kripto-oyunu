import { createHmac } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createApp } from '../index';
import { createTestDatabase } from './test-db';
import type { Bindings } from './env';

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

function initData(id: number) {
  const fields = {
    auth_date: String(now),
    query_id: `query-${id}`,
    user: JSON.stringify({ id, first_name: 'Ada', username: 'ada' }),
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
function login(
  id: number,
  requestId = crypto.randomUUID(),
  overrides: Partial<RequestInit> = {},
  bindings = env,
) {
  return app.request(
    '/auth/telegram',
    {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: initData(id), requestId }),
      ...overrides,
    },
    bindings,
  );
}
function cookie(response: Response) {
  return response.headers.get('set-cookie')?.split(';')[0] ?? '';
}

beforeAll(async () => {
  database = await createTestDatabase();
  app = createApp(
    () => database.store,
    () => now,
  );
}, 30000);
afterAll(async () => {
  await database?.db.close();
});

describe('auth API + PostgreSQL', () => {
  it('supports the production /api prefix without authenticating an anonymous state request', async () => {
    expect((await app.request('/api/health', {}, env)).status).toBe(200);
    expect((await app.request('/api/me/state', {}, env)).status).toBe(401);
  });
  it('creates a persistent user and reads state only with a protected session cookie', async () => {
    const response = await login(101);
    expect(response.status).toBe(200);
    const header = response.headers.get('set-cookie')!;
    for (const flag of [
      '__Host-empire_session=',
      'HttpOnly',
      'Secure',
      'SameSite=None',
      'Path=/',
    ])
      expect(header).toContain(flag);
    expect(header).not.toContain('Domain=');
    const state = await app.request(
      '/me/state',
      { headers: { Cookie: cookie(response) } },
      env,
    );
    expect(state.status).toBe(200);
    expect((await state.json()).user.telegramId).toBe('101');
    expect(state.headers.get('cache-control')).toBe('no-store');
    expect(
      (
        await database.db.query(
          'select * from public.users where telegram_user_id=101',
        )
      ).rows,
    ).toHaveLength(1);
  });
  it('fails closed with no session, tampered cookie or duplicate cookie', async () => {
    const valid = cookie(await login(102));
    for (const value of ['', valid + 'x', `${valid}; ${valid}`]) {
      expect(
        (await app.request('/me/state', { headers: { Cookie: value } }, env))
          .status,
      ).toBe(401);
    }
  });
  it('returns the same session for bound retries and rejects a different retry proof', async () => {
    const requestId = crypto.randomUUID();
    const first = await login(103, requestId);
    const retry = await login(103, requestId);
    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    expect(cookie(retry)).toBe(cookie(first));
    const replay = await login(103);
    expect(replay.status).toBe(409);
    expect(replay.headers.get('set-cookie')).toBeNull();
    const userCount = await database.db.query(
      'select * from public.auth_sessions s join public.users u on u.id=s.user_id where u.telegram_user_id=103',
    );
    expect(userCount.rows).toHaveLength(1);
  });
  it('serializes concurrent duplicate exchanges to one session', async () => {
    const requestId = crypto.randomUUID();
    const responses = await Promise.all([
      login(104, requestId),
      login(104, requestId),
    ]);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    expect(cookie(responses[0]!)).toBe(cookie(responses[1]!));
  });
  it('revokes on logout and never resurrects through a retry', async () => {
    const requestId = crypto.randomUUID();
    const response = await login(105, requestId);
    const value = cookie(response);
    const logout = await app.request(
      '/auth/logout',
      {
        method: 'POST',
        headers: {
          Origin: origin,
          'Content-Type': 'application/json',
          Cookie: value,
        },
        body: '{}',
      },
      env,
    );
    expect(logout.status).toBe(204);
    expect(logout.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(
      (await app.request('/me/state', { headers: { Cookie: value } }, env))
        .status,
    ).toBe(401);
    expect((await login(105, requestId)).status).toBe(403);
  });
  it('denies existing sessions and new login after a ban without resetting status', async () => {
    const requestId = crypto.randomUUID();
    const response = await login(106, requestId);
    await database.db.exec(
      "update public.users set status='banned' where telegram_user_id=106",
    );
    expect(
      (
        await app.request(
          '/me/state',
          { headers: { Cookie: cookie(response) } },
          env,
        )
      ).status,
    ).toBe(401);
    expect((await login(106, requestId)).status).toBe(403);
    expect(
      (
        await database.db.query<{ status: string }>(
          'select status from public.users where telegram_user_id=106',
        )
      ).rows[0]?.status,
    ).toBe('banned');
  });
  it('rejects cross-site, missing origin, form posts, malformed JSON and oversized bodies', async () => {
    for (const headers of [
      { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
      { 'Content-Type': 'application/json' },
      { Origin: 'null', 'Content-Type': 'application/json' },
    ])
      expect((await login(107, undefined, { headers })).status).toBe(403);
    expect(
      (
        await login(107, undefined, {
          headers: { Origin: origin, 'Content-Type': 'text/plain' },
        })
      ).status,
    ).toBe(415);
    expect((await login(107, undefined, { body: '{bad' })).status).toBe(400);
    expect(
      (await login(107, undefined, { body: 'x'.repeat(21000) })).status,
    ).toBe(413);
  });
  it('rejects invalid signature before writing any user', async () => {
    const response = await login(108, undefined, {
      body: JSON.stringify({
        initData: initData(108).replace('Ada', 'Eve'),
        requestId: crypto.randomUUID(),
      }),
    });
    expect(response.status).toBe(401);
    expect(
      (
        await database.db.query(
          'select * from public.users where telegram_user_id=108',
        )
      ).rows,
    ).toHaveLength(0);
  });
  it('fails closed on missing config, exhausted limiter and limiter failures', async () => {
    expect((await login(109, undefined, {}, {})).status).toBe(503);
    const limited = await login(
      109,
      undefined,
      {},
      { ...env, AUTH_RATE_LIMIT: { limit: async () => ({ success: false }) } },
    );
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe('60');
    const failed = await login(
      109,
      undefined,
      {},
      {
        ...env,
        AUTH_RATE_LIMIT: {
          limit: async () => {
            throw new Error('private-internal-key');
          },
        },
      },
    );
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain('private-internal-key');
  });
  it('does not expose database errors or report successful logout on storage failure', async () => {
    const response = await login(110);
    const broken = createApp(
      () => ({
        login: async () => {
          throw new Error('secret-db-info');
        },
        getSession: async () => {
          throw new Error('secret-db-info');
        },
        revoke: async () => {
          throw new Error('secret-db-info');
        },
      }),
      () => now,
    );
    const result = await broken.request(
      '/auth/logout',
      {
        method: 'POST',
        headers: {
          Origin: origin,
          'Content-Type': 'application/json',
          Cookie: cookie(response),
        },
        body: '{}',
      },
      env,
    );
    expect(result.status).toBe(503);
    expect(await result.text()).not.toContain('secret-db-info');
    expect(result.headers.get('set-cookie')).toBeNull();
  });
  it('denies anon/authenticated table access and RPC execution', async () => {
    for (const role of ['anon', 'authenticated']) {
      for (const sql of [
        'select * from public.users',
        'select * from public.auth_sessions',
        "select public.empire_auth_session('11b1a892-558f-4d13-8116-de94679587be')",
        "select public.empire_auth_logout('11b1a892-558f-4d13-8116-de94679587be')",
        "select public.empire_auth_login('123','A',null,null,repeat('a',64),repeat('b',64),0)",
      ]) {
        await expect(
          database.db.transaction(async (tx) => {
            await tx.exec(`set local role ${role}`);
            await tx.query(sql);
          }),
        ).rejects.toThrow(/permission denied/);
      }
    }
  });
  it('rejects expired database sessions even with a valid signed cookie', async () => {
    const response = await login(111);
    await database.db.exec(
      "update public.auth_sessions set issued_at=now()-interval '31 minutes', expires_at=now()-interval '1 minute' where user_id=(select id from public.users where telegram_user_id=111)",
    );
    expect(
      (
        await app.request(
          '/me/state',
          { headers: { Cookie: cookie(response) } },
          env,
        )
      ).status,
    ).toBe(401);
  });
  it('does not allow cross-site logout', async () => {
    const response = await login(112);
    const value = cookie(response);
    const logout = await app.request(
      '/auth/logout',
      {
        method: 'POST',
        headers: {
          Origin: 'https://evil.example',
          'Content-Type': 'application/json',
          Cookie: value,
        },
        body: '{}',
      },
      env,
    );
    expect(logout.status).toBe(403);
    expect(
      (await app.request('/me/state', { headers: { Cookie: value } }, env))
        .status,
    ).toBe(200);
  });
});
