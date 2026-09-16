import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { SupabaseAuthStore } from './store';
import { SupabaseLeaderboardStore } from '../leaderboard/store';
import { SupabaseShopStore } from '../shop/store';
import { SupabaseConfigStore } from '../config/store';
import { SupabaseAnalyticsStore } from '../analytics/store';
import { SupabaseEconomyStore } from '../economy/store';

// Test-only PostgreSQL engine; never imported by the Worker entrypoint.
export async function createTestDatabase() {
  const db = new PGlite();
  await db.exec(
    'create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;',
  );

  const migrations = [
    '202609140001_auth.sql',
    '202609140002_economy.sql',
    '202609140003_seasons_missions.sql',
    '202609140004_referrals.sql',
    '202609140005_step7_to_11_backend.sql',
    '202609140006_economy_starter_and_roi.sql',
    '202609140007_game_loop_apis.sql',
    '202609140008_anti_fraud.sql',
    '202609140009_missions_and_launch.sql',
    '202609140010_designated_admins.sql',
  ];

  for (const file of migrations) {
    const sql = await readFile(
      new URL(`../../../../supabase/migrations/${file}`, import.meta.url),
      'utf8',
    );
    await db.exec(sql);
  }

  const fetcher: typeof fetch = async (input, init) => {
    const name = new URL(String(input)).pathname.split('/').at(-1);
    const p = init?.body ? JSON.parse(String(init.body)) : {};
    let sql: string;
    let args: unknown[] = [];

    switch (name) {
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
        args = [p.p_user_id, p.p_target_date];
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
      default:
        throw new Error(`Unexpected RPC: ${name}`);
    }

    return db.transaction(async (tx) => {
      await tx.exec('set local role service_role');
      const result = await tx.query<{ result: unknown }>(sql, args);
      return Response.json(result.rows[0]?.result ?? null);
    });
  };

  const url = 'https://test.supabase.co';
  const serviceKey = 'test-service-key';

  return {
    db,
    store: new SupabaseAuthStore(url, serviceKey, fetcher),
    leaderboardStore: new SupabaseLeaderboardStore(url, serviceKey, fetcher),
    shopStore: new SupabaseShopStore(url, serviceKey, fetcher),
    configStore: new SupabaseConfigStore(url, serviceKey, fetcher),
    analyticsStore: new SupabaseAnalyticsStore(url, serviceKey, fetcher),
    economyStore: new SupabaseEconomyStore(url, serviceKey, fetcher),
  };
}
