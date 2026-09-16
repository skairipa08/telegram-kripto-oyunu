import { beforeAll, describe, expect, it } from 'vitest';
import {
  createLaunchTestDatabase,
  LAUNCH_APP_ORIGIN,
  type LaunchTestDatabaseHarness,
} from './test-db';

describe('PostgreSQL Concurrency & Invariant Stress Harness (Milestone M4 / Requirement R4)', () => {
  let harness: LaunchTestDatabaseHarness;

  beforeAll(async () => {
    harness = await createLaunchTestDatabase();
  });

  // ==========================================================================
  // SUITE A: Concurrent Racing Balance Updates (Double-Spend & Invariant Check)
  // ==========================================================================
  describe('Suite A: Concurrent Racing Balance Updates & Invariant Consistency', () => {
    it('executes 20 concurrent racing upgrades on a single account: exactly 1 succeeds, 19 fail with INSUFFICIENT_CASH, balance never drops below 0', async () => {
      // 1. Seed player with exactly 100 Cash (Street Stand level 0 -> 1 costs 100 Cash)
      const user = await harness.client.seedRegularUser({
        username: 'race_balance_user_1',
        initialCash: 100,
        initialPoints: 0,
      });
      const cookie = await harness.client.createSessionCookie(user.sid);

      // 2. Fire 20 parallel racing upgrade requests for street_stand
      const concurrentRequests = Array.from({ length: 20 }, () =>
        harness.app.request(
          '/economy/upgrade',
          {
            method: 'POST',
            headers: {
              Cookie: cookie,
              Origin: LAUNCH_APP_ORIGIN,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              businessSlug: 'street_stand',
              requestId: crypto.randomUUID(),
            }),
          },
          harness.env,
        ),
      );

      const responses = await Promise.all(concurrentRequests);

      // 3. Status assertions: exactly 1 is 200 OK, exactly 19 are 400 INSUFFICIENT_CASH
      const successResponses = responses.filter((r) => r.status === 200);
      const failedResponses = responses.filter((r) => r.status === 400);

      expect(successResponses).toHaveLength(1);
      expect(failedResponses).toHaveLength(19);

      for (const res of failedResponses) {
        const body = (await res.json()) as { error: { code: string } };
        expect(body.error.code).toBe('INSUFFICIENT_CASH');
      }

      const successBody = (await successResponses[0]!.json()) as {
        business: { slug: string; level: number };
        remainingCash: number;
      };
      expect(successBody.business.slug).toBe('street_stand');
      expect(successBody.business.level).toBe(1);
      expect(successBody.remainingCash).toBe(0);

      // 4. Invariant assertion: balance in DB is strictly 0, never negative
      const balanceRes = await harness.db.query<{ cash: number }>(
        `select cash from public.player_balances where user_id = $1`,
        [user.userId],
      );
      expect(balanceRes.rows[0]!.cash).toBe(0);

      // 5. Invariant assertion: player_businesses shows level 1
      const bizRes = await harness.db.query<{ level: number }>(
        `select level from public.player_businesses where user_id = $1 and business_slug = 'street_stand'`,
        [user.userId],
      );
      expect(bizRes.rows[0]!.level).toBe(1);

      // 6. Invariant assertion: reward_ledger has exactly ONE business_upgrade debit of -100
      const ledgerRes = await harness.db.query<{
        delta_cash: number;
        reason: string;
      }>(
        `select delta_cash, reason from public.reward_ledger where user_id = $1 and reason = 'business_upgrade'`,
        [user.userId],
      );
      expect(ledgerRes.rows).toHaveLength(1);
      expect(ledgerRes.rows[0]!.delta_cash).toBe(-100);
    });

    it('executes 20 interleaved racing requests (10 claims + 10 upgrades): preserves balance invariant, cash is never negative', async () => {
      // 1. Seed player with 250 Cash and an active Level 2 Street Stand
      const user = await harness.client.seedRegularUser({
        username: 'race_interleaved_user',
        initialCash: 250,
        initialPoints: 0,
      });
      const cookie = await harness.client.createSessionCookie(user.sid);

      // Set business to level 2 with claim time in the past to yield earnings
      await harness.db.query(
        `insert into public.player_businesses (user_id, business_slug, level, last_claim_at)
         values ($1, 'street_stand', 2, now() - interval '2 hours')
         on conflict (user_id, business_slug) do update set level = 2, last_claim_at = now() - interval '2 hours'`,
        [user.userId],
      );

      // 2. Prepare 10 claim requests and 10 upgrade requests
      const claimRequests = Array.from({ length: 10 }, () =>
        harness.app.request(
          '/economy/claim',
          {
            method: 'POST',
            headers: {
              Cookie: cookie,
              Origin: LAUNCH_APP_ORIGIN,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              requestId: crypto.randomUUID(),
            }),
          },
          harness.env,
        ),
      );

      const upgradeRequests = Array.from({ length: 10 }, () =>
        harness.app.request(
          '/economy/upgrade',
          {
            method: 'POST',
            headers: {
              Cookie: cookie,
              Origin: LAUNCH_APP_ORIGIN,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              businessSlug: 'street_stand',
              requestId: crypto.randomUUID(),
            }),
          },
          harness.env,
        ),
      );

      // Interleave the requests array to maximize contention
      const interleaved = [];
      for (let i = 0; i < 10; i++) {
        interleaved.push(claimRequests[i]!);
        interleaved.push(upgradeRequests[i]!);
      }

      const responses = await Promise.all(interleaved);

      // Verify no unexpected internal server errors occurred
      const serverErrors = responses.filter((r) => r.status >= 500);
      expect(serverErrors).toHaveLength(0);

      // 3. Inspect database state
      const balanceDb = await harness.db.query<{ cash: number }>(
        `select cash from public.player_balances where user_id = $1`,
        [user.userId],
      );
      const finalCash = balanceDb.rows[0]!.cash;

      // Invariant: Cash must never be negative
      expect(finalCash).toBeGreaterThanOrEqual(0);

      // Invariant: Ledger sum must match final balance exactly
      const ledgerSum = await harness.db.query<{ sum: string }>(
        `select coalesce(sum(delta_cash), 0) as sum from public.reward_ledger where user_id = $1 and reason <> 'starter_grant'`,
        [user.userId],
      );
      const expectedCash = 250 + Number(ledgerSum.rows[0]!.sum);
      expect(finalCash).toBe(expectedCash);
    });
  });

  // ==========================================================================
  // SUITE B: Concurrent Daily Streak Claims (Idempotent 1x 200, 19x 400)
  // ==========================================================================
  describe('Suite B: Concurrent Daily Streak Claims & Row Locking', () => {
    it('executes 20 simultaneous streak claims with the same session: exactly 1x 200 OK, 19x 400 ALREADY_CLAIMED', async () => {
      // 1. Seed user with streak eligible for claim today
      const user = await harness.client.seedRegularUser({
        username: 'race_streak_player',
        initialCash: 100,
        initialPoints: 0,
      });
      const cookie = await harness.client.createSessionCookie(user.sid);

      // 2. Fire 20 parallel racing POST /streak/claim requests
      const concurrentStreakRequests = Array.from({ length: 20 }, () =>
        harness.app.request(
          '/streak/claim',
          {
            method: 'POST',
            headers: {
              Cookie: cookie,
              Origin: LAUNCH_APP_ORIGIN,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              requestId: crypto.randomUUID(),
            }),
          },
          harness.env,
        ),
      );

      const responses = await Promise.all(concurrentStreakRequests);

      // 3. Assert HTTP response distribution: 1x 200 OK, 19x 400 ALREADY_CLAIMED
      const successResponses = responses.filter((r) => r.status === 200);
      const conflictResponses = responses.filter((r) => r.status === 400);

      expect(successResponses).toHaveLength(1);
      expect(conflictResponses).toHaveLength(19);

      const successBody = (await successResponses[0]!.json()) as {
        apiVersion: string;
        rewardPoints: number;
        newStreak: number;
        newSeasonPoints: number;
      };
      expect(successBody.apiVersion).toBe('v1');
      expect(successBody.newStreak).toBe(1);
      expect(successBody.rewardPoints).toBeGreaterThan(0);
      expect(successBody.newSeasonPoints).toBe(successBody.rewardPoints);

      for (const res of conflictResponses) {
        const body = (await res.json()) as { error: { code: string } };
        expect(body.error.code).toBe('ALREADY_CLAIMED');
      }

      // 4. Assert Database State: streak table incremented by exactly 1
      const streakDb = await harness.db.query<{
        current_streak: number;
        longest_streak: number;
        last_claim_date: string;
      }>(
        `select current_streak, longest_streak, last_claim_date::text from public.player_streaks where user_id = $1`,
        [user.userId],
      );
      expect(streakDb.rows[0]!.current_streak).toBe(1);
      expect(streakDb.rows[0]!.longest_streak).toBe(1);

      // 5. Assert Player Balances: season_points incremented exactly once (no double-credit)
      const balanceDb = await harness.db.query<{ season_points: number }>(
        `select season_points from public.player_balances where user_id = $1`,
        [user.userId],
      );
      expect(balanceDb.rows[0]!.season_points).toBe(successBody.rewardPoints);

      // 6. Assert Ledger: exactly ONE streak_claim row in reward_ledger
      const ledgerDb = await harness.db.query<{
        delta_season_points: number;
        reason: string;
      }>(
        `select delta_season_points, reason from public.reward_ledger where user_id = $1 and reason = 'streak_claim'`,
        [user.userId],
      );
      expect(ledgerDb.rows).toHaveLength(1);
      expect(ledgerDb.rows[0]!.delta_season_points).toBe(
        successBody.rewardPoints,
      );
    });
  });

  // ==========================================================================
  // SUITE C: Concurrent Mission Claims (Idempotent 1x 200, 19x 400)
  // ==========================================================================
  describe('Suite C: Concurrent Mission Claims & Row Locking', () => {
    it('executes 20 simultaneous claim requests on the same mission instance: exactly 1x 200 OK, 19x 400 ALREADY_CLAIMED', async () => {
      // 1. Seed user and completed mission instance
      const user = await harness.client.seedRegularUser({
        username: 'race_mission_player',
        initialCash: 100,
        initialPoints: 0,
      });
      const cookie = await harness.client.createSessionCookie(user.sid);

      const mission = await harness.client.seedCompletedMission(
        user.userId,
        'upgrade_any_3',
      );

      // 2. Fire 20 parallel racing POST /missions/:id/claim requests
      const concurrentMissionRequests = Array.from({ length: 20 }, () =>
        harness.app.request(
          `/missions/${mission.instanceId}/claim`,
          {
            method: 'POST',
            headers: {
              Cookie: cookie,
              Origin: LAUNCH_APP_ORIGIN,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              missionInstanceId: mission.instanceId,
              requestId: crypto.randomUUID(),
            }),
          },
          harness.env,
        ),
      );

      const responses = await Promise.all(concurrentMissionRequests);

      // 3. Assert HTTP response distribution: 1x 200 OK, 19x 400 ALREADY_CLAIMED
      const successResponses = responses.filter((r) => r.status === 200);
      const conflictResponses = responses.filter((r) => r.status === 400);

      expect(successResponses).toHaveLength(1);
      expect(conflictResponses).toHaveLength(19);

      const successBody = (await successResponses[0]!.json()) as {
        apiVersion: string;
        missionInstanceId: string;
        rewardPoints: number;
        newSeasonPoints: number;
      };
      expect(successBody.apiVersion).toBe('v1');
      expect(successBody.missionInstanceId).toBe(mission.instanceId);
      expect(successBody.rewardPoints).toBe(mission.rewardPoints);
      expect(successBody.newSeasonPoints).toBe(mission.rewardPoints);

      for (const res of conflictResponses) {
        const body = (await res.json()) as { error: { code: string } };
        expect(body.error.code).toBe('ALREADY_CLAIMED');
      }

      // 4. Assert Database State: mission instance status is 'claimed'
      const instanceDb = await harness.db.query<{
        status: string;
        claimed_at: string | null;
      }>(
        `select status, claimed_at::text from public.mission_instances where id = $1`,
        [mission.instanceId],
      );
      expect(instanceDb.rows[0]!.status).toBe('claimed');
      expect(instanceDb.rows[0]!.claimed_at).not.toBeNull();

      // 5. Assert Player Balances: season points credited exactly once
      const balanceDb = await harness.db.query<{ season_points: number }>(
        `select season_points from public.player_balances where user_id = $1`,
        [user.userId],
      );
      expect(balanceDb.rows[0]!.season_points).toBe(mission.rewardPoints);

      // 6. Assert Ledger: exactly ONE mission_reward entry
      const ledgerDb = await harness.db.query<{
        delta_season_points: number;
        reason: string;
      }>(
        `select delta_season_points, reason from public.reward_ledger where user_id = $1 and reason in ('mission_reward', 'mission_claim')`,
        [user.userId],
      );
      expect(ledgerDb.rows).toHaveLength(1);
      expect(ledgerDb.rows[0]!.delta_season_points).toBe(mission.rewardPoints);
    });
  });

  // ==========================================================================
  // SUITE D: Concurrent Referral Bindings (Unique Constraint & Anti-Deadlock)
  // ==========================================================================
  describe('Suite D: Concurrent Referral Bindings & Unique Constraint Defense', () => {
    it('executes 20 simultaneous binding requests with the same invitee: exactly 1x 200 OK, 19x 400 ALREADY_REFERRED', async () => {
      // 1. Seed referrer and invitee
      const referrer = await harness.client.seedRegularUser({
        username: 'referrer_user_a',
        initialCash: 100,
      });

      const invitee = await harness.client.seedRegularUser({
        username: 'invitee_user_1',
        initialCash: 100,
      });
      const inviteeCookie = await harness.client.createSessionCookie(
        invitee.sid,
      );

      // 2. Fire 20 parallel racing POST /referral/bind requests with same referrer code
      const concurrentBindingRequests = Array.from({ length: 20 }, () =>
        harness.app.request(
          '/referral/bind',
          {
            method: 'POST',
            headers: {
              Cookie: inviteeCookie,
              Origin: LAUNCH_APP_ORIGIN,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              referralCode: referrer.referralCode,
              requestId: crypto.randomUUID(),
            }),
          },
          harness.env,
        ),
      );

      const responses = await Promise.all(concurrentBindingRequests);

      // 3. Assert HTTP response distribution: 1x 200 OK, 19x 400 ALREADY_REFERRED
      const successResponses = responses.filter((r) => r.status === 200);
      const conflictResponses = responses.filter((r) => r.status === 400);

      expect(successResponses).toHaveLength(1);
      expect(conflictResponses).toHaveLength(19);

      const successBody = (await successResponses[0]!.json()) as {
        success: boolean;
        starterCashBoost: number;
      };
      expect(successBody.success).toBe(true);
      expect(successBody.starterCashBoost).toBe(500);

      for (const res of conflictResponses) {
        const body = (await res.json()) as { error: { code: string } };
        expect(body.error.code).toBe('ALREADY_REFERRED');
      }

      // 4. Assert Database State: referrals table contains EXACTLY ONE link for this invitee
      const referralsDb = await harness.db.query<{
        id: string;
        referrer_user_id: string;
        status: string;
      }>(
        `select id, referrer_user_id, status from public.referrals where invitee_user_id = $1`,
        [invitee.userId],
      );
      expect(referralsDb.rows).toHaveLength(1);
      expect(referralsDb.rows[0]!.referrer_user_id).toBe(referrer.userId);
      expect(referralsDb.rows[0]!.status).toBe('bound');

      // 5. Assert Player Balances: cash credited +500 exactly once (100 -> 600, not 10,100!)
      const balanceDb = await harness.db.query<{ cash: number }>(
        `select cash from public.player_balances where user_id = $1`,
        [invitee.userId],
      );
      expect(balanceDb.rows[0]!.cash).toBe(600);

      // 6. Assert Ledger: exactly ONE referral starter boost entry
      const ledgerDb = await harness.db.query<{
        delta_cash: number;
        reason: string;
      }>(
        `select delta_cash, reason from public.reward_ledger where user_id = $1 and reason in ('referral_starter_boost', 'referral_boost_grant')`,
        [invitee.userId],
      );
      expect(ledgerDb.rows).toHaveLength(1);
      expect(ledgerDb.rows[0]!.delta_cash).toBe(500);
    });

    it('defends against racing binding between two distinct referrers (10 code A + 10 code B): exactly one referrer wins', async () => {
      const referrerA = await harness.client.seedRegularUser({
        username: 'referrer_rival_a',
      });
      const referrerB = await harness.client.seedRegularUser({
        username: 'referrer_rival_b',
      });

      const invitee = await harness.client.seedRegularUser({
        username: 'invitee_rival_user',
        initialCash: 100,
      });
      const inviteeCookie = await harness.client.createSessionCookie(
        invitee.sid,
      );

      // 10 requests for Referrer A, 10 requests for Referrer B
      const requestsA = Array.from({ length: 10 }, () =>
        harness.app.request(
          '/referral/bind',
          {
            method: 'POST',
            headers: {
              Cookie: inviteeCookie,
              Origin: LAUNCH_APP_ORIGIN,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              referralCode: referrerA.referralCode,
              requestId: crypto.randomUUID(),
            }),
          },
          harness.env,
        ),
      );

      const requestsB = Array.from({ length: 10 }, () =>
        harness.app.request(
          '/referral/bind',
          {
            method: 'POST',
            headers: {
              Cookie: inviteeCookie,
              Origin: LAUNCH_APP_ORIGIN,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              referralCode: referrerB.referralCode,
              requestId: crypto.randomUUID(),
            }),
          },
          harness.env,
        ),
      );

      const responses = await Promise.all([...requestsA, ...requestsB]);

      const successResponses = responses.filter((r) => r.status === 200);
      const conflictResponses = responses.filter((r) => r.status === 400);

      expect(successResponses).toHaveLength(1);
      expect(conflictResponses).toHaveLength(19);

      // Verify the winning referrer in DB is either A or B, but never both
      const refDb = await harness.db.query<{ referrer_user_id: string }>(
        `select referrer_user_id from public.referrals where invitee_user_id = $1`,
        [invitee.userId],
      );
      expect(refDb.rows).toHaveLength(1);
      expect([referrerA.userId, referrerB.userId]).toContain(
        refDb.rows[0]!.referrer_user_id,
      );

      // Balance credited exactly once
      const balanceDb = await harness.db.query<{ cash: number }>(
        `select cash from public.player_balances where user_id = $1`,
        [invitee.userId],
      );
      expect(balanceDb.rows[0]!.cash).toBe(600);
    });
  });
});
