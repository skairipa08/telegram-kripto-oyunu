import { PGlite } from '@electric-sql/pglite';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { COOKIE } from '../auth/routes';
import { signSession } from '../auth/crypto';
import { SupabaseAuthStore, type AuthStore } from '../auth/store';
import { SupabaseFraudStore, type FraudStore } from './store';
import { SupabaseAdminStore, type AdminStore } from '../admin/store';
import { SupabaseConfigStore, type ConfigStore } from '../config/store';

export async function createSessionCookie(
  sid: string,
  secret: string,
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
  const now = options.nowSec ?? Math.floor(Date.now() / 1000);
  const exp = now + 1800;

  const userRes = await db.query<{ id: string }>(
    `insert into public.users (telegram_user_id, first_name, username, language, status, risk_score)
     values ($1, $2, $3, 'en', 'active', 0)
     returning id`,
    [telegramId, firstName, username],
  );
  const userId = userRes.rows[0]!.id;

  await db.query(
    `insert into public.player_balances (user_id, cash, season_points)
     values ($1, $2, $3)
     on conflict (user_id) do update set cash = excluded.cash, season_points = excluded.season_points`,
    [userId, cash, points],
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

  return { userId, sid, telegramId, username, iat: now, exp };
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

export async function seedFraudFlag(
  db: PGlite,
  params: {
    userId: string;
    targetType?: string | undefined;
    targetId?: string | undefined;
    riskScore?: number | undefined;
    reasonCodes?: string[] | undefined;
    severity?: ('low' | 'medium' | 'high' | 'critical') | undefined;
    status?:
      ('pending' | 'investigating' | 'resolved' | 'dismissed') | undefined;
    metadata?: Record<string, unknown> | undefined;
  },
): Promise<{ id: string; [key: string]: unknown }> {
  const id = crypto.randomUUID();
  const targetType = params.targetType ?? 'reward';
  const targetId = params.targetId ?? crypto.randomUUID();
  const riskScore = params.riskScore ?? 85;
  const reasonCodes = params.reasonCodes ?? ['VELOCITY_CAP_EXCEEDED'];
  const severity = params.severity ?? 'critical';
  const status = params.status ?? 'pending';
  const metadata = JSON.stringify(params.metadata ?? {});

  const res = await db.query<{ id: string }>(
    `insert into public.fraud_flags (id, user_id, target_type, target_id, risk_score, reason_codes, severity, status, metadata)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
     returning *`,
    [
      id,
      params.userId,
      targetType,
      targetId,
      riskScore,
      reasonCodes,
      severity,
      status,
      metadata,
    ],
  );
  return res.rows[0] as { id: string; [key: string]: unknown };
}

export async function seedFrozenReward(
  db: PGlite,
  params: {
    userId: string;
    rewardType?:
      | (
          | 'cash_claim'
          | 'mission_reward'
          | 'referral_bonus'
          | 'streak_bonus'
          | 'airdrop'
        )
      | undefined;
    amountCash?: number | undefined;
    amountSeasonPoints?: number | undefined;
    freezeReason?: string | undefined;
    fraudFlagId?: string | null | undefined;
    sourceRefId?: string | null | undefined;
    metadata?: Record<string, unknown> | undefined;
  },
): Promise<{ id: string; [key: string]: unknown }> {
  const id = crypto.randomUUID();
  const rewardType = params.rewardType ?? 'cash_claim';
  const amountCash = params.amountCash ?? 5000;
  const amountSeasonPoints = params.amountSeasonPoints ?? 100;
  const freezeReason = params.freezeReason ?? 'Anomalous velocity detected';
  const fraudFlagId = params.fraudFlagId ?? null;
  const sourceRefId = params.sourceRefId ?? null;
  const metadata = JSON.stringify(params.metadata ?? {});

  const res = await db.query<{ id: string }>(
    `insert into public.frozen_rewards (id, user_id, fraud_flag_id, reward_type, amount_cash, amount_season_points, status, freeze_reason, source_ref_id, metadata)
     values ($1, $2, $3, $4, $5, $6, 'frozen', $7, $8, $9::jsonb)
     returning *`,
    [
      id,
      params.userId,
      fraudFlagId,
      rewardType,
      amountCash,
      amountSeasonPoints,
      freezeReason,
      sourceRefId,
      metadata,
    ],
  );
  return res.rows[0] as { id: string; [key: string]: unknown };
}

export interface TestDatabaseHarness {
  db: PGlite;
  authStore: AuthStore;
  fraudStore: FraudStore;
  adminStore: AdminStore;
  configStore: ConfigStore;
  client: {
    seedRegularUser: (
      options?: Parameters<typeof seedRegularUser>[1],
    ) => Promise<SeedUserResult>;
    seedAdminUser: (
      options?: Parameters<typeof seedAdminUser>[1],
    ) => Promise<SeedAdminResult>;
    seedFraudFlag: (
      params: Parameters<typeof seedFraudFlag>[1],
    ) => Promise<{ id: string; [key: string]: unknown }>;
    seedFrozenReward: (
      params: Parameters<typeof seedFrozenReward>[1],
    ) => Promise<{ id: string; [key: string]: unknown }>;
    createSessionCookie: typeof createSessionCookie;
  };
}

export async function createFraudTestDatabase(): Promise<TestDatabaseHarness> {
  const db = new PGlite();
  await db.exec(
    'create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;',
  );

  const migrationFiles = [
    '202609140001_auth.sql',
    '202609140002_economy.sql',
    '202609140003_seasons_missions.sql',
    '202609140004_referrals.sql',
    '202609140005_step7_to_11_backend.sql',
    '202609140006_economy_starter_and_roi.sql',
    '202609140007_game_loop_apis.sql',
    '202609140008_anti_fraud.sql',
    '202609140010_designated_admins.sql',
    '202609140011_admin_governance.sql',
  ];

  for (const file of migrationFiles) {
    const url = new URL(
      `../../../../supabase/migrations/${file}`,
      import.meta.url,
    );
    if (existsSync(url)) {
      const sql = await readFile(url, 'utf8');
      await db.exec(sql);
    }
  }

  // Schema baseline additions for test stability
  await db.exec(`
    alter table public.missions add column if not exists reward_points integer default 375;
    update public.missions set reward_points = round(reward_sru_multiplier * 500);

    alter table public.referrals add column if not exists referrer_id uuid;
    alter table public.referrals add column if not exists invitee_id uuid;
    alter table public.referrals add column if not exists is_qualified boolean default false;
    alter table public.referrals add column if not exists qualified_at timestamptz;
    alter table public.referrals alter column invitee_user_id drop not null;
    alter table public.referrals alter column referrer_user_id drop not null;
    alter table public.referrals alter column code drop not null;

    insert into public.seasons (id, name, status, starts_at, ends_at, sru_snapshot)
    values ('00000000-0000-0000-0000-000000000001', 'Season 1', 'active', now() - interval '1 day', now() + interval '30 days', 500)
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
      case 'empire_admin_update_config':
        sql =
          'select public.empire_admin_update_config($1, $2::jsonb, $3, $4, $5, $6) as result';
        args = [
          p.p_key,
          JSON.stringify(p.p_value),
          p.p_admin_user_id ?? null,
          p.p_reason ?? null,
          p.p_request_id ?? null,
          p.p_admin_username ?? null,
        ];
        break;
      case 'empire_admin_get_audit_logs':
        sql = 'select public.empire_admin_get_audit_logs($1, $2, $3) as result';
        args = [p.p_limit ?? 50, p.p_offset ?? 0, p.p_target_key ?? null];
        break;
      case 'empire_admin_get_flagged_accounts':
        sql =
          'select public.empire_admin_get_flagged_accounts($1, $2) as result';
        args = [p.p_limit ?? 50, p.p_offset ?? 0];
        break;
      case 'empire_admin_unfreeze_account':
        sql =
          'select public.empire_admin_unfreeze_account($1, $2, $3, $4, $5) as result';
        args = [
          p.p_target_user_id,
          p.p_admin_user_id ?? null,
          p.p_notes ?? null,
          p.p_request_id ?? null,
          p.p_admin_username ?? null,
        ];
        break;
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

      default:
        throw new Error(`Unexpected RPC in fraud test harness: ${name}`);
    }

    return db.transaction(async (tx) => {
      await tx.exec('set local role service_role');
      const result = await tx.query<{ result: unknown }>(sql, args);
      return Response.json(result.rows[0]?.result ?? null);
    });
  };

  const url = 'https://test.supabase.co';
  const serviceKey = 'test-service-key';

  const authStore = new SupabaseAuthStore(url, serviceKey, fetcher);
  const fraudStore = new SupabaseFraudStore(url, serviceKey, fetcher);
  const adminStore = new SupabaseAdminStore(url, serviceKey, fetcher);
  const configStore = new SupabaseConfigStore(url, serviceKey, fetcher);

  return {
    db,
    authStore,
    fraudStore,
    adminStore,
    configStore,
    client: {
      seedRegularUser: (options) => seedRegularUser(db, options),
      seedAdminUser: (options) => seedAdminUser(db, options),
      seedFraudFlag: (params) => seedFraudFlag(db, params),
      seedFrozenReward: (params) => seedFrozenReward(db, params),
      createSessionCookie,
    },
  };
}
