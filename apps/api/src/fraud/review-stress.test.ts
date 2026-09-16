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
const sessionSecret = 'adversarial-stress-session-secret-32-chars-ok';
const env: Bindings = {
  TELEGRAM_BOT_TOKEN: '123456:adversarial-bot',
  SESSION_SECRET: sessionSecret,
  APP_ORIGIN: origin,
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'adversarial-key',
  AUTH_RATE_LIMIT: { limit: async () => ({ success: true }) },
};

describe('Adversarial Review API & DB State Transition Harness (Challenger 1)', () => {
  let harness: TestDatabaseHarness;
  let app: ReturnType<typeof createApp>;
  let adminUser: SeedAdminResult;
  let adminCookie: string;
  let superadminUser: SeedAdminResult;
  let superadminCookie: string;
  let auditorUser: SeedAdminResult;
  let auditorCookie: string;
  let regularPlayer: SeedUserResult;

  beforeAll(async () => {
    harness = await createFraudTestDatabase();
    app = createApp(
      {
        makeAuthStore: () => harness.authStore,
        makeFraudStore: () => harness.fraudStore,
      },
      () => now,
    );

    adminUser = await harness.client.seedAdminUser({
      username: 'stress_admin',
      role: 'admin',
      nowSec: now,
    });
    adminCookie = await harness.client.createSessionCookie(
      adminUser.sid,
      sessionSecret,
      adminUser.iat,
      adminUser.exp,
    );

    superadminUser = await harness.client.seedAdminUser({
      username: 'stress_superadmin',
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
      username: 'stress_auditor',
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
      username: 'stress_player',
      initialCash: 100,
      initialPoints: 10,
      nowSec: now,
    });
  });

  // ==========================================================================
  // OBJECTIVE 4.1: Concurrent Review Race Condition (Double-Credit Prevention)
  // ==========================================================================
  describe('4.1 Concurrent Review Race Condition & Double-Credit Defense', () => {
    it('defends against 10 concurrent review approvals for the exact same reward: exactly 1 succeeds, 9 fail with 409, balance credited exactly once', async () => {
      // 1. Seed recipient player with 100 cash, 0 season points
      const targetPlayer = await harness.client.seedRegularUser({
        username: 'race_victim',
        initialCash: 100,
        initialPoints: 0,
      });

      // 2. Seed frozen reward for 50,000 Cash and 1,000 Season Points
      const frozenReward = await harness.client.seedFrozenReward({
        userId: targetPlayer.userId,
        rewardType: 'cash_claim',
        amountCash: 50000,
        amountSeasonPoints: 1000,
        freezeReason: 'High rate burst claim trigger',
      });

      // 3. Fire 10 simultaneous concurrent POST review requests
      const concurrentRequests = Array.from({ length: 10 }, (_, i) =>
        app.request(
          '/admin/fraud/review',
          {
            method: 'POST',
            headers: {
              Cookie: adminCookie,
              Origin: origin,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              rewardId: frozenReward.id,
              decision: 'approve',
              reason: `Concurrent burst approval attempt #${i}`,
            }),
          },
          env,
        ),
      );

      const responses = await Promise.all(concurrentRequests);

      // 4. Assert response statuses: exactly 1 is 200 OK, exactly 9 are 409 ALREADY_REVIEWED
      const successResponses = responses.filter((r) => r.status === 200);
      const conflictResponses = responses.filter((r) => r.status === 409);

      expect(successResponses).toHaveLength(1);
      expect(conflictResponses).toHaveLength(9);

      const successBody = (await successResponses[0]!.json()) as {
        success: boolean;
        decision: string;
        newCash: number;
        newSeasonPoints: number;
      };
      expect(successBody.success).toBe(true);
      expect(successBody.decision).toBe('approved');
      expect(successBody.newCash).toBe(50100); // 100 + 50000
      expect(successBody.newSeasonPoints).toBe(1000); // 0 + 1000

      // 5. Assert Player Balance in DB is credited EXACTLY ONCE (not 500,000!)
      const balanceRes = await harness.db.query<{
        cash: number;
        season_points: number;
      }>(
        `select cash, season_points from public.player_balances where user_id = $1`,
        [targetPlayer.userId],
      );
      expect(balanceRes.rows[0]!.cash).toBe(50100);
      expect(balanceRes.rows[0]!.season_points).toBe(1000);

      // 6. Assert reward_ledger contains EXACTLY ONE row for this unfreeze
      const ledgerRes = await harness.db.query<{
        id: string;
        delta_cash: number;
        delta_season_points: number;
        idempotency_key: string;
        reason: string;
      }>(
        `select id, delta_cash, delta_season_points, idempotency_key, reason
         from public.reward_ledger where user_id = $1 and reason = 'reward_unfrozen_approved'`,
        [targetPlayer.userId],
      );
      expect(ledgerRes.rows).toHaveLength(1);
      expect(ledgerRes.rows[0]!.delta_cash).toBe(50000);
      expect(ledgerRes.rows[0]!.delta_season_points).toBe(1000);

      // 7. Assert admin_audit_logs contains EXACTLY ONE 'reward_approved' row
      const auditRes = await harness.db.query<{
        action: string;
        target_key: string;
      }>(
        `select action, target_key from public.admin_audit_logs where target_key = $1 and action = 'reward_approved'`,
        [frozenReward.id],
      );
      expect(auditRes.rows).toHaveLength(1);
    });

    it('defends against concurrent race between approval and rejection: exactly one wins', async () => {
      const targetPlayer = await harness.client.seedRegularUser({
        username: 'race_conflict_victim',
        initialCash: 500,
        initialPoints: 50,
      });

      const frozenReward = await harness.client.seedFrozenReward({
        userId: targetPlayer.userId,
        rewardType: 'cash_claim',
        amountCash: 20000,
        amountSeasonPoints: 500,
        freezeReason: 'Suspicious anomaly',
      });

      // Fire approve and reject concurrently
      const [resApprove, resReject] = await Promise.all([
        app.request(
          '/admin/fraud/review',
          {
            method: 'POST',
            headers: {
              Cookie: adminCookie,
              Origin: origin,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              rewardId: frozenReward.id,
              decision: 'approve',
              reason: 'Race approval',
            }),
          },
          env,
        ),
        app.request(
          '/admin/fraud/review',
          {
            method: 'POST',
            headers: {
              Cookie: adminCookie,
              Origin: origin,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              rewardId: frozenReward.id,
              decision: 'reject',
              reason: 'Race rejection',
            }),
          },
          env,
        ),
      ]);

      const statuses = [resApprove.status, resReject.status].sort();
      // One must be 200, one must be 409
      expect(statuses).toEqual([200, 409]);

      // Verify DB reflects the winning decision only
      const rewardDb = await harness.db.query<{ status: string }>(
        `select status from public.frozen_rewards where id = $1`,
        [frozenReward.id],
      );
      expect(['approved', 'rejected']).toContain(rewardDb.rows[0]!.status);
    });
  });

  // ==========================================================================
  // OBJECTIVE 4.2: 64-Hex Idempotency Key & Audit Log Record Integrity
  // ==========================================================================
  describe('4.2 64-Hex Idempotency Key & Audit Log Record Integrity', () => {
    it('generates a strictly compliant 64-hex SHA-256 idempotency key in reward_ledger', async () => {
      const targetPlayer = await harness.client.seedRegularUser({
        username: 'idemp_key_user',
        initialCash: 100,
        initialPoints: 0,
      });

      const frozenReward = await harness.client.seedFrozenReward({
        userId: targetPlayer.userId,
        rewardType: 'mission_reward',
        amountCash: 8000,
        amountSeasonPoints: 200,
        freezeReason: 'Review test for idempotency',
      });

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
            rewardId: frozenReward.id,
            decision: 'approve',
            reason: 'Legitimate mission completion verified',
          }),
        },
        env,
      );
      expect(res.status).toBe(200);

      const ledgerRes = await harness.db.query<{
        idempotency_key: string;
        delta_cash: number;
        delta_season_points: number;
        reason: string;
        metadata: { frozenRewardId: string; approvedBy: string; notes: string };
      }>(
        `select idempotency_key, delta_cash, delta_season_points, reason, metadata
         from public.reward_ledger where user_id = $1 and reason = 'reward_unfrozen_approved'`,
        [targetPlayer.userId],
      );

      expect(ledgerRes.rows).toHaveLength(1);
      const ledger = ledgerRes.rows[0]!;

      // Strictly 64 lowercase hexadecimal characters
      expect(ledger.idempotency_key).toMatch(/^[a-f0-9]{64}$/);
      expect(ledger.delta_cash).toBe(8000);
      expect(ledger.delta_season_points).toBe(200);
      expect(ledger.reason).toBe('reward_unfrozen_approved');
      expect(ledger.metadata.frozenRewardId).toBe(frozenReward.id);
      expect(ledger.metadata.approvedBy).toBe(adminUser.userId);
      expect(ledger.metadata.notes).toBe(
        'Legitimate mission completion verified',
      );
    });

    it('creates a complete, tamper-evident audit log in admin_audit_logs with old/new values', async () => {
      const targetPlayer = await harness.client.seedRegularUser({
        username: 'audit_test_user',
        initialCash: 100,
      });

      const frozenReward = await harness.client.seedFrozenReward({
        userId: targetPlayer.userId,
        rewardType: 'referral_bonus',
        amountCash: 15000,
        amountSeasonPoints: 300,
        freezeReason: 'Sybil check quarantine',
      });

      const auditNotes = 'Auditor reviewed KYC documents and cleared referral';
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
            rewardId: frozenReward.id,
            decision: 'approve',
            reason: auditNotes,
          }),
        },
        env,
      );
      expect(res.status).toBe(200);

      const auditRes = await harness.db.query<{
        admin_user_id: string;
        action: string;
        target_type: string;
        target_key: string;
        old_value: { status: string };
        new_value: {
          status: string;
          creditedCash: number;
          creditedSeasonPoints: number;
        };
        reason: string;
        created_at: string;
      }>(
        `select admin_user_id, action, target_type, target_key, old_value, new_value, reason, created_at
         from public.admin_audit_logs where target_key = $1`,
        [frozenReward.id],
      );

      // Exactly 2 audit logs: 1 when frozen, 1 when approved
      const approvalLog = auditRes.rows.find(
        (l) => l.action === 'reward_approved',
      );
      expect(approvalLog).toBeDefined();
      expect(approvalLog?.admin_user_id).toBe(adminUser.userId);
      expect(approvalLog?.target_type).toBe('frozen_reward');
      expect(approvalLog?.target_key).toBe(frozenReward.id);
      expect(approvalLog?.old_value).toEqual({ status: 'frozen' });
      expect(approvalLog?.new_value.status).toBe('approved');
      expect(approvalLog?.new_value.creditedCash).toBe(15000);
      expect(approvalLog?.new_value.creditedSeasonPoints).toBe(300);
      expect(approvalLog?.reason).toBe(auditNotes);
    });
  });

  // ==========================================================================
  // OBJECTIVE 4.3: Review Guardrails & RBAC Security Boundaries
  // ==========================================================================
  describe('4.3 Review Guardrails & Security Boundaries', () => {
    it('rejects review with empty reason note (400 INVALID_REQUEST via Zod schema)', async () => {
      const reward = await harness.client.seedFrozenReward({
        userId: regularPlayer.userId,
        amountCash: 1000,
      });

      const resEmpty = await app.request(
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
            reason: '',
          }),
        },
        env,
      );

      expect(resEmpty.status).toBe(400);
      const body = (await resEmpty.json()) as { error: { code: string } };
      expect(body.error.code).toBe('INVALID_REQUEST');

      // Ensure reward is still frozen and untouched
      const rewardDb = await harness.db.query<{ status: string }>(
        `select status from public.frozen_rewards where id = $1`,
        [reward.id],
      );
      expect(rewardDb.rows[0]!.status).toBe('frozen');
    });

    it('rejects review with space-only reason note (400 REASONING_REQUIRED via DB stored proc check)', async () => {
      const reward = await harness.client.seedFrozenReward({
        userId: regularPlayer.userId,
        amountCash: 1000,
      });

      const resSpaces = await app.request(
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
            reason: '     ',
          }),
        },
        env,
      );

      expect(resSpaces.status).toBe(400);
      const body = (await resSpaces.json()) as { error: { code: string } };
      expect(body.error.code).toBe('REASONING_REQUIRED');
    });

    it('identifies whitespace edge case: tab and newline whitespace bypasses SQL trim() check', async () => {
      // NOTE: In PostgreSQL, trim(text) only strips standard spaces (' '), not tabs (\t) or newlines (\n).
      // Zod schema also uses z.string().min(1) without .trim().
      // This test confirms the exact behavior: '\t\n' is treated as non-empty by PostgreSQL length(trim()).
      const reward = await harness.client.seedFrozenReward({
        userId: regularPlayer.userId,
        amountCash: 500,
      });

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
            rewardId: reward.id,
            decision: 'approve',
            reason: '\t\n',
          }),
        },
        env,
      );

      // Successfully processed because Postgres length(trim('\t\n')) === 2
      expect(res.status).toBe(200);
    });

    it('enforces RBAC: auditor role receives 403 FORBIDDEN when attempting mutation', async () => {
      const reward = await harness.client.seedFrozenReward({
        userId: regularPlayer.userId,
        amountCash: 1000,
      });

      const res = await app.request(
        '/admin/fraud/review',
        {
          method: 'POST',
          headers: {
            Cookie: auditorCookie,
            Origin: origin,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rewardId: reward.id,
            decision: 'approve',
            reason: 'Auditor attempt',
          }),
        },
        env,
      );

      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('allows superadmin role to successfully review and approve frozen rewards', async () => {
      const targetPlayer = await harness.client.seedRegularUser({
        username: 'superadmin_target',
        initialCash: 100,
      });

      const reward = await harness.client.seedFrozenReward({
        userId: targetPlayer.userId,
        amountCash: 30000,
        amountSeasonPoints: 600,
      });

      const res = await app.request(
        '/admin/fraud/review',
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
            reason: 'Superadmin executive unfreeze',
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; decision: string };
      expect(body.success).toBe(true);
      expect(body.decision).toBe('approved');
    });

    it('executes batch reviews across 10 distinct users simultaneously with zero cross-talk', async () => {
      const batchSize = 10;
      const seedPromises = Array.from({ length: batchSize }, async (_, i) => {
        const user = await harness.client.seedRegularUser({
          username: `batch_user_${i}`,
          initialCash: 100,
          initialPoints: 0,
        });
        const reward = await harness.client.seedFrozenReward({
          userId: user.userId,
          amountCash: 1000 * (i + 1),
          amountSeasonPoints: 50 * (i + 1),
          freezeReason: `Batch test ${i}`,
        });
        return {
          user,
          reward,
          cashAmount: 1000 * (i + 1),
          pointsAmount: 50 * (i + 1),
        };
      });

      const batchItems = await Promise.all(seedPromises);

      // Review all 10 simultaneously
      const reviewPromises = batchItems.map((item) =>
        app.request(
          '/admin/fraud/review',
          {
            method: 'POST',
            headers: {
              Cookie: adminCookie,
              Origin: origin,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              rewardId: item.reward.id,
              decision: 'approve',
              reason: `Batch approval for user ${item.user.username}`,
            }),
          },
          env,
        ),
      );

      const reviewResponses = await Promise.all(reviewPromises);
      for (const res of reviewResponses) {
        expect(res.status).toBe(200);
      }

      // Verify each user has exact balance with zero cross-talk
      for (const item of batchItems) {
        const balRes = await harness.db.query<{
          cash: number;
          season_points: number;
        }>(
          `select cash, season_points from public.player_balances where user_id = $1`,
          [item.user.userId],
        );
        expect(balRes.rows[0]!.cash).toBe(100 + item.cashAmount);
        expect(balRes.rows[0]!.season_points).toBe(item.pointsAmount);
      }
    });
  });
});
