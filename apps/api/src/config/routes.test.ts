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
let adminUser: { cookie: string; userId: string };
let playerUser: { cookie: string; userId: string };

function initData(id: number, username: string) {
  const fields = {
    auth_date: String(now),
    query_id: `query-cfg-${id}`,
    user: JSON.stringify({ id, first_name: `Admin${id}`, username }),
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

describe('Remote Config & Admin Audit Routes', () => {
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

    // 1. Authenticate designated superadmin (@Barandnz)
    const resAdmin = await app.request(
      '/auth/telegram',
      {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: initData(301, 'barandnz'),
          requestId: crypto.randomUUID(),
        }),
      },
      env,
    );
    const adminCookie = resAdmin.headers.get('set-cookie')?.split(';')[0];
    const adminBody = (await resAdmin.json()) as { user: { id: string } };
    adminUser = { cookie: adminCookie ?? '', userId: adminBody.user.id };

    // 2. Authenticate non-admin regular player
    const resPlayer = await app.request(
      '/auth/telegram',
      {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: initData(302, 'player_one'),
          requestId: crypto.randomUUID(),
        }),
      },
      env,
    );
    const playerCookie = resPlayer.headers.get('set-cookie')?.split(';')[0];
    const playerBody = (await resPlayer.json()) as { user: { id: string } };
    playerUser = { cookie: playerCookie ?? '', userId: playerBody.user.id };
  });

  it('provides public config without authentication with feature.token strictly false', async () => {
    const res = await app.request('/config/public', {}, env);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      apiVersion: string;
      config: {
        offlineCapFreeSec: number;
        passPriceStars: number;
        featureToken: boolean;
      };
      featureFlags: Record<string, boolean>;
    };

    expect(body.apiVersion).toBe('v1');
    expect(body.config.offlineCapFreeSec).toBe(14400);
    expect(body.config.passPriceStars).toBe(250);

    // Strict invariant: feature.token defaults to false
    expect(body.config.featureToken).toBe(false);
    expect(body.featureFlags['feature.token']).toBe(false);
  });

  it('rejects unauthenticated config mutation requests with 401', async () => {
    const res = await app.request(
      '/admin/config',
      {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'pass.price_stars',
          value: 300,
          requestId: crypto.randomUUID(),
        }),
      },
      env,
    );
    expect(res.status).toBe(401);
  });

  it('rejects non-admin player config mutation requests with 403 FORBIDDEN', async () => {
    const res = await app.request(
      '/admin/config',
      {
        method: 'POST',
        headers: {
          Cookie: playerUser.cookie,
          Origin: origin,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key: 'pass.price_stars',
          value: 999,
          requestId: crypto.randomUUID(),
        }),
      },
      env,
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('mutates remote configuration and creates admin audit log trail', async () => {
    const reasonText = 'Seasonal pricing adjustment';
    const res = await app.request(
      '/admin/config',
      {
        method: 'POST',
        headers: {
          Cookie: adminUser.cookie,
          Origin: origin,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key: 'pass.price_stars',
          value: 300,
          reason: reasonText,
          requestId: crypto.randomUUID(),
        }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      key: string;
      updatedValue: number;
      auditLogId: string;
    };

    expect(body.success).toBe(true);
    expect(body.key).toBe('pass.price_stars');
    expect(body.updatedValue).toBe(300);
    expect(body.auditLogId).toBeDefined();

    // Verify audit log entry in admin_audit_logs table
    const auditRes = await database.db.query<{
      action: string;
      target_key: string;
      old_value: number;
      new_value: number;
      reason: string;
    }>(
      `select action, target_key, old_value, new_value, reason from public.admin_audit_logs where id = '${body.auditLogId}'`,
    );
    expect(auditRes.rows).toHaveLength(1);
    const audit = auditRes.rows[0]!;
    expect(audit.action).toBe('update_config');
    expect(audit.target_key).toBe('pass.price_stars');
    expect(audit.reason).toBe(reasonText);

    // Verify public config endpoint now serves the updated value
    const pubRes = await app.request('/config/public', {}, env);
    const pubBody = (await pubRes.json()) as {
      config: { passPriceStars: number };
    };
    expect(pubBody.config.passPriceStars).toBe(300);
  });
});
