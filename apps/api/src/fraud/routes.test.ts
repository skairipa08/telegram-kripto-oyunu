import { beforeAll, describe, expect, it } from 'vitest';
import type { Bindings } from '../auth/env';
import { createApp } from '../index';
import {
  createFraudTestDatabase,
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

describe('Admin Anti-Fraud & Reward Review Routes (R3 & R4)', () => {
  let harness: TestDatabaseHarness;
  let app: ReturnType<typeof createApp>;
  let adminUser: SeedAdminResult;
  let adminCookie: string;
  let superadminUser: SeedAdminResult;
  let superadminCookie: string;
  let auditorUser: SeedAdminResult;
  let auditorCookie: string;
  let regularPlayer: SeedUserResult;
  let regularCookie: string;

  beforeAll(async () => {
    harness = await createFraudTestDatabase();
    app = createApp(
      {
        makeAuthStore: () => harness.authStore,
        makeFraudStore: () => harness.fraudStore,
      },
      () => now,
    );

    // Seed users with different RBAC roles
    adminUser = await harness.client.seedAdminUser({
      username: 'admin_officer',
      role: 'admin',
      initialCash: 100,
      initialPoints: 0,
      nowSec: now,
    });
    adminCookie = await harness.client.createSessionCookie(
      adminUser.sid,
      sessionSecret,
      adminUser.iat,
      adminUser.exp,
    );

    superadminUser = await harness.client.seedAdminUser({
      username: 'super_officer',
      role: 'superadmin',
      nowSec: now,
    });
    superadminCookie = await harness.client.createSessionCookie(
      superadminUser.sid,
      sessionSecret,
      superadminUser.iat,
      superadminUser.exp,
    );

    auditorUser = await harness.client.seedAdminUser({
      username: 'audit_officer',
      role: 'auditor',
      nowSec: now,
    });
    auditorCookie = await harness.client.createSessionCookie(
      auditorUser.sid,
      sessionSecret,
      auditorUser.iat,
      auditorUser.exp,
    );

    regularPlayer = await harness.client.seedRegularUser({
      username: 'player_one',
      initialCash: 250,
      initialPoints: 10,
      nowSec: now,
    });
    regularCookie = await harness.client.createSessionCookie(
      regularPlayer.sid,
      sessionSecret,
      regularPlayer.iat,
      regularPlayer.exp,
    );
  });

  describe('1. Authentication & RBAC Access Controls', () => {
    it('returns 401 UNAUTHORIZED when no session cookie is provided', async () => {
      const getFlags = await app.request('/admin/fraud/flags', {}, env);
      expect(getFlags.status).toBe(401);
      const getFlagsBody = (await getFlags.json()) as {
        error: { code: string };
      };
      expect(getFlagsBody.error.code).toBe('UNAUTHORIZED');

      const getFrozen = await app.request('/admin/fraud/frozen', {}, env);
      expect(getFrozen.status).toBe(401);

      const postReview = await app.request(
        '/admin/fraud/review',
        {
          method: 'POST',
          headers: { Origin: origin, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rewardId: crypto.randomUUID(),
            decision: 'approve',
            reason: 'Test approval',
          }),
        },
        env,
      );
      expect(postReview.status).toBe(401);
    });

    it('returns 401 UNAUTHORIZED when session cookie is invalid or corrupted', async () => {
      const res = await app.request(
        '/admin/fraud/flags',
        { headers: { Cookie: '__Host-empire_session=garbage.invalid.token' } },
        env,
      );
      expect(res.status).toBe(401);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 UNAUTHORIZED when session token is expired', async () => {
      // Create session expired 200 seconds ago
      const expiredCookie = await harness.client.createSessionCookie(
        adminUser.sid,
        sessionSecret,
        now - 2000,
        now - 200,
      );
      const res = await app.request(
        '/admin/fraud/flags',
        { headers: { Cookie: expiredCookie } },
        env,
      );
      expect(res.status).toBe(401);
    });

    it('returns 403 FORBIDDEN when authenticated user has no admin role', async () => {
      const flagsRes = await app.request(
        '/admin/fraud/flags',
        { headers: { Cookie: regularCookie } },
        env,
      );
      expect(flagsRes.status).toBe(403);
      const flagsBody = (await flagsRes.json()) as { error: { code: string } };
      expect(flagsBody.error.code).toBe('FORBIDDEN');

      const frozenRes = await app.request(
        '/admin/fraud/frozen',
        { headers: { Cookie: regularCookie } },
        env,
      );
      expect(frozenRes.status).toBe(403);

      const reviewRes = await app.request(
        '/admin/fraud/review',
        {
          method: 'POST',
          headers: {
            Cookie: regularCookie,
            Origin: origin,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rewardId: crypto.randomUUID(),
            decision: 'approve',
            reason: 'Illegal review attempt',
          }),
        },
        env,
      );
      expect(reviewRes.status).toBe(403);
    });

    it('allows auditor to read flags and frozen rewards, but returns 403 FORBIDDEN on POST /admin/fraud/review mutation', async () => {
      // Auditor GET flags -> 200 OK
      const flagsRes = await app.request(
        '/admin/fraud/flags',
        { headers: { Cookie: auditorCookie } },
        env,
      );
      expect(flagsRes.status).toBe(200);

      // Auditor GET frozen -> 200 OK
      const frozenRes = await app.request(
        '/admin/fraud/frozen',
        { headers: { Cookie: auditorCookie } },
        env,
      );
      expect(frozenRes.status).toBe(200);

      // Auditor POST review -> 403 FORBIDDEN (auditors cannot approve or reject rewards)
      const reviewRes = await app.request(
        '/admin/fraud/review',
        {
          method: 'POST',
          headers: {
            Cookie: auditorCookie,
            Origin: origin,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rewardId: crypto.randomUUID(),
            decision: 'approve',
            reason: 'Auditor unauthorized mutation',
          }),
        },
        env,
      );
      expect(reviewRes.status).toBe(403);
      const reviewBody = (await reviewRes.json()) as {
        error: { code: string };
      };
      expect(reviewBody.error.code).toBe('FORBIDDEN');
    });
  });

  describe('2. GET /admin/fraud/flags Filtering & Pagination', () => {
    let flag1Id: string;
    let flag2Id: string;

    beforeAll(async () => {
      const f1 = await harness.client.seedFraudFlag({
        userId: regularPlayer.userId,
        riskScore: 92,
        reasonCodes: [
          'RAPID_BURST_REQUESTS',
          'SUB_DEBOUNCE_INTERVAL_VIOLATION',
        ],
        severity: 'critical',
        status: 'pending',
        metadata: { sourceIp: '192.168.1.50' },
      });
      flag1Id = f1.id;

      const f2 = await harness.client.seedFraudFlag({
        userId: regularPlayer.userId,
        riskScore: 35,
        reasonCodes: ['CASH_VELOCITY_CAP_EXCEEDED'],
        severity: 'medium',
        status: 'investigating',
      });
      flag2Id = f2.id;
    });

    it('retrieves all fraud flags with default pagination and user details', async () => {
      const res = await app.request(
        '/admin/fraud/flags',
        { headers: { Cookie: adminCookie } },
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        apiVersion: string;
        flags: Array<{
          id: string;
          userId: string;
          riskScore: number;
          severity: string;
          status: string;
          user?: { username: string };
        }>;
        total: number;
      };

      expect(body.apiVersion).toBe('v1');
      expect(body.total).toBeGreaterThanOrEqual(2);
      expect(body.flags.some((f) => f.id === flag1Id)).toBe(true);
      expect(body.flags.some((f) => f.id === flag2Id)).toBe(true);

      const found = body.flags.find((f) => f.id === flag1Id);
      expect(found?.severity).toBe('critical');
      expect(found?.user?.username).toBe(regularPlayer.username);
    });

    it('filters flags by status and severity', async () => {
      const resPending = await app.request(
        '/admin/fraud/flags?status=pending&severity=critical',
        { headers: { Cookie: adminCookie } },
        env,
      );
      expect(resPending.status).toBe(200);
      const pendingBody = (await resPending.json()) as {
        flags: Array<{ id: string; status: string; severity: string }>;
        total: number;
      };
      expect(pendingBody.flags.every((f) => f.status === 'pending')).toBe(true);
      expect(pendingBody.flags.every((f) => f.severity === 'critical')).toBe(
        true,
      );

      const resInvestigating = await app.request(
        '/admin/fraud/flags?status=investigating',
        { headers: { Cookie: adminCookie } },
        env,
      );
      expect(resInvestigating.status).toBe(200);
      const invBody = (await resInvestigating.json()) as {
        flags: Array<{ id: string; status: string }>;
      };
      expect(invBody.flags.some((f) => f.id === flag2Id)).toBe(true);
    });

    it('supports pagination with limit and offset', async () => {
      const page1 = await app.request(
        '/admin/fraud/flags?limit=1&offset=0',
        { headers: { Cookie: adminCookie } },
        env,
      );
      expect(page1.status).toBe(200);
      const body1 = (await page1.json()) as {
        flags: Array<{ id: string }>;
        limit: number;
        offset: number;
      };
      expect(body1.flags).toHaveLength(1);
      expect(body1.limit).toBe(1);
      expect(body1.offset).toBe(0);

      const page2 = await app.request(
        '/admin/fraud/flags?limit=1&offset=1',
        { headers: { Cookie: adminCookie } },
        env,
      );
      expect(page2.status).toBe(200);
      const body2 = (await page2.json()) as {
        flags: Array<{ id: string }>;
        offset: number;
      };
      expect(body2.flags).toHaveLength(1);
      expect(body2.offset).toBe(1);
      expect(body2.flags[0]!.id).not.toBe(body1.flags[0]!.id);
    });
  });

  describe('2. GET /admin/fraud/frozen Filtering & Pagination', () => {
    let frozenRewardId: string;

    beforeAll(async () => {
      const reward = await harness.client.seedFrozenReward({
        userId: regularPlayer.userId,
        rewardType: 'cash_claim',
        amountCash: 7500,
        amountSeasonPoints: 150,
        freezeReason: 'High rate anomaly during claims',
      });
      frozenRewardId = reward.id;
    });

    it('retrieves frozen rewards with status defaults to frozen', async () => {
      const res = await app.request(
        '/admin/fraud/frozen',
        { headers: { Cookie: adminCookie } },
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        apiVersion: string;
        rewards: Array<{
          id: string;
          userId: string;
          rewardType: string;
          amountCash: number;
          amountSeasonPoints: number;
          status: string;
          user?: { currentCash: number };
        }>;
        total: number;
      };

      expect(body.apiVersion).toBe('v1');
      expect(body.total).toBeGreaterThanOrEqual(1);
      const found = body.rewards.find((r) => r.id === frozenRewardId);
      expect(found).toBeDefined();
      expect(found?.amountCash).toBe(7500);
      expect(found?.amountSeasonPoints).toBe(150);
      expect(found?.status).toBe('frozen');
      expect(found?.user?.currentCash).toBe(250);
    });

    it('filters frozen rewards by userId', async () => {
      const res = await app.request(
        `/admin/fraud/frozen?userId=${regularPlayer.userId}`,
        { headers: { Cookie: adminCookie } },
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        rewards: Array<{ userId: string }>;
      };
      expect(body.rewards.every((r) => r.userId === regularPlayer.userId)).toBe(
        true,
      );
    });
  });

  describe('3. POST /admin/fraud/review — Decision: approve', () => {
    it('approves a frozen reward: unfreezes, atomically credits balance, records reward_ledger and audit log', async () => {
      // 1. Create a fresh recipient player
      const targetUser = await harness.client.seedRegularUser({
        username: 'claimant_approve',
        initialCash: 100,
        initialPoints: 20,
      });

      // 2. Create a linked fraud flag
      const flag = await harness.client.seedFraudFlag({
        userId: targetUser.userId,
        riskScore: 78,
        reasonCodes: ['CASH_VELOCITY_CAP_EXCEEDED'],
        severity: 'high',
        status: 'pending',
      });

      // 3. Create frozen reward linked to this flag
      const reward = await harness.client.seedFrozenReward({
        userId: targetUser.userId,
        rewardType: 'cash_claim',
        amountCash: 10000,
        amountSeasonPoints: 500,
        freezeReason: 'Offline claim cap velocity trigger',
        fraudFlagId: flag.id,
      });

      // 4. Admin submits review approval
      const approvalReason =
        'Legitimate high-tier business claim verified with support ticket #9821';
      const reviewRes = await app.request(
        '/admin/fraud/review',
        {
          method: 'POST',
          headers: {
            Cookie: adminCookie,
            Origin: origin,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rewardId: reward.id,
            decision: 'approve',
            reason: approvalReason,
          }),
        },
        env,
      );

      expect(reviewRes.status).toBe(200);
      const reviewBody = (await reviewRes.json()) as {
        apiVersion: string;
        success: boolean;
        decision: string;
        frozenRewardId: string;
        creditedCash: number;
        creditedSeasonPoints: number;
        newCash: number;
        newSeasonPoints: number;
        reviewedAt: string;
      };

      expect(reviewBody.apiVersion).toBe('v1');
      expect(reviewBody.success).toBe(true);
      expect(reviewBody.decision).toBe('approved');
      expect(reviewBody.frozenRewardId).toBe(reward.id);
      expect(reviewBody.creditedCash).toBe(10000);
      expect(reviewBody.creditedSeasonPoints).toBe(500);
      expect(reviewBody.newCash).toBe(10100); // 100 + 10000
      expect(reviewBody.newSeasonPoints).toBe(520); // 20 + 500

      // 5. Verify database state for player_balances
      const balanceRes = await harness.db.query<{
        cash: number;
        season_points: number;
      }>(
        `select cash, season_points from public.player_balances where user_id = $1`,
        [targetUser.userId],
      );
      expect(balanceRes.rows[0]!.cash).toBe(10100);
      expect(balanceRes.rows[0]!.season_points).toBe(520);

      // 6. Verify reward_ledger row added with valid 64-hex idempotency key
      const ledgerRes = await harness.db.query<{
        user_id: string;
        delta_cash: number;
        delta_season_points: number;
        reason: string;
        idempotency_key: string;
      }>(
        `select user_id, delta_cash, delta_season_points, reason, idempotency_key
         from public.reward_ledger where user_id = $1 order by created_at desc limit 1`,
        [targetUser.userId],
      );
      expect(ledgerRes.rows).toHaveLength(1);
      const ledger = ledgerRes.rows[0]!;
      expect(ledger.delta_cash).toBe(10000);
      expect(ledger.delta_season_points).toBe(500);
      expect(ledger.reason).toBe('reward_unfrozen_approved');
      expect(ledger.idempotency_key).toMatch(/^[a-f0-9]{64}$/);

      // 7. Verify admin_audit_logs row added with action 'reward_approved'
      const auditRes = await harness.db.query<{
        admin_user_id: string;
        action: string;
        target_type: string;
        target_key: string;
        reason: string;
      }>(
        `select admin_user_id, action, target_type, target_key, reason
         from public.admin_audit_logs
         where target_key = $1 and action = 'reward_approved'`,
        [reward.id],
      );
      expect(auditRes.rows).toHaveLength(1);
      const audit = auditRes.rows[0]!;
      expect(audit.admin_user_id).toBe(adminUser.userId);
      expect(audit.target_type).toBe('frozen_reward');
      expect(audit.reason).toBe(approvalReason);

      // 8. Verify frozen_rewards status is 'approved'
      const rewardDbRes = await harness.db.query<{
        status: string;
        reviewed_by: string;
      }>(
        `select status, reviewed_by from public.frozen_rewards where id = $1`,
        [reward.id],
      );
      expect(rewardDbRes.rows[0]!.status).toBe('approved');
      expect(rewardDbRes.rows[0]!.reviewed_by).toBe(adminUser.userId);

      // 9. Verify linked fraud flag resolved
      const flagDbRes = await harness.db.query<{ status: string }>(
        `select status from public.fraud_flags where id = $1`,
        [flag.id],
      );
      expect(flagDbRes.rows[0]!.status).toBe('resolved');
    });
  });

  describe('4. POST /admin/fraud/review — Decision: reject', () => {
    it('rejects a frozen reward: cancels reward, leaves player balance untouched, records audit log', async () => {
      // 1. Create recipient player
      const targetUser = await harness.client.seedRegularUser({
        username: 'claimant_reject',
        initialCash: 500,
        initialPoints: 30,
      });

      // 2. Create frozen reward
      const reward = await harness.client.seedFrozenReward({
        userId: targetUser.userId,
        rewardType: 'cash_claim',
        amountCash: 50000,
        amountSeasonPoints: 1000,
        freezeReason: 'Confirmed speedhack exploit',
      });

      // 3. Admin submits review rejection
      const rejectionReason =
        'Confirmed memory injection exploit via client logs';
      const reviewRes = await app.request(
        '/admin/fraud/review',
        {
          method: 'POST',
          headers: {
            Cookie: adminCookie,
            Origin: origin,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rewardId: reward.id,
            decision: 'reject',
            reason: rejectionReason,
          }),
        },
        env,
      );

      expect(reviewRes.status).toBe(200);
      const reviewBody = (await reviewRes.json()) as {
        apiVersion: string;
        success: boolean;
        decision: string;
        frozenRewardId: string;
        canceledCash: number;
        canceledSeasonPoints: number;
      };

      expect(reviewBody.apiVersion).toBe('v1');
      expect(reviewBody.success).toBe(true);
      expect(reviewBody.decision).toBe('rejected');
      expect(reviewBody.frozenRewardId).toBe(reward.id);
      expect(reviewBody.canceledCash).toBe(50000);
      expect(reviewBody.canceledSeasonPoints).toBe(1000);

      // 4. Verify player balance remains completely untouched
      const balanceRes = await harness.db.query<{
        cash: number;
        season_points: number;
      }>(
        `select cash, season_points from public.player_balances where user_id = $1`,
        [targetUser.userId],
      );
      expect(balanceRes.rows[0]!.cash).toBe(500);
      expect(balanceRes.rows[0]!.season_points).toBe(30);

      // 5. Verify admin_audit_logs row added with action 'reward_rejected'
      const auditRes = await harness.db.query<{
        action: string;
        target_type: string;
        target_key: string;
        reason: string;
      }>(
        `select action, target_type, target_key, reason
         from public.admin_audit_logs
         where target_key = $1 and action = 'reward_rejected'`,
        [reward.id],
      );
      expect(auditRes.rows).toHaveLength(1);
      expect(auditRes.rows[0]!.action).toBe('reward_rejected');
      expect(auditRes.rows[0]!.reason).toBe(rejectionReason);

      // 6. Verify frozen_rewards status is 'rejected'
      const rewardDbRes = await harness.db.query<{ status: string }>(
        `select status from public.frozen_rewards where id = $1`,
        [reward.id],
      );
      expect(rewardDbRes.rows[0]!.status).toBe('rejected');
    });
  });

  describe('5. Review Error Cases & Guardrails', () => {
    it('returns 400 INVALID_REQUEST on invalid request body (invalid UUID, missing reason, invalid decision)', async () => {
      // Invalid UUID
      const res1 = await app.request(
        '/admin/fraud/review',
        {
          method: 'POST',
          headers: {
            Cookie: adminCookie,
            Origin: origin,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rewardId: 'not-a-valid-uuid',
            decision: 'approve',
            reason: 'Valid reason',
          }),
        },
        env,
      );
      expect(res1.status).toBe(400);

      // Missing reason
      const res2 = await app.request(
        '/admin/fraud/review',
        {
          method: 'POST',
          headers: {
            Cookie: adminCookie,
            Origin: origin,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rewardId: crypto.randomUUID(),
            decision: 'approve',
            reason: '',
          }),
        },
        env,
      );
      expect(res2.status).toBe(400);

      // Invalid decision
      const res3 = await app.request(
        '/admin/fraud/review',
        {
          method: 'POST',
          headers: {
            Cookie: adminCookie,
            Origin: origin,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rewardId: crypto.randomUUID(),
            decision: 'grant_bonus',
            reason: 'Invalid enum',
          }),
        },
        env,
      );
      expect(res3.status).toBe(400);
    });

    it('returns 404 REWARD_NOT_FOUND when reviewing non-existent reward', async () => {
      const res = await app.request(
        '/admin/fraud/review',
        {
          method: 'POST',
          headers: {
            Cookie: adminCookie,
            Origin: origin,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rewardId: crypto.randomUUID(),
            decision: 'approve',
            reason: 'Non-existent reward attempt',
          }),
        },
        env,
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe('REWARD_NOT_FOUND');
    });

    it('returns 409 ALREADY_REVIEWED when attempting to review an already reviewed reward', async () => {
      // 1. Create frozen reward
      const reward = await harness.client.seedFrozenReward({
        userId: regularPlayer.userId,
        amountCash: 1200,
        amountSeasonPoints: 40,
      });

      // 2. First review -> success 200
      const res1 = await app.request(
        '/admin/fraud/review',
        {
          method: 'POST',
          headers: {
            Cookie: adminCookie,
            Origin: origin,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rewardId: reward.id,
            decision: 'approve',
            reason: 'First approval',
          }),
        },
        env,
      );
      expect(res1.status).toBe(200);

      // 3. Second review on same reward -> 409 ALREADY_REVIEWED
      const res2 = await app.request(
        '/admin/fraud/review',
        {
          method: 'POST',
          headers: {
            Cookie: adminCookie,
            Origin: origin,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rewardId: reward.id,
            decision: 'reject',
            reason: 'Second conflicting decision attempt',
          }),
        },
        env,
      );
      expect(res2.status).toBe(409);
      const body = (await res2.json()) as { error: { code: string } };
      expect(body.error.code).toBe('ALREADY_REVIEWED');
    });
  });

  describe('6. Dual Mounting Parity (/admin/fraud/* and /api/admin/fraud/*)', () => {
    it('functions identically under both /admin/fraud/flags and /api/admin/fraud/flags', async () => {
      const res1 = await app.request(
        '/admin/fraud/flags',
        { headers: { Cookie: adminCookie } },
        env,
      );
      const res2 = await app.request(
        '/api/admin/fraud/flags',
        { headers: { Cookie: adminCookie } },
        env,
      );

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      const body1 = (await res1.json()) as { total: number };
      const body2 = (await res2.json()) as { total: number };
      expect(body1.total).toBe(body2.total);
    });

    it('functions identically under both /admin/fraud/frozen and /api/admin/fraud/frozen', async () => {
      const res1 = await app.request(
        '/admin/fraud/frozen',
        { headers: { Cookie: adminCookie } },
        env,
      );
      const res2 = await app.request(
        '/api/admin/fraud/frozen',
        { headers: { Cookie: adminCookie } },
        env,
      );

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      const body1 = (await res1.json()) as { total: number };
      const body2 = (await res2.json()) as { total: number };
      expect(body1.total).toBe(body2.total);
    });

    it('allows executing review mutation under both /admin/fraud/review and /api/admin/fraud/review', async () => {
      // Test review via /api prefix
      const reward = await harness.client.seedFrozenReward({
        userId: regularPlayer.userId,
        amountCash: 2000,
        amountSeasonPoints: 50,
      });

      const res = await app.request(
        '/api/admin/fraud/review',
        {
          method: 'POST',
          headers: {
            Cookie: superadminCookie,
            Origin: origin,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rewardId: reward.id,
            decision: 'approve',
            reason: 'Review executed via /api prefix',
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; decision: string };
      expect(body.success).toBe(true);
      expect(body.decision).toBe('approved');
    });
  });
});
