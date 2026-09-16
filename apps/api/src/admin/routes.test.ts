import { beforeAll, describe, expect, it } from 'vitest';
import type { Bindings } from '../auth/env';
import { createApp } from '../index';
import {
  createAdminTestDatabase,
  type TestDatabaseHarness,
  type SeedAdminResult,
  type SeedUserResult,
} from './test-db';

const now = Math.floor(Date.now() / 1000);
const origin = 'https://empire.example';
const sessionSecret = 'test-only-session-secret-with-enough-entropy-32-chars';
const env: Bindings = {
  TELEGRAM_BOT_TOKEN: '123456:test-bot',
  SESSION_SECRET: sessionSecret,
  APP_ORIGIN: origin,
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-only-key',
  AUTH_RATE_LIMIT: { limit: async () => ({ success: true }) },
};

describe('Admin Backend & Governance Integration Suite (Adim 9, R3)', () => {
  let harness: TestDatabaseHarness;
  let app: ReturnType<typeof createApp>;
  let barandnzUser: SeedUserResult;
  let barandnzCookie: string;
  let mberkedUser: SeedUserResult;
  let mberkedCookie: string;
  let superadminUser: SeedAdminResult;
  let superadminCookie: string;
  let auditorUser: SeedAdminResult;
  let auditorCookie: string;
  let regularPlayer: SeedUserResult;
  let regularCookie: string;

  beforeAll(async () => {
    harness = await createAdminTestDatabase();
    app = createApp(
      {
        makeAuthStore: () => harness.authStore,
        makeFraudStore: () => harness.fraudStore,
        makeAdminStore: () => harness.adminStore,
        makeConfigStore: () => harness.configStore,
      },
      () => now,
    );

    // 1. Designated admin @Barandnz
    barandnzUser = await harness.client.seedRegularUser({
      username: 'Barandnz',
      firstName: 'Baran',
      nowSec: now,
    });
    barandnzCookie = await harness.client.createSessionCookie(
      barandnzUser.sid,
      sessionSecret,
      barandnzUser.iat,
      barandnzUser.exp,
    );

    // 2. Designated admin @Mberked
    mberkedUser = await harness.client.seedRegularUser({
      username: 'Mberked',
      firstName: 'Berk',
      nowSec: now,
    });
    mberkedCookie = await harness.client.createSessionCookie(
      mberkedUser.sid,
      sessionSecret,
      mberkedUser.iat,
      mberkedUser.exp,
    );

    // 3. User with explicit superadmin role in admin_roles
    superadminUser = await harness.client.seedAdminUser({
      username: 'superadmin_dev',
      role: 'superadmin',
      nowSec: now,
    });
    superadminCookie = await harness.client.createSessionCookie(
      superadminUser.sid,
      sessionSecret,
      superadminUser.iat,
      superadminUser.exp,
    );

    // 4. Auditor (read-only fraud role, not superadmin)
    auditorUser = await harness.client.seedAdminUser({
      username: 'auditor_officer',
      role: 'auditor',
      nowSec: now,
    });
    auditorCookie = await harness.client.createSessionCookie(
      auditorUser.sid,
      sessionSecret,
      auditorUser.iat,
      auditorUser.exp,
    );

    // 5. Regular player
    regularPlayer = await harness.client.seedRegularUser({
      username: 'regular_player',
      initialCash: 500,
      initialPoints: 20,
      nowSec: now,
    });
    regularCookie = await harness.client.createSessionCookie(
      regularPlayer.sid,
      sessionSecret,
      regularPlayer.iat,
      regularPlayer.exp,
    );
  });

  describe('1. Strict RBAC Enforcement Matrix', () => {
    it('returns 401 UNAUTHORIZED when no session cookie is provided', async () => {
      const endpoints = [
        { path: '/admin/feature-flags', method: 'GET' },
        {
          path: '/admin/feature-flags',
          method: 'POST',
          body: { key: 'feature.stars_payments', value: true },
        },
        { path: '/admin/audit-logs', method: 'GET' },
        { path: '/admin/fraud/accounts', method: 'GET' },
        {
          path: '/admin/fraud/accounts/' + regularPlayer.userId + '/unfreeze',
          method: 'POST',
          body: { reason: 'Test' },
        },
      ];

      for (const ep of endpoints) {
        const res = await app.request(
          ep.path,
          {
            method: ep.method,
            headers: {
              Origin: origin,
              'Content-Type': 'application/json',
            },
            ...(ep.body ? { body: JSON.stringify(ep.body) } : {}),
          },
          env,
        );
        expect(res.status).toBe(401);
        const json = (await res.json()) as { error: { code: string } };
        expect(json.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns 403 FORBIDDEN when authenticated as a standard player without admin role', async () => {
      const endpoints = [
        { path: '/admin/feature-flags', method: 'GET' },
        {
          path: '/admin/feature-flags',
          method: 'POST',
          body: { key: 'feature.stars_payments', value: true },
        },
        { path: '/admin/audit-logs', method: 'GET' },
        { path: '/admin/fraud/accounts', method: 'GET' },
        {
          path: '/admin/fraud/accounts/' + regularPlayer.userId + '/unfreeze',
          method: 'POST',
          body: { reason: 'Test' },
        },
      ];

      for (const ep of endpoints) {
        const res = await app.request(
          ep.path,
          {
            method: ep.method,
            headers: {
              Cookie: regularCookie,
              Origin: origin,
              'Content-Type': 'application/json',
            },
            ...(ep.body ? { body: JSON.stringify(ep.body) } : {}),
          },
          env,
        );
        expect(res.status).toBe(403);
        const json = (await res.json()) as { error: { code: string } };
        expect(json.error.code).toBe('FORBIDDEN');
      }
    });

    it('returns 403 FORBIDDEN when authenticated as an auditor (not superadmin)', async () => {
      const endpoints = [
        { path: '/admin/feature-flags', method: 'GET' },
        {
          path: '/admin/feature-flags',
          method: 'POST',
          body: { key: 'feature.stars_payments', value: true },
        },
        { path: '/admin/audit-logs', method: 'GET' },
        { path: '/admin/fraud/accounts', method: 'GET' },
        {
          path: '/admin/fraud/accounts/' + regularPlayer.userId + '/unfreeze',
          method: 'POST',
          body: { reason: 'Test' },
        },
      ];

      for (const ep of endpoints) {
        const res = await app.request(
          ep.path,
          {
            method: ep.method,
            headers: {
              Cookie: auditorCookie,
              Origin: origin,
              'Content-Type': 'application/json',
            },
            ...(ep.body ? { body: JSON.stringify(ep.body) } : {}),
          },
          env,
        );
        expect(res.status).toBe(403);
        const json = (await res.json()) as { error: { code: string } };
        expect(json.error.code).toBe('FORBIDDEN');
      }
    });

    it('allows designated superadmin @Barandnz (HTTP 200)', async () => {
      const res = await app.request(
        '/admin/feature-flags',
        { headers: { Cookie: barandnzCookie, Origin: origin } },
        env,
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        apiVersion: string;
        flags: Record<string, unknown>;
      };
      expect(json.apiVersion).toBe('v1');
      expect(json.flags).toBeDefined();
    });

    it('allows designated superadmin @Mberked (HTTP 200)', async () => {
      const res = await app.request(
        '/admin/feature-flags',
        { headers: { Cookie: mberkedCookie, Origin: origin } },
        env,
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        apiVersion: string;
        flags: Record<string, unknown>;
      };
      expect(json.apiVersion).toBe('v1');
      expect(json.flags).toBeDefined();
    });

    it('allows superadmin role from public.admin_roles (HTTP 200)', async () => {
      const res = await app.request(
        '/admin/feature-flags',
        { headers: { Cookie: superadminCookie, Origin: origin } },
        env,
      );
      expect(res.status).toBe(200);
    });
  });

  describe('2. Dynamic Feature Flag Management & Idempotency', () => {
    it('returns default feature flags on GET /admin/feature-flags', async () => {
      const res = await app.request(
        '/admin/feature-flags',
        { headers: { Cookie: barandnzCookie, Origin: origin } },
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        apiVersion: string;
        flags: {
          'feature.stars_payments': boolean;
          'feature.maintenance_mode': boolean;
          'feature.referrals': boolean;
          'economy.multiplier': number;
        };
        updatedAt: string;
      };

      expect(body.apiVersion).toBe('v1');
      expect(body.flags['feature.stars_payments']).toBe(false);
      expect(body.flags['feature.maintenance_mode']).toBe(false);
      expect(body.flags['feature.referrals']).toBe(true);
      expect(body.flags['economy.multiplier']).toBe(1.0);
      expect(body.updatedAt).toBeDefined();
    });

    it('toggles feature.stars_payments to true and logs audit record', async () => {
      const requestId = crypto.randomUUID();
      const reason = 'Enabling Telegram Stars payment flow for launch testing';

      const res = await app.request(
        '/admin/feature-flags',
        {
          method: 'POST',
          headers: {
            Cookie: barandnzCookie,
            Origin: origin,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key: 'feature.stars_payments',
            value: true,
            reason,
            requestId,
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        apiVersion: string;
        success: boolean;
        key: string;
        updatedValue: boolean;
        auditLogId: string;
      };

      expect(body.apiVersion).toBe('v1');
      expect(body.success).toBe(true);
      expect(body.key).toBe('feature.stars_payments');
      expect(body.updatedValue).toBe(true);
      expect(body.auditLogId).toBe(requestId);

      // Verify flag is updated in GET
      const getRes = await app.request(
        '/admin/feature-flags',
        { headers: { Cookie: barandnzCookie, Origin: origin } },
        env,
      );
      const getBody = (await getRes.json()) as {
        flags: { 'feature.stars_payments': boolean };
      };
      expect(getBody.flags['feature.stars_payments']).toBe(true);

      // Verify immutable audit log in DB
      const auditRes = await harness.db.query<{
        admin_username: string;
        action: string;
        target_type: string;
        target_key: string;
        old_value: boolean;
        new_value: boolean;
        reason: string;
      }>(
        "select admin_username, action, target_type, target_key, old_value, new_value, reason from public.admin_audit_logs where id = '" +
          requestId +
          "'",
      );
      expect(auditRes.rows).toHaveLength(1);
      const audit = auditRes.rows[0]!;
      expect(audit.admin_username).toBe('Barandnz');
      expect(audit.action).toBe('set_feature_flag');
      expect(audit.target_type).toBe('feature_flag');
      expect(audit.target_key).toBe('feature.stars_payments');
      expect(audit.old_value).toBe(false);
      expect(audit.new_value).toBe(true);
      expect(audit.reason).toBe(reason);
    });

    it('enforces idempotency: repeating POST with same requestId succeeds without duplicate audit entries', async () => {
      const requestId = crypto.randomUUID();

      // First call
      const res1 = await app.request(
        '/admin/feature-flags',
        {
          method: 'POST',
          headers: {
            Cookie: mberkedCookie,
            Origin: origin,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key: 'economy.multiplier',
            value: 2.5,
            reason: 'Double event promo weekend',
            requestId,
          }),
        },
        env,
      );
      expect(res1.status).toBe(200);

      // Second identical call with same requestId
      const res2 = await app.request(
        '/admin/feature-flags',
        {
          method: 'POST',
          headers: {
            Cookie: mberkedCookie,
            Origin: origin,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key: 'economy.multiplier',
            value: 2.5,
            reason: 'Double event promo weekend',
            requestId,
          }),
        },
        env,
      );
      expect(res2.status).toBe(200);

      // Check DB: exactly one audit log entry exists for this requestId
      const countRes = await harness.db.query<{ count: number }>(
        "select count(*)::int as count from public.admin_audit_logs where id = '" +
          requestId +
          "'",
      );
      expect(countRes.rows[0]!.count).toBe(1);
    });
  });

  describe('3. Admin Audit Log API Feed', () => {
    it('returns chronological audit logs with pagination and filters', async () => {
      const res = await app.request(
        '/admin/audit-logs?limit=10&offset=0',
        { headers: { Cookie: barandnzCookie, Origin: origin } },
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        apiVersion: string;
        logs: Array<{
          id: string;
          adminUsername: string;
          action: string;
          targetType: string;
          targetKey: string;
          oldValue: unknown;
          newValue: unknown;
          reason: string;
          createdAt: string;
        }>;
        total: number;
        limit: number;
        offset: number;
      };

      expect(body.apiVersion).toBe('v1');
      expect(body.logs.length).toBeGreaterThanOrEqual(2);
      expect(body.total).toBeGreaterThanOrEqual(2);
      expect(body.limit).toBe(10);
      expect(body.offset).toBe(0);

      const firstLog = body.logs[0]!;
      expect(firstLog.id).toBeDefined();
      expect(firstLog.adminUsername).toBeDefined();
      expect(firstLog.action).toBeDefined();
      expect(firstLog.createdAt).toBeDefined();
    });

    it('filters audit logs by targetKey', async () => {
      const res = await app.request(
        '/admin/audit-logs?targetKey=feature.stars_payments',
        { headers: { Cookie: barandnzCookie, Origin: origin } },
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { logs: Array<{ targetKey: string }> };
      for (const log of body.logs) {
        expect(log.targetKey).toBe('feature.stars_payments');
      }
    });
  });

  describe('4. Fraud Queue Review & Account Unfreeze API', () => {
    let suspiciousUser: SeedUserResult;
    let frozenReward: { id: string; [key: string]: unknown };

    beforeAll(async () => {
      suspiciousUser = await harness.client.seedRegularUser({
        username: 'suspicious_trader',
        firstName: 'Suspect',
        initialCash: 100,
        initialPoints: 0,
        nowSec: now,
      });

      await harness.db.query(
        "update public.users set risk_score = 90, status = 'suspended' where id = '" +
          suspiciousUser.userId +
          "'",
      );

      const flag = await harness.client.seedFraudFlag({
        userId: suspiciousUser.userId,
        targetType: 'reward',
        riskScore: 90,
        reasonCodes: ['VELOCITY_CAP_EXCEEDED', 'DEVICE_CLUSTER_DETECTED'],
        severity: 'critical',
        status: 'pending',
      });

      frozenReward = await harness.client.seedFrozenReward({
        userId: suspiciousUser.userId,
        rewardType: 'cash_claim',
        amountCash: 50000,
        amountSeasonPoints: 1000,
        freezeReason: 'Velocity cap burst anomaly',
        fraudFlagId: flag.id,
      });
    });

    it('lists flagged suspicious accounts on GET /admin/fraud/accounts', async () => {
      const res = await app.request(
        '/admin/fraud/accounts',
        { headers: { Cookie: barandnzCookie, Origin: origin } },
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        apiVersion: string;
        accounts: Array<{
          userId: string;
          username: string;
          riskScore: number;
          status: string;
          pendingFlagsCount: number;
          frozenRewardsCount: number;
          totalFrozenCash: number;
          totalFrozenSeasonPoints: number;
          highestSeverity: string;
        }>;
        total: number;
      };

      expect(body.apiVersion).toBe('v1');
      expect(body.total).toBeGreaterThanOrEqual(1);

      const target = body.accounts.find(
        (a) => a.userId === suspiciousUser.userId,
      );
      expect(target).toBeDefined();
      expect(target!.username).toBe('suspicious_trader');
      expect(target!.riskScore).toBe(90);
      expect(target!.pendingFlagsCount).toBe(1);
      expect(target!.frozenRewardsCount).toBe(1);
      expect(target!.totalFrozenCash).toBe(50000);
      expect(target!.totalFrozenSeasonPoints).toBe(1000);
      expect(target!.highestSeverity).toBe('critical');
    });

    it('unfreezes flagged account, approves frozen rewards, and credits player balance', async () => {
      const requestId = crypto.randomUUID();
      const reason = 'Manual KYC verified, account legitimate';

      const res = await app.request(
        '/admin/fraud/accounts/' + suspiciousUser.userId + '/unfreeze',
        {
          method: 'POST',
          headers: {
            Cookie: barandnzCookie,
            Origin: origin,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reason,
            requestId,
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        apiVersion: string;
        success: boolean;
        userId: string;
        status: string;
        unfrozenRewardsCount: number;
        creditedCash: number;
        creditedSeasonPoints: number;
        reviewedAt: string;
      };

      expect(body.apiVersion).toBe('v1');
      expect(body.success).toBe(true);
      expect(body.userId).toBe(suspiciousUser.userId);
      expect(body.status).toBe('active');
      expect(body.unfrozenRewardsCount).toBe(1);
      expect(body.creditedCash).toBe(50000);
      expect(body.creditedSeasonPoints).toBe(1000);
      expect(body.reviewedAt).toBeDefined();

      const userRes = await harness.db.query<{
        status: string;
        risk_score: number;
      }>(
        "select status, risk_score from public.users where id = '" +
          suspiciousUser.userId +
          "'",
      );
      expect(userRes.rows[0]!.status).toBe('active');
      expect(userRes.rows[0]!.risk_score).toBe(0);

      const rewardRes = await harness.db.query<{ status: string }>(
        "select status from public.frozen_rewards where id = '" +
          frozenReward.id +
          "'",
      );
      expect(rewardRes.rows[0]!.status).toBe('approved');

      const balRes = await harness.db.query<{
        cash: number;
        season_points: number;
      }>(
        "select cash, season_points from public.player_balances where user_id = '" +
          suspiciousUser.userId +
          "'",
      );
      expect(balRes.rows[0]!.cash).toBe(50100);
      expect(balRes.rows[0]!.season_points).toBe(1000);

      const auditRes = await harness.db.query<{
        action: string;
        target_type: string;
        target_key: string;
        admin_username: string;
        reason: string;
      }>(
        "select action, target_type, target_key, admin_username, reason from public.admin_audit_logs where id = '" +
          requestId +
          "'",
      );
      expect(auditRes.rows).toHaveLength(1);
      expect(auditRes.rows[0]!.action).toBe('unfreeze_account');
      expect(auditRes.rows[0]!.target_type).toBe('user');
      expect(auditRes.rows[0]!.target_key).toBe(suspiciousUser.userId);
      expect(auditRes.rows[0]!.admin_username).toBe('Barandnz');
      expect(auditRes.rows[0]!.reason).toBe(reason);
    });

    it('returns 404 USER_NOT_FOUND when attempting to unfreeze non-existent user', async () => {
      const fakeUserId = crypto.randomUUID();
      const res = await app.request(
        '/admin/fraud/accounts/' + fakeUserId + '/unfreeze',
        {
          method: 'POST',
          headers: {
            Cookie: barandnzCookie,
            Origin: origin,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason: 'Non-existent test' }),
        },
        env,
      );
      expect(res.status).toBe(404);
      const json = (await res.json()) as { error: { code: string } };
      expect(json.error.code).toBe('USER_NOT_FOUND');
    });
  });

  describe('5. Dual Mounting Parity (/admin/* and /api/admin/*)', () => {
    it('serves feature flags under both /admin/feature-flags and /api/admin/feature-flags', async () => {
      const res1 = await app.request(
        '/admin/feature-flags',
        { headers: { Cookie: barandnzCookie, Origin: origin } },
        env,
      );
      const res2 = await app.request(
        '/api/admin/feature-flags',
        { headers: { Cookie: barandnzCookie, Origin: origin } },
        env,
      );
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      const body1 = (await res1.json()) as { flags: Record<string, unknown> };
      const body2 = (await res2.json()) as { flags: Record<string, unknown> };
      expect(body1.flags).toEqual(body2.flags);
    });

    it('serves audit logs under both /admin/audit-logs and /api/admin/audit-logs', async () => {
      const res1 = await app.request(
        '/admin/audit-logs',
        { headers: { Cookie: barandnzCookie, Origin: origin } },
        env,
      );
      const res2 = await app.request(
        '/api/admin/audit-logs',
        { headers: { Cookie: barandnzCookie, Origin: origin } },
        env,
      );
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
    });

    it('serves fraud accounts under both /admin/fraud/accounts and /api/admin/fraud/accounts', async () => {
      const res1 = await app.request(
        '/admin/fraud/accounts',
        { headers: { Cookie: barandnzCookie, Origin: origin } },
        env,
      );
      const res2 = await app.request(
        '/api/admin/fraud/accounts',
        { headers: { Cookie: barandnzCookie, Origin: origin } },
        env,
      );
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
    });
  });
});
