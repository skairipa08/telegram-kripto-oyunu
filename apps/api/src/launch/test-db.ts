import { PGlite } from '@electric-sql/pglite';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { COOKIE } from '../auth/routes';
import { signSession } from '../auth/crypto';
import type { Bindings } from '../auth/env';
import { SupabaseAuthStore } from '../auth/store';
import { SupabaseEconomyStore } from '../economy/store';
import { SupabaseLeaderboardStore } from '../leaderboard/store';
import { SupabaseShopStore } from '../shop/store';
import { SupabaseConfigStore } from '../config/store';
import { SupabaseAnalyticsStore } from '../analytics/store';
import { SupabaseFraudStore } from '../fraud/store';
import { createApp } from '../index';

export const LAUNCH_SESSION_SECRET =
  'launch-concurrency-session-secret-32-chars-ok';
export const LAUNCH_APP_ORIGIN = 'https://empire.example';

export async function createSessionCookie(
  sid: string,
  secret: string = LAUNCH_SESSION_SECRET,
  iat: number = Math.floor(Date.now() / 1000),
  exp: number = iat + 1800,
): Promise<string> {
  const token = await signSession({ sid, iat, exp }, secret);
  return `${COOKIE}=${token}`;
}

export interface SeedUserResult {
  userId: string;
  sid: string;
  telegramId: string;
  username: string;
  referralCode: string;
  iat: number;
  exp: number;
}

export interface SeedAdminResult extends SeedUserResult {
  role: 'admin' | 'superadmin' | 'auditor';
}

export async function seedRegularUser(
  db: PGlite,
  options: {
    telegramId?: number | undefined;
    username?: string | undefined;
    firstName?: string | undefined;
    initialCash?: number | undefined;
    initialPoints?: number | undefined;
    referralCode?: string | undefined;
    nowSec?: number | undefined;
  } = {},
): Promise<SeedUserResult> {
  const telegramId = String(
    options.telegramId ?? Math.floor(100000 + Math.random() * 900000),
  );
  const username = options.username ?? `user_${telegramId}`;
  const firstName = options.firstName ?? `First_${telegramId}`;
  const cash = options.initialCash ?? 100;
  const points = options.initialPoints ?? 0;
  const refCode =
    options.referralCode ??
    `REF_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  const now = options.nowSec ?? Math.floor(Date.now() / 1000);
  const exp = now + 1800;

  const userRes = await db.query<{ id: string }>(
    `insert into public.users (telegram_user_id, first_name, username, referral_code, language, status, risk_score)
     values ($1, $2, $3, $4, 'en', 'active', 0)
     returning id`,
    [telegramId, firstName, username, refCode],
  );
  const userId = userRes.rows[0]!.id;

  await db.query(
    `insert into public.player_balances (user_id, cash, season_points)
     values ($1, $2, $3)
     on conflict (user_id) do update set cash = excluded.cash, season_points = excluded.season_points`,
    [userId, cash, points],
  );

  await db.query(
    `insert into public.player_streaks (user_id, current_streak, longest_streak, last_claim_date, updated_at)
     values ($1, 0, 0, null, now())
     on conflict (user_id) do nothing`,
    [userId],
  );

  const sid = crypto.randomUUID();
  const fp = Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join('');
  const reqHash = Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join('');

  await db.query(
    `insert into public.auth_sessions (id, user_id, init_fingerprint, request_hash, telegram_auth_date, issued_at, expires_at)
     values ($1, $2, $3, $4, $5, to_timestamp($6), to_timestamp($6) + interval '30 minutes')`,
    [sid, userId, fp, reqHash, now, now],
  );

  return {
    userId,
    sid,
    telegramId,
    username,
    referralCode: refCode,
    iat: now,
    exp,
  };
}

export async function seedAdminUser(
  db: PGlite,
  options: {
    telegramId?: number | undefined;
    username?: string | undefined;
    firstName?: string | undefined;
    role?: ('admin' | 'superadmin' | 'auditor') | undefined;
    initialCash?: number | undefined;
    initialPoints?: number | undefined;
    referralCode?: string | undefined;
    nowSec?: number | undefined;
  } = {},
): Promise<SeedAdminResult> {
  const role = options.role ?? 'admin';
  const user = await seedRegularUser(db, options);

  await db.query(
    `insert into public.admin_roles (user_id, role)
     values ($1, $2)
     on conflict (user_id, role) do nothing`,
    [user.userId, role],
  );

  return { ...user, role };
}

export async function seedCompletedMission(
  db: PGlite,
  userId: string,
  missionKey = 'upgrade_any_3',
): Promise<{
  instanceId: string;
  missionId: string;
  key: string;
  target: number;
  rewardPoints: number;
}> {
  const seasonRes = await db.query<{ id: string }>(
    `select id from public.seasons where status = 'active' order by created_at desc limit 1`,
  );
  const seasonId =
    seasonRes.rows[0]?.id ?? '00000000-0000-0000-0000-000000000001';

  let missionRes = await db.query<{
    id: string;
    target: number;
    reward_points: number;
  }>(
    `select id, target, coalesce(reward_points, 375) as reward_points from public.missions where key = $1`,
    [missionKey],
  );

  if (missionRes.rows.length === 0) {
    const insertRes = await db.query<{
      id: string;
      target: number;
      reward_points: number;
    }>(
      `insert into public.missions (key, difficulty, title, description, target, reward_sru_multiplier, reward_points)
       values ($1, 'easy', 'Test Mission', 'Auto created for testing', 3, 0.75, 375)
       returning id, target, reward_points`,
      [missionKey],
    );
    missionRes = insertRes;
  }

  const mission = missionRes.rows[0]!;
  const instanceRes = await db.query<{ id: string }>(
    `insert into public.mission_instances (user_id, season_id, mission_id, progress, target, status, assigned_date)
     values ($1, $2, $3, $4, $4, 'completed', current_date)
     returning id`,
    [userId, seasonId, mission.id, mission.target],
  );

  return {
    instanceId: instanceRes.rows[0]!.id,
    missionId: mission.id,
    key: missionKey,
    target: mission.target,
    rewardPoints: mission.reward_points,
  };
}

export interface LaunchTestDatabaseHarness {
  db: PGlite;
  app: ReturnType<typeof createApp>;
  authStore: SupabaseAuthStore;
  economyStore: SupabaseEconomyStore;
  leaderboardStore: SupabaseLeaderboardStore;
  shopStore: SupabaseShopStore;
  configStore: SupabaseConfigStore;
  analyticsStore: SupabaseAnalyticsStore;
  fraudStore: SupabaseFraudStore;
  env: Bindings;
  client: {
    seedRegularUser: (
      options?: Parameters<typeof seedRegularUser>[1],
    ) => Promise<SeedUserResult>;
    seedAdminUser: (
      options?: Parameters<typeof seedAdminUser>[1],
    ) => Promise<SeedAdminResult>;
    seedCompletedMission: (
      userId: string,
      missionKey?: string,
    ) => Promise<{
      instanceId: string;
      missionId: string;
      key: string;
      target: number;
      rewardPoints: number;
    }>;
    createSessionCookie: (
      sid: string,
      secret?: string,
      iat?: number,
      exp?: number,
    ) => Promise<string>;
  };
}

export async function createLaunchTestDatabase(): Promise<LaunchTestDatabaseHarness> {
  const db = new PGlite();
  await db.exec(
    'create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;',
  );

  const migrationsUrl = new URL(
    '../../../../supabase/migrations',
    import.meta.url,
  );
  const migrationEntries = await readdir(migrationsUrl);
  const migrationFiles = migrationEntries
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of migrationFiles) {
    const fileUrl = new URL(
      `../../../../supabase/migrations/${file}`,
      import.meta.url,
    );
    if (existsSync(fileUrl)) {
      const sql = await readFile(fileUrl, 'utf8');
      await db.exec(sql);
    }
  }

  // Baseline concurrency hardening & schema compatibility
  await db.exec(`
    alter table public.missions add column if not exists reward_points integer default 375;
    update public.missions set reward_points = round(reward_sru_multiplier * 500) where reward_points is null or reward_points = 375;

    alter table public.referrals add column if not exists referrer_id uuid;
    alter table public.referrals add column if not exists invitee_id uuid;
    alter table public.referrals add column if not exists is_qualified boolean default false;
    alter table public.referrals add column if not exists qualified_at timestamptz;

    -- Ensure player_businesses compatibility with business_slug
    alter table public.player_businesses add column if not exists business_slug text;
    update public.player_businesses pb
    set business_slug = b.slug
    from public.businesses b
    where pb.business_id = b.id and pb.business_slug is null;

    create unique index if not exists player_businesses_user_slug_idx on public.player_businesses(user_id, business_slug);

    create or replace function public.sync_player_businesses_slug() returns trigger as $$
    begin
      if new.business_slug is null and new.business_id is not null then
        select slug into new.business_slug from public.businesses where id = new.business_id;
      end if;
      if new.business_id is null and new.business_slug is not null then
        select id into new.business_id from public.businesses where slug = new.business_slug;
      end if;
      return new;
    end;
    $$ language plpgsql;

    drop trigger if exists trg_sync_player_businesses_slug on public.player_businesses;
    create trigger trg_sync_player_businesses_slug
      before insert or update on public.player_businesses
      for each row execute function public.sync_player_businesses_slug();

    -- Allow general idempotency keys in reward_ledger
    alter table public.reward_ledger drop constraint if exists reward_ledger_idempotency_key_check;

    -- Ensure active Genesis season exists for tests
    insert into public.seasons (id, name, status, starts_at, ends_at, sru_snapshot, qap_snapshot)
    values ('00000000-0000-0000-0000-000000000001', 'Genesis Season', 'active', now() - interval '1 day', now() + interval '30 days', 500, 100)
    on conflict do nothing;
  `);

  const fetcher: typeof fetch = async (input, init) => {
    const name = new URL(String(input)).pathname.split('/').at(-1);
    const p = init?.body ? JSON.parse(String(init.body)) : {};
    let sql: string;
    let args: unknown[] = [];

    switch (name) {
      // Auth RPCs
      case 'empire_auth_login':
        sql = 'select public.empire_auth_login($1,$2,$3,$4,$5,$6,$7) as result';
        args = [
          p.p_telegram_id,
          p.p_first_name,
          p.p_username,
          p.p_language,
          p.p_fingerprint,
          p.p_request_hash,
          p.p_auth_date,
        ];
        break;
      case 'empire_auth_session':
        sql = 'select public.empire_auth_session($1) as result';
        args = [p.p_sid];
        break;
      case 'empire_auth_logout':
        sql = 'select public.empire_auth_logout($1) as result';
        args = [p.p_sid];
        break;

      // Economy & Game Loop RPCs
      case 'empire_init_player_economy':
        sql = 'select public.empire_init_player_economy($1, $2) as result';
        args = [p.p_user_id, p.p_is_referred ?? false];
        break;
      case 'empire_economy_get_player_state':
        sql = 'select public.empire_economy_get_player_state($1) as result';
        args = [p.p_user_id];
        break;
      case 'empire_claim_offline_earnings':
        sql = 'select public.empire_claim_offline_earnings($1, $2) as result';
        args = [p.p_user_id, p.p_request_id ?? null];
        break;
      case 'empire_upgrade_business':
        sql = 'select public.empire_upgrade_business($1, $2, $3) as result';
        args = [p.p_user_id, p.p_business_slug, p.p_request_id ?? null];
        break;
      case 'empire_get_game_state':
        sql = 'select public.empire_get_game_state($1) as result';
        args = [p.p_user_id];
        break;
      case 'empire_bind_referral':
        sql = 'select public.empire_bind_referral($1, $2, $3) as result';
        args = [p.p_user_id, p.p_referral_code, p.p_request_id ?? null];
        break;
      case 'empire_get_referral_status':
        sql = 'select public.empire_get_referral_status($1) as result';
        args = [p.p_user_id];
        break;
      case 'empire_get_active_missions':
        sql = 'select public.empire_get_active_missions($1) as result';
        args = [p.p_user_id];
        break;
      case 'empire_claim_mission':
        sql = 'select public.empire_claim_mission($1, $2, $3) as result';
        args = [p.p_user_id, p.p_mission_instance_id, p.p_request_id ?? null];
        break;
      case 'empire_get_streak':
        sql = 'select public.empire_get_streak($1) as result';
        args = [p.p_user_id];
        break;
      case 'empire_claim_streak':
        sql = 'select public.empire_claim_streak($1, $2) as result';
        args = [p.p_user_id, p.p_request_id ?? null];
        break;
      case 'empire_claim_referral_reward':
        sql =
          'select public.empire_claim_referral_reward($1, $2, $3) as result';
        args = [p.p_referrer_user_id, p.p_event_id, p.p_request_id ?? null];
        break;
      case 'empire_assign_daily_missions':
        sql = 'select public.empire_assign_daily_missions($1, $2) as result';
        args = [p.p_user_id, p.p_target_date ?? null];
        break;
      case 'empire_increment_mission_progress':
        sql =
          'select public.empire_increment_mission_progress($1, $2, $3) as result';
        args = [p.p_user_id, p.p_action_key, p.p_increment ?? 1];
        break;
      case 'empire_evaluate_referral_milestones':
        sql = 'select public.empire_evaluate_referral_milestones($1) as result';
        args = [p.p_invitee_user_id];
        break;

      // Leaderboard RPCs
      case 'empire_leaderboard_get_season':
        sql = 'select public.empire_leaderboard_get_season($1) as result';
        args = [p.p_season_id ?? null];
        break;
      case 'empire_leaderboard_get_scores':
        sql = 'select public.empire_leaderboard_get_scores($1) as result';
        args = [p.p_season_id];
        break;
      case 'empire_leaderboard_get_friends':
        sql = 'select public.empire_leaderboard_get_friends($1) as result';
        args = [p.p_user_id];
        break;
      case 'empire_leaderboard_freeze':
        sql = 'select public.empire_leaderboard_freeze($1, $2, $3) as result';
        args = [p.p_season_id, p.p_admin_user_id ?? null, p.p_reason ?? null];
        break;

      // Shop RPCs
      case 'empire_shop_get_pass':
        sql = 'select public.empire_shop_get_pass($1) as result';
        args = [p.p_user_id];
        break;
      case 'empire_shop_create_invoice':
        sql = 'select public.empire_shop_create_invoice($1, $2, $3) as result';
        args = [p.p_user_id, p.p_sku, p.p_request_id];
        break;
      case 'empire_shop_fulfill_payment':
        sql =
          'select public.empire_shop_fulfill_payment($1, $2, $3, $4) as result';
        args = [
          p.p_charge_id,
          p.p_invoice_payload,
          p.p_stars_amount,
          p.p_sku ?? null,
        ];
        break;

      // Config RPCs
      case 'empire_config_get':
        sql = 'select public.empire_config_get() as result';
        args = [];
        break;
      case 'empire_config_update':
        sql =
          'select public.empire_config_update($1, $2::jsonb, $3, $4) as result';
        args = [
          p.p_key,
          JSON.stringify(p.p_value),
          p.p_admin_user_id ?? null,
          p.p_reason ?? null,
        ];
        break;

      // Analytics RPCs
      case 'empire_analytics_track':
        sql =
          'select public.empire_analytics_track($1, $2, $3::jsonb) as result';
        args = [
          p.p_user_id ?? null,
          p.p_session_id ?? null,
          JSON.stringify(p.p_events),
        ];
        break;
      case 'empire_analytics_get_cohort_data':
        sql = 'select public.empire_analytics_get_cohort_data() as result';
        args = [];
        break;
      case 'empire_analytics_get_metrics':
        sql = 'select public.empire_analytics_get_metrics() as result';
        args = [];
        break;

      // Fraud & Admin RPCs
      case 'empire_admin_check_role':
        sql = 'select public.empire_admin_check_role($1, $2) as result';
        args = [p.p_user_id, p.p_required_role ?? 'admin'];
        break;
      case 'empire_admin_get_fraud_flags':
        sql =
          'select public.empire_admin_get_fraud_flags($1, $2, $3, $4, $5) as result';
        args = [
          p.p_status ?? null,
          p.p_user_id ?? null,
          p.p_severity ?? null,
          p.p_limit ?? 50,
          p.p_offset ?? 0,
        ];
        break;
      case 'empire_admin_get_frozen_rewards':
        sql =
          'select public.empire_admin_get_frozen_rewards($1, $2, $3, $4) as result';
        args = [
          p.p_status ?? 'frozen',
          p.p_user_id ?? null,
          p.p_limit ?? 50,
          p.p_offset ?? 0,
        ];
        break;
      case 'empire_admin_review_reward':
        sql =
          'select public.empire_admin_review_reward($1, $2, $3, $4) as result';
        args = [
          p.p_frozen_reward_id,
          p.p_admin_user_id,
          p.p_decision,
          p.p_notes,
        ];
        break;
      case 'empire_admin_review_flag':
        sql =
          'select public.empire_admin_review_flag($1, $2, $3, $4) as result';
        args = [p.p_flag_id, p.p_admin_user_id, p.p_decision, p.p_notes];
        break;
      case 'empire_fraud_create_flag':
        sql =
          'select public.empire_fraud_create_flag($1, $2, $3, $4, $5, $6, $7::jsonb) as result';
        args = [
          p.p_user_id,
          p.p_target_type,
          p.p_target_id,
          p.p_risk_score,
          p.p_reason_codes,
          p.p_severity ?? null,
          JSON.stringify(p.p_metadata ?? {}),
        ];
        break;
      case 'empire_fraud_freeze_reward':
        sql =
          'select public.empire_fraud_freeze_reward($1, $2, $3, $4, $5, $6, $7, $8::jsonb) as result';
        args = [
          p.p_user_id,
          p.p_reward_type,
          p.p_amount_cash,
          p.p_amount_season_points,
          p.p_freeze_reason,
          p.p_fraud_flag_id ?? null,
          p.p_source_ref_id ?? null,
          JSON.stringify(p.p_metadata ?? {}),
        ];
        break;
      case 'empire_admin_assign_role':
        sql = 'select public.empire_admin_assign_role($1, $2, $3) as result';
        args = [p.p_target_user_id, p.p_role, p.p_assigned_by ?? null];
        break;

      default:
        throw new Error(`Unexpected RPC in launch test harness: ${name}`);
    }

    return db.transaction(async (tx) => {
      await tx.exec('set local role service_role');
      const result = await tx.query<{ result: unknown }>(sql, args);
      return Response.json(result.rows[0]?.result ?? null);
    });
  };

  const url = 'https://test.supabase.co';
  const serviceKey = 'launch-service-key';

  const authStore = new SupabaseAuthStore(url, serviceKey, fetcher);
  const economyStore = new SupabaseEconomyStore(url, serviceKey, fetcher);
  const leaderboardStore = new SupabaseLeaderboardStore(
    url,
    serviceKey,
    fetcher,
  );
  const shopStore = new SupabaseShopStore(url, serviceKey, fetcher);
  const configStore = new SupabaseConfigStore(url, serviceKey, fetcher);
  const analyticsStore = new SupabaseAnalyticsStore(url, serviceKey, fetcher);
  const fraudStore = new SupabaseFraudStore(url, serviceKey, fetcher);

  const env: Bindings = {
    TELEGRAM_BOT_TOKEN: '123456:launch-concurrency-bot',
    SESSION_SECRET: LAUNCH_SESSION_SECRET,
    APP_ORIGIN: LAUNCH_APP_ORIGIN,
    SUPABASE_URL: url,
    SUPABASE_SERVICE_ROLE_KEY: serviceKey,
    AUTH_RATE_LIMIT: { limit: async () => ({ success: true }) },
  };

  const app = createApp(
    {
      makeAuthStore: () => authStore,
      makeEconomyStore: () => economyStore,
      makeLeaderboardStore: () => leaderboardStore,
      makeShopStore: () => shopStore,
      makeConfigStore: () => configStore,
      makeAnalyticsStore: () => analyticsStore,
      makeFraudStore: () => fraudStore,
    },
    () => Math.floor(Date.now() / 1000),
  );

  return {
    db,
    app,
    authStore,
    economyStore,
    leaderboardStore,
    shopStore,
    configStore,
    analyticsStore,
    fraudStore,
    env,
    client: {
      seedRegularUser: (options) => seedRegularUser(db, options),
      seedAdminUser: (options) => seedAdminUser(db, options),
      seedCompletedMission: (userId, key) =>
        seedCompletedMission(db, userId, key),
      createSessionCookie: async (
        sid: string,
        secret?: string,
        iat?: number,
        exp?: number,
      ) => {
        if (iat === undefined || exp === undefined) {
          const sessRes = await db.query<{ iat: string; exp: string }>(
            `select extract(epoch from issued_at)::bigint as iat, extract(epoch from expires_at)::bigint as exp from public.auth_sessions where id = $1`,
            [sid],
          );
          if (sessRes.rows.length > 0) {
            iat = Number(sessRes.rows[0]!.iat);
            exp = Number(sessRes.rows[0]!.exp);
          }
        }
        return createSessionCookie(
          sid,
          secret ?? LAUNCH_SESSION_SECRET,
          iat,
          exp,
        );
      },
    },
  };
}
