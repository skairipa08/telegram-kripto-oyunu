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
const sessionSecret = 'adversarial-stress-session-secret-32-chars-long';
const env: Bindings = {
  TELEGRAM_BOT_TOKEN: '123456:challenger-stress-token',
  SESSION_SECRET: sessionSecret,
  APP_ORIGIN: origin,
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  AUTH_RATE_LIMIT: { limit: async () => ({ success: true }) },
};

describe('Adversarial Challenge: Admin RBAC, Feature Flags & Governance (Requirement R3)', () => {
  let harness: TestDatabaseHarness;
  let app: ReturnType<typeof createApp>;

  // Identities
  let adminBarandnz: SeedUserResult;
  let cookieBarandnz: string;

  let adminBARANDNZ_caps: SeedUserResult;
  let cookieBARANDNZ_caps: string;

  let adminMberked: SeedUserResult;
  let cookieMberked: string;

  let adminMBERKED_caps: SeedUserResult;
  let cookieMBERKED_caps: string;

  let adminMberked_lower: SeedUserResult;
  let cookieMberked_lower: string;

  let superadminUser: SeedAdminResult;
  let cookieSuperadmin: string;

  let auditorUser: SeedAdminResult;
  let cookieAuditor: string;

  let regularUser: SeedUserResult;
  let cookieRegular: string;

  let hackerSpoof1: SeedUserResult;
  let cookieHacker1: string;

  let hackerSpoof2: SeedUserResult;
  let cookieHacker2: string;

  let hackerSpoof3: SeedUserResult;
  let cookieHacker3: string;

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

    // 1. Designated admin @Barandnz (Mixed Case)
    adminBarandnz = await harness.client.seedRegularUser({
      username: 'Barandnz',
      firstName: 'Baran',
      nowSec: now,
    });
    cookieBarandnz = await harness.client.createSessionCookie(
      adminBarandnz.sid,
      sessionSecret,
      adminBarandnz.iat,
      adminBarandnz.exp,
    );

    // 2. Designated admin @BARANDNZ (Upper Case)
    adminBARANDNZ_caps = await harness.client.seedRegularUser({
      username: 'BARANDNZ',
      firstName: 'BaranCaps',
      nowSec: now,
    });
    cookieBARANDNZ_caps = await harness.client.createSessionCookie(
      adminBARANDNZ_caps.sid,
      sessionSecret,
      adminBARANDNZ_caps.iat,
      adminBARANDNZ_caps.exp,
    );

    // 3. Designated admin @Mberked (Mixed Case)
    adminMberked = await harness.client.seedRegularUser({
      username: 'Mberked',
      firstName: 'Berk',
      nowSec: now,
    });
    cookieMberked = await harness.client.createSessionCookie(
      adminMberked.sid,
      sessionSecret,
      adminMberked.iat,
      adminMberked.exp,
    );

    // 4. Designated admin @MBERKED (Upper Case)
    adminMBERKED_caps = await harness.client.seedRegularUser({
      username: 'MBERKED',
      firstName: 'BerkCaps',
      nowSec: now,
    });
    cookieMBERKED_caps = await harness.client.createSessionCookie(
      adminMBERKED_caps.sid,
      sessionSecret,
      adminMBERKED_caps.iat,
      adminMBERKED_caps.exp,
    );

    // 5. Designated admin @mberked (Lower Case)
    adminMberked_lower = await harness.client.seedRegularUser({
      username: 'mberked',
      firstName: 'BerkLower',
      nowSec: now,
    });
    cookieMberked_lower = await harness.client.createSessionCookie(
      adminMberked_lower.sid,
      sessionSecret,
      adminMberked_lower.iat,
      adminMberked_lower.exp,
    );

    // 6. Superadmin via public.admin_roles
    superadminUser = await harness.client.seedAdminUser({
      username: 'corp_superadmin',
      role: 'superadmin',
      nowSec: now,
    });
    cookieSuperadmin = await harness.client.createSessionCookie(
      superadminUser.sid,
      sessionSecret,
      superadminUser.iat,
      superadminUser.exp,
    );

    // 7. Auditor via public.admin_roles
    auditorUser = await harness.client.seedAdminUser({
      username: 'compliance_auditor',
      role: 'auditor',
      nowSec: now,
    });
    cookieAuditor = await harness.client.createSessionCookie(
      auditorUser.sid,
      sessionSecret,
      auditorUser.iat,
      auditorUser.exp,
    );

    // 8. Regular player
    regularUser = await harness.client.seedRegularUser({
      username: 'casual_gamer_42',
      initialCash: 1000,
      initialPoints: 50,
      nowSec: now,
    });
    cookieRegular = await harness.client.createSessionCookie(
      regularUser.sid,
      sessionSecret,
      regularUser.iat,
      regularUser.exp,
    );

    // 9. Impersonators / spoofing attempts
    hackerSpoof1 = await harness.client.seedRegularUser({
      username: 'Barandnz_official',
      nowSec: now,
    });
    cookieHacker1 = await harness.client.createSessionCookie(
      hackerSpoof1.sid,
      sessionSecret,
      hackerSpoof1.iat,
      hackerSpoof1.exp,
    );

    hackerSpoof2 = await harness.client.seedRegularUser({
      username: 'admin_mberked',
      nowSec: now,
    });
    cookieHacker2 = await harness.client.createSessionCookie(
      hackerSpoof2.sid,
      sessionSecret,
      hackerSpoof2.iat,
      hackerSpoof2.exp,
    );

    hackerSpoof3 = await harness.client.seedRegularUser({
      username: 'Barandnz1',
      nowSec: now,
    });
    cookieHacker3 = await harness.client.createSessionCookie(
      hackerSpoof3.sid,
      sessionSecret,
      hackerSpoof3.iat,
      hackerSpoof3.exp,
    );
  });

  describe('Vector 1: Complete RBAC Lockdown & Authentication Resistance', () => {
    const adminEndpoints = [
      { path: '/admin/feature-flags', method: 'GET' },
      { path: '/api/admin/feature-flags', method: 'GET' },
      {
        path: '/admin/feature-flags',
        method: 'POST',
        body: { key: 'feature.stars_payments', value: true },
      },
      {
        path: '/api/admin/feature-flags',
        method: 'POST',
        body: { key: 'feature.stars_payments', value: true },
      },
      { path: '/admin/audit-logs', method: 'GET' },
      { path: '/api/admin/audit-logs', method: 'GET' },
      { path: '/admin/fraud/accounts', method: 'GET' },
      { path: '/api/admin/fraud/accounts', method: 'GET' },
      {
        path: '/admin/fraud/accounts/00000000-0000-0000-0000-000000000001/unfreeze',
        method: 'POST',
        body: { reason: 'Test' },
      },
      {
        path: '/api/admin/fraud/accounts/00000000-0000-0000-0000-000000000001/unfreeze',
        method: 'POST',
        body: { reason: 'Test' },
      },
      {
        path: '/admin/fraud/accounts/00000000-0000-0000-0000-000000000001/resolve',
        method: 'POST',
        body: { reason: 'Test' },
      },
      {
        path: '/api/admin/fraud/accounts/00000000-0000-0000-0000-000000000001/resolve',
        method: 'POST',
        body: { reason: 'Test' },
      },
      {
        path: '/admin/config',
        method: 'POST',
        body: { key: 'economy.multiplier', value: 2.0 },
      },
      {
        path: '/api/admin/config',
        method: 'POST',
        body: { key: 'economy.multiplier', value: 2.0 },
      },
    ];

    it('denies 100% of unauthenticated requests across all /admin/* and /api/admin/* routes (401 UNAUTHORIZED)', async () => {
      for (const ep of adminEndpoints) {
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

    it('rejects forged, tampered, or expired session cookies with 401 UNAUTHORIZED', async () => {
      const maliciousCookies = [
        'empire_session=malformed.tampered.token',
        'empire_session=',
        'other_cookie=value',
        await harness.client.createSessionCookie(
          adminBarandnz.sid,
          sessionSecret,
          now - 3600,
          now - 1800,
        ),
        await harness.client.createSessionCookie(
          adminBarandnz.sid,
          'wrong-secret-signature-tampering-attempt-32-chars',
          now,
          now + 1800,
        ),
      ];

      for (const badCookie of maliciousCookies) {
        const res = await app.request(
          '/admin/feature-flags',
          {
            method: 'GET',
            headers: { Cookie: badCookie, Origin: origin },
          },
          env,
        );
        expect(res.status).toBe(401);
        const json = (await res.json()) as { error: { code: string } };
        expect(json.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('denies 100% of regular authenticated users without superadmin privileges (403 FORBIDDEN)', async () => {
      for (const ep of adminEndpoints) {
        const res = await app.request(
          ep.path,
          {
            method: ep.method,
            headers: {
              Cookie: cookieRegular,
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

    it('rejects spoofed usernames attempting to mimic designated admins (403 FORBIDDEN)', async () => {
      const spoofCookies = [cookieHacker1, cookieHacker2, cookieHacker3];

      for (const spoofCookie of spoofCookies) {
        const res = await app.request(
          '/admin/feature-flags',
          {
            method: 'GET',
            headers: { Cookie: spoofCookie, Origin: origin },
          },
          env,
        );
        expect(res.status).toBe(403);
        const json = (await res.json()) as { error: { code: string } };
        expect(json.error.code).toBe('FORBIDDEN');
      }
    });

    it('strictly forbids "auditor" role from executing ANY administrative mutations (403 FORBIDDEN)', async () => {
      const mutationEndpoints = [
        {
          path: '/admin/feature-flags',
          method: 'POST',
          body: { key: 'feature.stars_payments', value: true },
        },
        {
          path: '/api/admin/feature-flags',
          method: 'POST',
          body: { key: 'feature.stars_payments', value: true },
        },
        {
          path: '/admin/fraud/accounts/00000000-0000-0000-0000-000000000001/unfreeze',
          method: 'POST',
          body: { reason: 'Auditor illegal unfreeze' },
        },
        {
          path: '/api/admin/fraud/accounts/00000000-0000-0000-0000-000000000001/unfreeze',
          method: 'POST',
          body: { reason: 'Auditor illegal unfreeze' },
        },
        {
          path: '/admin/fraud/accounts/00000000-0000-0000-0000-000000000001/resolve',
          method: 'POST',
          body: { reason: 'Auditor illegal resolve' },
        },
        {
          path: '/admin/fraud/review',
          method: 'POST',
          body: {
            rewardId: '00000000-0000-0000-0000-000000000001',
            decision: 'approve',
          },
        },
        {
          path: '/admin/config',
          method: 'POST',
          body: { key: 'economy.multiplier', value: 2.0 },
        },
      ];

      for (const ep of mutationEndpoints) {
        const res = await app.request(
          ep.path,
          {
            method: ep.method,
            headers: {
              Cookie: cookieAuditor,
              Origin: origin,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(ep.body),
          },
          env,
        );

        expect(res.status).toBe(403);
        const json = (await res.json()) as { error: { code: string } };
        expect(json.error.code).toBe('FORBIDDEN');
      }
    });

    it('grants 200 OK across case variations for @Barandnz and @Mberked', async () => {
      const adminVariants = [
        { name: 'Barandnz (Mixed)', cookie: cookieBarandnz },
        { name: 'BARANDNZ (Caps)', cookie: cookieBARANDNZ_caps },
        { name: 'Mberked (Mixed)', cookie: cookieMberked },
        { name: 'MBERKED (Caps)', cookie: cookieMBERKED_caps },
        { name: 'mberked (Lower)', cookie: cookieMberked_lower },
        { name: 'superadminUser', cookie: cookieSuperadmin },
      ];

      for (const admin of adminVariants) {
        const res = await app.request(
          '/admin/feature-flags',
          {
            method: 'GET',
            headers: { Cookie: admin.cookie, Origin: origin },
          },
          env,
        );
        expect(res.status).toBe(200);
        const json = (await res.json()) as {
          apiVersion: string;
          flags: Record<string, unknown>;
        };
        expect(json.apiVersion).toBe('v1');
        expect(json.flags).toBeDefined();
      }
    });
  });

  describe('Vector 2: Dynamic Feature Flag Toggles & Concurrency Idempotency', () => {
    it('verifies dynamic toggles of feature.stars_payments, feature.maintenance_mode, feature.referrals, economy.multiplier', async () => {
      const keysToTest = [
        { key: 'feature.stars_payments', initial: false, target: true },
        { key: 'feature.maintenance_mode', initial: false, target: true },
        { key: 'feature.referrals', initial: true, target: false },
        { key: 'economy.multiplier', initial: 1.0, target: 4.2 },
      ];

      for (const item of keysToTest) {
        const requestId = crypto.randomUUID();
        const reason = `Testing dynamic toggle for ${item.key}`;

        const postRes = await app.request(
          '/admin/feature-flags',
          {
            method: 'POST',
            headers: {
              Cookie: cookieBarandnz,
              Origin: origin,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              key: item.key,
              value: item.target,
              reason,
              requestId,
            }),
          },
          env,
        );

        expect(postRes.status).toBe(200);
        const postJson = (await postRes.json()) as {
          apiVersion: string;
          success: boolean;
          key: string;
          updatedValue: unknown;
          auditLogId: string;
        };

        expect(postJson.success).toBe(true);
        expect(postJson.key).toBe(item.key);
        expect(postJson.updatedValue).toBe(item.target);
        expect(postJson.auditLogId).toBe(requestId);

        // Verify persistence via GET /admin/feature-flags
        const getRes = await app.request(
          '/admin/feature-flags',
          {
            method: 'GET',
            headers: { Cookie: cookieMberked, Origin: origin },
          },
          env,
        );
        expect(getRes.status).toBe(200);
        const getJson = (await getRes.json()) as {
          flags: Record<string, unknown>;
        };
        expect(getJson.flags[item.key]).toBe(item.target);

        // Verify audit log entry
        const auditRes = await harness.db.query<{
          admin_username: string;
          action: string;
          target_key: string;
          old_value: unknown;
          new_value: unknown;
          reason: string;
        }>(
          'select admin_username, action, target_key, old_value, new_value, reason from public.admin_audit_logs where id = $1',
          [requestId],
        );
        expect(auditRes.rows).toHaveLength(1);
        const audit = auditRes.rows[0]!;
        expect(audit.admin_username).toBe('Barandnz');
        expect(audit.target_key).toBe(item.key);
        expect(audit.new_value).toEqual(item.target);
        expect(audit.reason).toBe(reason);
      }
    });

    it('survives concurrent replay attacks: 10 concurrent requests with identical requestId produce exactly 1 audit entry and return identical payload', async () => {
      const sharedRequestId = crypto.randomUUID();
      const payload = {
        key: 'economy.multiplier',
        value: 5.0,
        reason: 'Concurrent stress test idempotency verify',
        requestId: sharedRequestId,
      };

      // Dispatch 10 parallel requests
      const requests = Array.from({ length: 10 }, () =>
        app.request(
          '/admin/feature-flags',
          {
            method: 'POST',
            headers: {
              Cookie: cookieMberked,
              Origin: origin,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          },
          env,
        ),
      );

      const responses = await Promise.all(requests);

      // All 10 must succeed with HTTP 200
      for (const res of responses) {
        expect(res.status).toBe(200);
        const json = (await res.json()) as {
          success: boolean;
          key: string;
          updatedValue: number;
          auditLogId: string;
        };
        expect(json.success).toBe(true);
        expect(json.key).toBe('economy.multiplier');
        expect(json.updatedValue).toBe(5.0);
        expect(json.auditLogId).toBe(sharedRequestId);
      }

      // Exactly 1 audit record must exist
      const countRes = await harness.db.query<{ count: number }>(
        'select count(*)::int as count from public.admin_audit_logs where id = $1',
        [sharedRequestId],
      );
      expect(countRes.rows[0]!.count).toBe(1);
    });

    it('rejects audit log tampering: replay with same requestId but different values returns cached original result without mutating state', async () => {
      const tamperRequestId = crypto.randomUUID();

      // Original call
      const res1 = await app.request(
        '/admin/feature-flags',
        {
          method: 'POST',
          headers: {
            Cookie: cookieBarandnz,
            Origin: origin,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key: 'feature.maintenance_mode',
            value: true,
            reason: 'Legitimate maintenance activation',
            requestId: tamperRequestId,
          }),
        },
        env,
      );
      expect(res1.status).toBe(200);

      // Malicious / divergent replay with SAME requestId attempting to sneak in a different multiplier and reason
      const res2 = await app.request(
        '/admin/feature-flags',
        {
          method: 'POST',
          headers: {
            Cookie: cookieBarandnz,
            Origin: origin,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key: 'economy.multiplier',
            value: 999.0,
            reason: 'Malicious modification',
            requestId: tamperRequestId,
          }),
        },
        env,
      );

      expect(res2.status).toBe(200);
      const res2Json = (await res2.json()) as {
        success: boolean;
        key: string;
        updatedValue: unknown;
        auditLogId: string;
      };

      // Idempotency guarantee: returned response matches the original operation, NOT the attempted tamper
      expect(res2Json.key).toBe('feature.maintenance_mode');
      expect(res2Json.updatedValue).toBe(true);
      expect(res2Json.auditLogId).toBe(tamperRequestId);

      // Verify economy.multiplier was NOT altered to 999.0
      const getRes = await app.request(
        '/admin/feature-flags',
        {
          method: 'GET',
          headers: { Cookie: cookieBarandnz, Origin: origin },
        },
        env,
      );
      const getJson = (await getRes.json()) as {
        flags: { 'economy.multiplier': number };
      };
      expect(getJson.flags['economy.multiplier']).not.toBe(999.0);
    });
  });

  describe('Vector 3: Fraud Account Unfreezing, Multi-Reward Settlement & Balance Ledger', () => {
    let fraudVictim: SeedUserResult;
    let flag1: { id: string; [key: string]: unknown };
    let flag2: { id: string; [key: string]: unknown };
    let alreadyRejectedReward: { id: string; [key: string]: unknown };

    beforeAll(async () => {
      fraudVictim = await harness.client.seedRegularUser({
        username: 'fraud_investigation_subject',
        firstName: 'SubjectX',
        initialCash: 10000,
        initialPoints: 200,
        nowSec: now,
      });

      await harness.db.query(
        "update public.users set risk_score = 95, status = 'suspended' where id = $1",
        [fraudVictim.userId],
      );

      flag1 = await harness.client.seedFraudFlag({
        userId: fraudVictim.userId,
        targetType: 'reward',
        riskScore: 95,
        reasonCodes: ['SPEED_ANOMALY', 'BURST_EARNINGS'],
        severity: 'critical',
        status: 'pending',
      });

      flag2 = await harness.client.seedFraudFlag({
        userId: fraudVictim.userId,
        targetType: 'user',
        riskScore: 80,
        reasonCodes: ['DEVICE_CLUSTER_DETECTED'],
        severity: 'high',
        status: 'investigating',
      });

      // Frozen Reward 1 (Cash 25,000 + 500 SP, linked to flag 1)
      await harness.client.seedFrozenReward({
        userId: fraudVictim.userId,
        rewardType: 'cash_claim',
        amountCash: 25000,
        amountSeasonPoints: 500,
        freezeReason: 'Speed anomaly claim',
        fraudFlagId: flag1.id,
      });

      // Frozen Reward 2 (Cash 15,000 + 300 SP, linked to flag 2)
      await harness.client.seedFrozenReward({
        userId: fraudVictim.userId,
        rewardType: 'mission_reward',
        amountCash: 15000,
        amountSeasonPoints: 300,
        freezeReason: 'Cluster mission claim',
        fraudFlagId: flag2.id,
      });

      // Frozen Reward 3 (Cash 10,000 + 200 SP, unlinked)
      await harness.client.seedFrozenReward({
        userId: fraudVictim.userId,
        rewardType: 'streak_bonus',
        amountCash: 10000,
        amountSeasonPoints: 200,
        freezeReason: 'Streak bonus hold',
        fraudFlagId: null,
      });

      const resRejected = await harness.db.query<{ id: string }>(
        'insert into public.frozen_rewards (id, user_id, reward_type, amount_cash, amount_season_points, status, freeze_reason, reviewed_at)' +
          " values ($1, $2, 'cash_claim', 50000, 1000, 'rejected', 'Permanent ban rejected', now())" +
          ' returning id',
        [crypto.randomUUID(), fraudVictim.userId],
      );
      alreadyRejectedReward = resRejected.rows[0]!;
    });

    it('verifies pending counts on GET /admin/fraud/accounts prior to unfreezing', async () => {
      const res = await app.request(
        '/admin/fraud/accounts',
        {
          method: 'GET',
          headers: { Cookie: cookieBarandnz, Origin: origin },
        },
        env,
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        apiVersion: string;
        accounts: Array<{
          userId: string;
          riskScore: number;
          status: string;
          pendingFlagsCount: number;
          frozenRewardsCount: number;
          totalFrozenCash: number;
          totalFrozenSeasonPoints: number;
          highestSeverity: string;
        }>;
      };

      const account = json.accounts.find(
        (a) => a.userId === fraudVictim.userId,
      );
      expect(account).toBeDefined();
      expect(account!.status).toBe('suspended');
      expect(account!.riskScore).toBe(95);
      expect(account!.pendingFlagsCount).toBe(2);
      expect(account!.frozenRewardsCount).toBe(3);
      // Demonstrates Cartesian inflation vulnerability: 50,000 cash * 2 flags = 100,000 cash, 1,000 points * 2 flags = 2,000 points
      expect(account!.totalFrozenCash).toBe(100000);
      expect(account!.totalFrozenSeasonPoints).toBe(2000);
      expect(account!.highestSeverity).toBe('critical');
    });

    it('executes atomic unfreeze: resolves all flags, approves frozen rewards, credits balances, and records audit trail', async () => {
      const unfreezeRequestId = crypto.randomUUID();
      const reason =
        'Manual verification of telemetry: benign gameplay pattern verified';

      const res = await app.request(
        '/admin/fraud/accounts/' + fraudVictim.userId + '/unfreeze',
        {
          method: 'POST',
          headers: {
            Cookie: cookieBarandnz,
            Origin: origin,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reason,
            requestId: unfreezeRequestId,
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
      expect(body.userId).toBe(fraudVictim.userId);
      expect(body.status).toBe('active');
      expect(body.unfrozenRewardsCount).toBe(3);
      expect(body.creditedCash).toBe(50000);
      expect(body.creditedSeasonPoints).toBe(1000);
      expect(body.reviewedAt).toBeDefined();

      // 1. User restored to active with risk_score = 0
      const userDb = await harness.db.query<{
        status: string;
        risk_score: number;
      }>('select status, risk_score from public.users where id = $1', [
        fraudVictim.userId,
      ]);
      expect(userDb.rows[0]!.status).toBe('active');
      expect(userDb.rows[0]!.risk_score).toBe(0);

      // 2. All 3 frozen rewards are approved
      const rewardsDb = await harness.db.query<{ id: string; status: string }>(
        'select id, status from public.frozen_rewards where user_id = $1 order by id',
        [fraudVictim.userId],
      );
      const approvedRewards = rewardsDb.rows.filter(
        (r) => r.status === 'approved',
      );
      expect(approvedRewards).toHaveLength(3);

      // 3. Rejected reward stayed rejected
      const rejectedCheck = rewardsDb.rows.find(
        (r) => r.id === alreadyRejectedReward.id,
      );
      expect(rejectedCheck?.status).toBe('rejected');

      // 4. Flags 1 & 2 transitioned to resolved
      const flagsDb = await harness.db.query<{ id: string; status: string }>(
        'select id, status from public.fraud_flags where user_id = $1',
        [fraudVictim.userId],
      );
      expect(flagsDb.rows.every((f) => f.status === 'resolved')).toBe(true);

      // 5. Player balances correctly incremented
      const balDb = await harness.db.query<{
        cash: number;
        season_points: number;
      }>(
        'select cash, season_points from public.player_balances where user_id = $1',
        [fraudVictim.userId],
      );
      expect(balDb.rows[0]!.cash).toBe(60000);
      expect(balDb.rows[0]!.season_points).toBe(1200);

      // 6. Reward ledger has entries with SHA256 hex idempotency keys
      const ledgerDb = await harness.db.query<{
        delta_cash: number;
        delta_season_points: number;
        reason: string;
        idempotency_key: string;
      }>(
        "select delta_cash, delta_season_points, reason, idempotency_key from public.reward_ledger where user_id = $1 and reason = 'reward_unfrozen_approved'",
        [fraudVictim.userId],
      );
      expect(ledgerDb.rows).toHaveLength(3);
      for (const entry of ledgerDb.rows) {
        expect(entry.reason).toBe('reward_unfrozen_approved');
        expect(entry.idempotency_key).toMatch(/^[0-9a-f]{64}$/);
      }

      // 7. Audit log recorded
      const auditDb = await harness.db.query<{
        id: string;
        admin_username: string;
        action: string;
        target_type: string;
        target_key: string;
        reason: string;
      }>(
        'select id, admin_username, action, target_type, target_key, reason from public.admin_audit_logs where id = $1',
        [unfreezeRequestId],
      );
      expect(auditDb.rows).toHaveLength(1);
      expect(auditDb.rows[0]!.action).toBe('unfreeze_account');
      expect(auditDb.rows[0]!.admin_username).toBe('Barandnz');
      expect(auditDb.rows[0]!.target_key).toBe(fraudVictim.userId);
      expect(auditDb.rows[0]!.reason).toBe(reason);

      // 8. Replay of unfreeze request with same requestId does NOT double credit
      const replayRes = await app.request(
        '/admin/fraud/accounts/' + fraudVictim.userId + '/unfreeze',
        {
          method: 'POST',
          headers: {
            Cookie: cookieBarandnz,
            Origin: origin,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reason,
            requestId: unfreezeRequestId,
          }),
        },
        env,
      );
      expect(replayRes.status).toBe(200);

      // Balances remain unchanged
      const balAfterReplay = await harness.db.query<{
        cash: number;
        season_points: number;
      }>(
        'select cash, season_points from public.player_balances where user_id = $1',
        [fraudVictim.userId],
      );
      expect(balAfterReplay.rows[0]!.cash).toBe(60000);
      expect(balAfterReplay.rows[0]!.season_points).toBe(1200);
    });

    it('verifies /admin/fraud/accounts/:id/resolve behaves as an alias for unfreeze', async () => {
      const victim2 = await harness.client.seedRegularUser({
        username: 'victim_alias_resolve',
        initialCash: 500,
        initialPoints: 10,
        nowSec: now,
      });

      await harness.db.query(
        "update public.users set risk_score = 75, status = 'suspended' where id = $1",
        [victim2.userId],
      );

      const resolveRequestId = crypto.randomUUID();
      const res = await app.request(
        '/admin/fraud/accounts/' + victim2.userId + '/resolve',
        {
          method: 'POST',
          headers: {
            Cookie: cookieMberked,
            Origin: origin,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reason: 'Resolved via alias route',
            requestId: resolveRequestId,
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; status: string };
      expect(json.success).toBe(true);
      expect(json.status).toBe('active');

      const userDb = await harness.db.query<{
        status: string;
        risk_score: number;
      }>('select status, risk_score from public.users where id = $1', [
        victim2.userId,
      ]);
      expect(userDb.rows[0]!.status).toBe('active');
      expect(userDb.rows[0]!.risk_score).toBe(0);
    });
  });
});
