import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../index';
import type { Bindings } from '../auth/env';
import { createFraudTestDatabase, type TestDatabaseHarness } from './test-db';

describe('Designated Team Admins (@Barandnz, @Mberked) RBAC & Auto-Assignment', () => {
  const origin = 'https://empire.example';
  const sessionSecret = 'designated-admin-session-secret-32-chars-min';

  let harness: TestDatabaseHarness;
  let app: ReturnType<typeof createApp>;
  let env: Bindings;

  beforeAll(async () => {
    harness = await createFraudTestDatabase();
    env = {
      APP_ORIGIN: origin,
      TELEGRAM_BOT_TOKEN: '123456:designated-admin-test-token',
      SESSION_SECRET: sessionSecret,
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
      AUTH_RATE_LIMIT: { limit: async () => ({ success: true }) },
    };

    app = createApp(
      {
        makeAuthStore: () => harness.authStore,
        makeFraudStore: () => harness.fraudStore,
      },
      () => Math.floor(Date.now() / 1000),
    );
  });

  it('automatically grants superadmin privileges to @Barandnz upon user registration', async () => {
    const baranUser = await harness.client.seedRegularUser({
      username: 'Barandnz',
      firstName: 'Baran',
    });
    const cookie = await harness.client.createSessionCookie(
      baranUser.sid,
      sessionSecret,
    );

    // 1. Direct RPC verification
    const rpcRes = await harness.db.query<{ empire_admin_check_role: boolean }>(
      'select public.empire_admin_check_role($1, $2) as empire_admin_check_role',
      [baranUser.userId, 'admin'],
    );
    expect(rpcRes.rows[0]?.empire_admin_check_role).toBe(true);

    const rpcSuperadmin = await harness.db.query<{
      empire_admin_check_role: boolean;
    }>(
      'select public.empire_admin_check_role($1, $2) as empire_admin_check_role',
      [baranUser.userId, 'superadmin'],
    );
    expect(rpcSuperadmin.rows[0]?.empire_admin_check_role).toBe(true);

    // 2. Database table verification: auto-assigned in public.admin_roles
    const roleRows = await harness.db.query<{ role: string }>(
      'select role from public.admin_roles where user_id = $1',
      [baranUser.userId],
    );
    expect(roleRows.rows.map((r) => r.role)).toContain('superadmin');

    // 3. HTTP API verification: can access GET /admin/fraud/flags without 403
    const res = await app.request(
      '/admin/fraud/flags',
      {
        headers: {
          Cookie: cookie,
          Origin: origin,
        },
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { flags: unknown[] };
    expect(Array.isArray(body.flags)).toBe(true);
  });

  it('automatically grants superadmin privileges to @Mberked (case-insensitive)', async () => {
    const berkeUser = await harness.client.seedRegularUser({
      username: 'mberked',
      firstName: 'Berke',
    });
    const cookie = await harness.client.createSessionCookie(
      berkeUser.sid,
      sessionSecret,
    );

    // 1. Direct RPC verification
    const rpcRes = await harness.db.query<{ empire_admin_check_role: boolean }>(
      'select public.empire_admin_check_role($1, $2) as empire_admin_check_role',
      [berkeUser.userId, 'admin'],
    );
    expect(rpcRes.rows[0]?.empire_admin_check_role).toBe(true);

    // 2. Database table verification
    const roleRows = await harness.db.query<{ role: string }>(
      'select role from public.admin_roles where user_id = $1',
      [berkeUser.userId],
    );
    expect(roleRows.rows.map((r) => r.role)).toContain('superadmin');

    // 3. HTTP API verification
    const res = await app.request(
      '/admin/fraud/flags',
      {
        headers: {
          Cookie: cookie,
          Origin: origin,
        },
      },
      env,
    );
    expect(res.status).toBe(200);
  });

  it('denies administrative access (403 FORBIDDEN) to standard non-admin users', async () => {
    const regularUser = await harness.client.seedRegularUser({
      username: 'regular_player_99',
    });
    const cookie = await harness.client.createSessionCookie(
      regularUser.sid,
      sessionSecret,
    );

    const rpcRes = await harness.db.query<{ empire_admin_check_role: boolean }>(
      'select public.empire_admin_check_role($1, $2) as empire_admin_check_role',
      [regularUser.userId, 'admin'],
    );
    expect(rpcRes.rows[0]?.empire_admin_check_role).toBe(false);

    const res = await app.request(
      '/admin/fraud/flags',
      {
        headers: {
          Cookie: cookie,
          Origin: origin,
        },
      },
      env,
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('FORBIDDEN');
  });
});
