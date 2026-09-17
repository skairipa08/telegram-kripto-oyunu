-- ==========================================
-- PROJECT EMPIRE FULL CONSOLIDATED SCHEMA
-- ==========================================

-- >>> 202609140001_auth.sql <<<
begin;

create table public.users (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null unique check (telegram_user_id > 0 and telegram_user_id <= 9007199254740991),
  first_name text not null check (length(first_name) between 1 and 256),
  username text check (length(username) <= 64),
  language text check (length(language) <= 32),
  status text not null default 'active' check (status in ('active','banned','suspended')),
  risk_score integer not null default 0 check (risk_score >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Retain replay fingerprints even after expiry/revocation. No deletion cascade.
-- A future cleanup may remove rows only after auth_date + 330 seconds AND expiry.
create table public.auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  init_fingerprint text not null unique check (init_fingerprint ~ '^[a-f0-9]{64}$'),
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  telegram_auth_date bigint not null,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check (expires_at = issued_at + interval '30 minutes')
);
create index auth_sessions_user_id_idx on public.auth_sessions(user_id);
create index auth_sessions_expiry_idx on public.auth_sessions(expires_at);

alter table public.users enable row level security;
alter table public.auth_sessions enable row level security;
revoke all on public.users, public.auth_sessions from public, anon, authenticated;
grant select, insert, update on public.users, public.auth_sessions to service_role;

create function public.empire_auth_session(p_sid uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'sid',s.id,'issuedAt',extract(epoch from s.issued_at)::bigint,
    'expiresAt',extract(epoch from s.expires_at)::bigint,
    'user',jsonb_build_object('id',u.id,'telegramId',u.telegram_user_id::text,
      'firstName',u.first_name,'username',u.username,'language',u.language)
  )
  from public.auth_sessions s join public.users u on u.id=s.user_id
  where s.id=p_sid and s.revoked_at is null and s.expires_at>now() and u.status='active';
$$;

create function public.empire_auth_login(
  p_telegram_id text, p_first_name text, p_username text, p_language text,
  p_fingerprint text, p_request_hash text, p_auth_date bigint
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_user public.users;
  v_session public.auth_sessions;
  v_now timestamptz := date_trunc('second',now());
  v_result jsonb;
begin
  if p_auth_date < extract(epoch from v_now)::bigint - 300
     or p_auth_date > extract(epoch from v_now)::bigint + 30
     or p_auth_date is null
     or p_telegram_id is null or p_telegram_id !~ '^[1-9][0-9]{0,15}$'
     or p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$'
     or p_request_hash is null or p_request_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('outcome','unavailable');
  end if;

  -- Upsert holds the user row lock throughout session issuance. Never change status.
  insert into public.users(telegram_user_id,first_name,username,language)
  values(p_telegram_id::bigint,p_first_name,p_username,p_language)
  on conflict(telegram_user_id) do update set
    first_name=excluded.first_name,username=excluded.username,language=excluded.language,updated_at=now()
  returning * into v_user;
  if v_user.status <> 'active' then return jsonb_build_object('outcome','unavailable'); end if;

  insert into public.auth_sessions(user_id,init_fingerprint,request_hash,telegram_auth_date,issued_at,expires_at)
  values(v_user.id,p_fingerprint,p_request_hash,p_auth_date,v_now,v_now+interval '30 minutes')
  on conflict(init_fingerprint) do nothing;
  select * into v_session from public.auth_sessions where init_fingerprint=p_fingerprint for update;
  if v_session.user_id <> v_user.id or v_session.request_hash <> p_request_hash then
    return jsonb_build_object('outcome','replay');
  end if;
  v_result:=public.empire_auth_session(v_session.id);
  if v_result is null then return jsonb_build_object('outcome','unavailable'); end if;
  return jsonb_build_object('outcome','ok','session',v_result);
end;
$$;

create function public.empire_auth_logout(p_sid uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
begin
  update public.auth_sessions set revoked_at=coalesce(revoked_at,now()) where id=p_sid;
  return jsonb_build_object('revoked',true);
end;
$$;

revoke all on function public.empire_auth_session(uuid) from public, anon, authenticated;
revoke all on function public.empire_auth_login(text,text,text,text,text,text,bigint) from public, anon, authenticated;
revoke all on function public.empire_auth_logout(uuid) from public, anon, authenticated;
grant execute on function public.empire_auth_session(uuid) to service_role;
grant execute on function public.empire_auth_login(text,text,text,text,text,text,bigint) to service_role;
grant execute on function public.empire_auth_logout(uuid) to service_role;

commit;


-- >>> 202609140002_economy.sql <<<
begin;

-- Remote / Seed Economy Configurations (Blueprint Section 18)
create table public.economy_config (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);

insert into public.economy_config(key, value, description) values
  ('economy.offline_cap_free_sec', '14400'::jsonb, 'Free tier offline claim cap in seconds (4h)'),
  ('economy.offline_cap_pass_sec', '43200'::jsonb, 'Pass tier offline claim cap in seconds (12h)'),
  ('economy.upgrade_cost_growth', '1.18'::jsonb, 'Exponential base for upgrade costs'),
  ('economy.production_level_growth', '1.07'::jsonb, 'Exponential base for production per level'),
  ('season.sru_base', '500'::jsonb, 'Base Standard Reward Unit for Season Points'),
  ('season.sru_reference_qap', '100'::jsonb, 'Reference QAP for SRU curve'),
  ('season.sru_exponent', '-0.10'::jsonb, 'Diminishing exponent for SRU curve'),
  ('season.sru_min', '100'::jsonb, 'Minimum floor for SRU'),
  ('season.sru_max', '500'::jsonb, 'Maximum cap for SRU'),
  ('referral.diminish_threshold', '20'::jsonb, 'Qualified referrals threshold before diminishing factor'),
  ('referral.diminish_floor', '0.25'::jsonb, 'Minimum floor multiplier for referral Season Points'),
  ('feature.token', 'false'::jsonb, 'Token / Web3 module feature flag (default false)'),
  ('feature.stars_payments', 'false'::jsonb, 'Telegram Stars payment feature flag (default false)');

-- Canonical Business Definitions
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9_]{1,64}$'),
  name text not null check (length(name) between 1 and 128),
  base_cost bigint not null check (base_cost > 0),
  base_income bigint not null check (base_income > 0),
  sort_order integer not null unique check (sort_order > 0),
  created_at timestamptz not null default now()
);

insert into public.businesses(slug, name, base_cost, base_income, sort_order) values
  ('street_stand', 'Street Stand', 100, 1, 1),
  ('cafe', 'Cafe', 2500, 12, 2),
  ('delivery_hub', 'Delivery Hub', 25000, 90, 3),
  ('factory', 'Factory', 250000, 600, 4),
  ('tech_company', 'Tech Company', 3000000, 5000, 5),
  ('global_holding', 'Global Holding', 50000000, 60000, 6);

-- Player Balances (Cash and Season Points)
create table public.player_balances (
  user_id uuid primary key references public.users(id) on delete cascade,
  cash bigint not null default 0 check (cash >= 0),
  season_points bigint not null default 0 check (season_points >= 0),
  updated_at timestamptz not null default now()
);

-- Player Owned Businesses and Progression
create table public.player_businesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id),
  level integer not null default 0 check (level >= 0),
  last_claim_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, business_id)
);
create index player_businesses_user_id_idx on public.player_businesses(user_id);

-- Immutable Reward and Transaction Ledger
create table public.reward_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  delta_cash bigint not null default 0,
  delta_season_points bigint not null default 0,
  reason text not null check (length(reason) between 1 and 64),
  idempotency_key text unique check (idempotency_key ~ '^[a-f0-9]{64}$'),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index reward_ledger_user_id_idx on public.reward_ledger(user_id);
create index reward_ledger_created_at_idx on public.reward_ledger(created_at);

-- Row Level Security
alter table public.economy_config enable row level security;
alter table public.businesses enable row level security;
alter table public.player_balances enable row level security;
alter table public.player_businesses enable row level security;
alter table public.reward_ledger enable row level security;

revoke all on public.economy_config, public.businesses, public.player_balances, public.player_businesses, public.reward_ledger from public, anon, authenticated;
grant select, insert, update on public.economy_config, public.businesses, public.player_balances, public.player_businesses, public.reward_ledger to service_role;

commit;


-- >>> 202609140003_seasons_missions.sql <<<
begin;

-- Seasons Model
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 64),
  status text not null default 'upcoming' check (status in ('upcoming', 'active', 'frozen', 'ended')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  sru_snapshot integer not null default 500 check (sru_snapshot >= 100 and sru_snapshot <= 500),
  qap_snapshot integer not null default 100 check (qap_snapshot >= 0),
  config_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- Seed Genesis Season 1
insert into public.seasons (name, status, starts_at, ends_at, sru_snapshot, qap_snapshot)
values ('Genesis Season', 'active', now(), now() + interval '30 days', 500, 100);

-- Season Scores per Player
create table public.season_scores (
  season_id uuid not null references public.seasons(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  points bigint not null default 0 check (points >= 0),
  mission_points bigint not null default 0 check (mission_points >= 0),
  referral_points bigint not null default 0 check (referral_points >= 0),
  updated_at timestamptz not null default now(),
  primary key (season_id, user_id)
);
create index season_scores_leaderboard_idx on public.season_scores(season_id, points desc);

-- Canonical Mission Definitions Pool
create table public.missions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9_]{1,64}$'),
  difficulty text not null check (difficulty in ('easy', 'normal', 'hard', 'weekly')),
  title text not null check (length(title) between 1 and 128),
  description text not null check (length(description) between 1 and 256),
  target integer not null check (target > 0),
  reward_sru_multiplier numeric(4, 2) not null check (reward_sru_multiplier > 0),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.missions (key, difficulty, title, description, target, reward_sru_multiplier) values
  ('upgrade_any_3', 'easy', 'Hızlı Yatırım', 'Herhangi bir işletmeyi 3 kez yükselt', 3, 0.75),
  ('claim_cash_2', 'easy', 'Tahsilat Zamanı', 'İşletmelerden 2 kez gelir topla', 2, 0.75),
  ('view_friends', 'easy', 'Ağını Genişlet', 'Arkadaşlar sekmesini ziyaret et', 1, 0.75),
  ('upgrade_any_10', 'normal', 'Büyüme Dalgası', 'Toplam 10 kez işletme yükseltmesi yap', 10, 1.00),
  ('reach_milestone', 'normal', 'Dönüm Noktası', 'Bir işletmeyi seviye dönüm noktasına (10, 25, 50 vb.) ulaştır', 1, 1.00),
  ('claim_cash_5', 'normal', 'Düzenli Gelir', '5 kez gelir topla', 5, 1.00),
  ('claim_offline_4h', 'hard', 'Büyük Hasat', 'En az 4 saatlik çevrimdışı birikmiş kazancı tek seferde topla', 1, 1.25),
  ('upgrade_factory_tier', 'hard', 'Sanayi Devrimi', 'Fabrika veya üst düzey bir işletmeyi en az 1 kez yükselt', 1, 1.25),
  ('weekly_complete_15_dailies', 'weekly', 'Haftalık Azim', 'Hafta boyunca toplam 15 günlük görevi başarıyla tamamla', 15, 5.00);

-- Player Assigned Mission Instances
create table public.mission_instances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  mission_id uuid not null references public.missions(id),
  progress integer not null default 0 check (progress >= 0),
  target integer not null check (target > 0),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'claimed')),
  assigned_date date not null default current_date,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, mission_id, assigned_date),
  check ((status = 'claimed' and claimed_at is not null) or (status <> 'claimed' and claimed_at is null))
);
create index mission_instances_user_date_idx on public.mission_instances(user_id, assigned_date);

-- Daily Streak State
create table public.player_streaks (
  user_id uuid primary key references public.users(id) on delete cascade,
  current_streak integer not null default 0 check (current_streak >= 0 and current_streak <= 7),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_claim_date date,
  updated_at timestamptz not null default now()
);

-- Row Level Security
alter table public.seasons enable row level security;
alter table public.season_scores enable row level security;
alter table public.missions enable row level security;
alter table public.mission_instances enable row level security;
alter table public.player_streaks enable row level security;

revoke all on public.seasons, public.season_scores, public.missions, public.mission_instances, public.player_streaks from public, anon, authenticated;
grant select, insert, update on public.seasons, public.season_scores, public.missions, public.mission_instances, public.player_streaks to service_role;

commit;


-- >>> 202609140004_referrals.sql <<<
begin;

-- Add unique referral code to users table
alter table public.users add column if not exists referral_code text unique check (referral_code ~ '^[a-zA-Z0-9_-]{4,32}$');

-- Referrals Table: Tracks the immutable 1-to-1 link between invitee and referrer
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  invitee_user_id uuid not null unique references public.users(id) on delete cascade,
  referrer_user_id uuid not null references public.users(id) on delete cascade,
  code text not null check (length(code) between 4 and 32),
  bound_at timestamptz not null default now(),
  status text not null default 'bound' check (status in ('bound', 'qualified', 'flagged')),
  created_at timestamptz not null default now(),
  check (invitee_user_id <> referrer_user_id)
);
create index referrals_referrer_idx on public.referrals(referrer_user_id);
create index referrals_bound_at_idx on public.referrals(bound_at);

-- Referral Events Table: Tracks individual qualified milestones and rewards
create table public.referral_events (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.referrals(id) on delete cascade,
  milestone text not null check (milestone in ('activation', 'retained_d2', 'retained_d7', 'progression')),
  reward_amount integer not null check (reward_amount > 0),
  qualified_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'claimed', 'frozen')),
  claimed_at timestamptz,
  unique (referral_id, milestone),
  check ((status = 'claimed' and claimed_at is not null) or (status <> 'claimed' and claimed_at is null))
);
create index referral_events_referral_idx on public.referral_events(referral_id);
create index referral_events_status_idx on public.referral_events(status);

-- Row Level Security
alter table public.referrals enable row level security;
alter table public.referral_events enable row level security;

revoke all on public.referrals, public.referral_events from public, anon, authenticated;
grant select, insert, update on public.referrals, public.referral_events to service_role;

commit;


-- >>> 202609140005_step7_to_11_backend.sql <<<
begin;

-- 1. Optimized composite index for deterministic leaderboard ranking and cursor pagination
create index if not exists season_scores_ranking_idx 
  on public.season_scores(season_id, points desc, updated_at asc, user_id asc);

-- 2. Season Archives: Preserves final ranks and points after season freeze
create table public.season_archives (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  final_rank integer not null check (final_rank > 0),
  final_points bigint not null check (final_points >= 0),
  mission_points bigint not null default 0 check (mission_points >= 0),
  referral_points bigint not null default 0 check (referral_points >= 0),
  archived_at timestamptz not null default now(),
  unique (season_id, user_id)
);
create index season_archives_rank_idx on public.season_archives(season_id, final_rank asc);
create index season_archives_user_idx on public.season_archives(user_id);

-- 3. Purchases: Telegram Stars invoice orders and completed transactions
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  telegram_payment_charge_id text unique check (telegram_payment_charge_id is null or length(telegram_payment_charge_id) > 0),
  invoice_payload text not null unique check (length(invoice_payload) between 16 and 128),
  sku text not null check (sku in ('convenience_pass_30d', 'cosmetic_frame_gold', 'cosmetic_emblem_founder')),
  stars_amount integer not null check (stars_amount > 0),
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'refunded')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index purchases_user_id_idx on public.purchases(user_id);
create index purchases_charge_id_idx on public.purchases(telegram_payment_charge_id);

-- 4. Player Entitlements: Convenience Pass status and expiration
create table public.player_entitlements (
  user_id uuid primary key references public.users(id) on delete cascade,
  pass_type text not null default 'convenience_pass',
  is_active boolean not null default true,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
create index player_entitlements_expires_idx on public.player_entitlements(expires_at);

-- 5. Admin Audit Logs: Records administrative and config mutations
create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references public.users(id) on delete set null,
  action text not null check (action in ('update_config', 'set_feature_flag', 'freeze_season', 'ban_user', 'refund_purchase')),
  target_type text not null check (target_type in ('economy_config', 'feature_flag', 'season', 'user', 'purchase')),
  target_key text not null,
  old_value jsonb,
  new_value jsonb not null,
  reason text check (reason is null or length(reason) <= 256),
  created_at timestamptz not null default now()
);
create index admin_audit_logs_target_idx on public.admin_audit_logs(target_type, target_key);
create index admin_audit_logs_created_at_idx on public.admin_audit_logs(created_at desc);

-- 6. Analytics Events: Structured event logging (Blueprint Section 18)
create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  event_name text not null check (event_name in (
    'app_open', 'auth_success', 'tutorial_complete', 'business_upgrade', 'cash_claim',
    'mission_assigned', 'mission_complete', 'mission_claim', 'streak_claim',
    'referral_link_copy', 'referral_bound', 'referral_milestone_qualified', 'referral_reward_claim',
    'leaderboard_view', 'shop_view', 'invoice_created', 'payment_success', 'payment_refund',
    'fraud_flag_created', 'reward_frozen', 'pass_activated'
  )),
  properties jsonb not null default '{}'::jsonb,
  session_id uuid,
  created_at timestamptz not null default now()
);
create index analytics_events_name_date_idx on public.analytics_events(event_name, created_at);
create index analytics_events_user_date_idx on public.analytics_events(user_id, created_at);

-- 7. Daily Metrics Aggregation
create table public.daily_metrics (
  date date primary key,
  qap integer not null default 0,
  sru integer not null default 500,
  dau integer not null default 0,
  new_users integer not null default 0,
  qualified_referrals integer not null default 0,
  revenue_stars integer not null default 0,
  updated_at timestamptz not null default now()
);

-- 8. Seed Remaining Canonical Blueprint Section 18 Economy Configurations
insert into public.economy_config(key, value, description) values
  ('referral.bind_window_min', '30'::jsonb, 'Minutes after signup referral code can be bound'),
  ('pass.price_stars', '250'::jsonb, 'Default price in Telegram Stars for 30-day pass'),
  ('pass.duration_days', '30'::jsonb, 'Duration of Convenience Pass in days'),
  ('mission.daily_slots', '3'::jsonb, 'Number of daily mission slots assigned'),
  ('mission.free_rerolls', '1'::jsonb, 'Free mission rerolls per day'),
  ('mission.pass_rerolls', '3'::jsonb, 'Convenience Pass mission rerolls per day'),
  ('feature.leaderboard', 'true'::jsonb, 'Leaderboard feature flag (default true)'),
  ('feature.referrals', 'true'::jsonb, 'Referral system feature flag (default true)')
on conflict (key) do nothing;

-- 9. Row Level Security & Service Role Grants
alter table public.season_archives enable row level security;
alter table public.purchases enable row level security;
alter table public.player_entitlements enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.analytics_events enable row level security;
alter table public.daily_metrics enable row level security;

revoke all on public.season_archives, public.purchases, public.player_entitlements,
  public.admin_audit_logs, public.analytics_events, public.daily_metrics from public, anon, authenticated;

grant select, insert, update on public.season_archives, public.purchases, public.player_entitlements,
  public.admin_audit_logs, public.analytics_events, public.daily_metrics to service_role;

-- 10. RPC Functions for Backend API Operations

create or replace function public.empire_leaderboard_get_season(p_season_id uuid default null)
returns jsonb language plpgsql security invoker set search_path = 'public' as $$
declare
  v_season public.seasons;
begin
  if p_season_id is not null then
    select * into v_season from public.seasons where id = p_season_id;
  else
    select * into v_season from public.seasons where status = 'active' order by starts_at desc limit 1;
  end if;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_season.id,
    'name', v_season.name,
    'status', v_season.status,
    'startsAt', v_season.starts_at,
    'endsAt', v_season.ends_at,
    'sruSnapshot', v_season.sru_snapshot
  );
end;
$$;

create or replace function public.empire_leaderboard_get_scores(p_season_id uuid)
returns jsonb language sql stable security invoker set search_path = 'public' as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'userId', s.user_id,
        'points', s.points,
        'missionPoints', s.mission_points,
        'referralPoints', s.referral_points,
        'updatedAt', s.updated_at,
        'username', u.username,
        'firstName', u.first_name
      )
    ),
    '[]'::jsonb
  )
  from public.season_scores s
  join public.users u on u.id = s.user_id
  where s.season_id = p_season_id;
$$;

create or replace function public.empire_leaderboard_get_friends(p_user_id uuid)
returns jsonb language sql stable security invoker set search_path = 'public' as $$
  select coalesce(jsonb_agg(friend_id), '[]'::jsonb) from (
    select referrer_user_id as friend_id from public.referrals where invitee_user_id = p_user_id
    union
    select invitee_user_id as friend_id from public.referrals where referrer_user_id = p_user_id
  ) f;
$$;

create or replace function public.empire_leaderboard_freeze(
  p_season_id uuid,
  p_admin_user_id uuid default null,
  p_reason text default null
) returns jsonb language plpgsql security invoker set search_path = 'public' as $$
declare
  v_season public.seasons;
  v_count integer := 0;
  v_now timestamptz := now();
begin
  select * into v_season from public.seasons where id = p_season_id for update;
  if not found then
    return jsonb_build_object('error', 'SEASON_NOT_FOUND');
  end if;
  if v_season.status = 'frozen' or v_season.status = 'ended' then
    return jsonb_build_object('error', 'SEASON_ALREADY_FROZEN');
  end if;

  update public.seasons set status = 'frozen' where id = p_season_id;

  with ranked as (
    select
      user_id,
      points,
      mission_points,
      referral_points,
      row_number() over (order by points desc, updated_at asc, user_id asc)::integer as final_rank
    from public.season_scores
    where season_id = p_season_id
  )
  insert into public.season_archives (
    season_id, user_id, final_rank, final_points, mission_points, referral_points, archived_at
  )
  select p_season_id, user_id, final_rank, points, mission_points, referral_points, v_now
  from ranked
  on conflict (season_id, user_id) do update set
    final_rank = excluded.final_rank,
    final_points = excluded.final_points,
    archived_at = excluded.archived_at;

  get diagnostics v_count = row_count;

  insert into public.admin_audit_logs (
    admin_user_id, action, target_type, target_key, old_value, new_value, reason, created_at
  ) values (
    p_admin_user_id,
    'freeze_season',
    'season',
    p_season_id::text,
    jsonb_build_object('status', v_season.status),
    jsonb_build_object('status', 'frozen'),
    coalesce(p_reason, 'End of season freeze'),
    v_now
  );

  return jsonb_build_object(
    'seasonId', p_season_id,
    'status', 'frozen',
    'frozenAt', v_now,
    'archivedParticipantsCount', v_count
  );
end;
$$;

create or replace function public.empire_shop_get_pass(p_user_id uuid)
returns jsonb language plpgsql security invoker set search_path = 'public' as $$
declare
  v_ent public.player_entitlements;
  v_active boolean := false;
begin
  select * into v_ent from public.player_entitlements where user_id = p_user_id;
  if found and v_ent.expires_at > now() and v_ent.is_active then
    v_active := true;
  end if;

  return jsonb_build_object(
    'isActive', v_active,
    'expiresAt', case when found then v_ent.expires_at else null end
  );
end;
$$;

create or replace function public.empire_shop_create_invoice(
  p_user_id uuid,
  p_sku text,
  p_request_id uuid
) returns jsonb language plpgsql security invoker set search_path = 'public' as $$
declare
  v_price integer;
  v_payload text;
  v_link text;
begin
  if p_sku = 'convenience_pass_30d' then
    select coalesce((value#>>'{}')::integer, 250) into v_price from public.economy_config where key = 'pass.price_stars';
    if v_price is null or v_price <= 0 then v_price := 250; end if;
  elsif p_sku = 'cosmetic_frame_gold' then
    v_price := 150;
  elsif p_sku = 'cosmetic_emblem_founder' then
    v_price := 500;
  else
    return jsonb_build_object('error', 'FORBIDDEN_P2W_SKU');
  end if;

  v_payload := 'inv_' || replace(gen_random_uuid()::text, '-', '') || '_' || replace(p_request_id::text, '-', '');
  v_link := 'https://t.me/$' || v_payload;

  insert into public.purchases (user_id, invoice_payload, sku, stars_amount, status)
  values (p_user_id, v_payload, p_sku, v_price, 'pending');

  return jsonb_build_object(
    'sku', p_sku,
    'starsPrice', v_price,
    'invoicePayload', v_payload,
    'invoiceLink', v_link
  );
end;
$$;

create or replace function public.empire_shop_fulfill_payment(
  p_charge_id text,
  p_invoice_payload text,
  p_stars_amount integer,
  p_sku text default null
) returns jsonb language plpgsql security invoker set search_path = 'public' as $$
declare
  v_purchase public.purchases;
  v_user_id uuid;
  v_sku text;
  v_now timestamptz := now();
  v_expires timestamptz;
  v_existing public.player_entitlements;
begin
  -- Check idempotent duplicate charge id
  select * into v_purchase from public.purchases
  where telegram_payment_charge_id = p_charge_id for update;

  if found and v_purchase.status = 'completed' then
    select expires_at into v_expires from public.player_entitlements where user_id = v_purchase.user_id;
    return jsonb_build_object(
      'success', true,
      'duplicate', true,
      'purchaseId', v_purchase.id,
      'newPassExpiresAt', v_expires
    );
  end if;

  -- Find by payload
  select * into v_purchase from public.purchases
  where invoice_payload = p_invoice_payload for update;

  if found then
    v_user_id := v_purchase.user_id;
    v_sku := v_purchase.sku;
    update public.purchases set
      status = 'completed',
      telegram_payment_charge_id = p_charge_id,
      completed_at = v_now
    where id = v_purchase.id;
  else
    return jsonb_build_object('error', 'UNKNOWN_INVOICE_PAYLOAD');
  end if;

  -- Convenience pass entitlement stacking
  if v_sku = 'convenience_pass_30d' then
    select * into v_existing from public.player_entitlements where user_id = v_user_id for update;
    if found and v_existing.expires_at > v_now then
      v_expires := v_existing.expires_at + interval '30 days';
    else
      v_expires := v_now + interval '30 days';
    end if;

    insert into public.player_entitlements (user_id, pass_type, is_active, starts_at, expires_at, updated_at)
    values (v_user_id, 'convenience_pass', true, v_now, v_expires, v_now)
    on conflict (user_id) do update set
      is_active = true,
      expires_at = excluded.expires_at,
      updated_at = excluded.updated_at;
  end if;

  return jsonb_build_object(
    'success', true,
    'duplicate', false,
    'purchaseId', v_purchase.id,
    'newPassExpiresAt', v_expires
  );
end;
$$;

create or replace function public.empire_config_get()
returns jsonb language sql stable security invoker set search_path = 'public' as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from public.economy_config;
$$;

create or replace function public.empire_config_update(
  p_key text,
  p_value jsonb,
  p_admin_user_id uuid default null,
  p_reason text default null
) returns jsonb language plpgsql security invoker set search_path = 'public' as $$
declare
  v_old_value jsonb;
  v_audit_id uuid := gen_random_uuid();
  v_now timestamptz := now();
begin
  select value into v_old_value from public.economy_config where key = p_key for update;

  insert into public.economy_config (key, value, updated_at)
  values (p_key, p_value, v_now)
  on conflict (key) do update set
    value = excluded.value,
    updated_at = excluded.updated_at;

  insert into public.admin_audit_logs (
    id, admin_user_id, action, target_type, target_key, old_value, new_value, reason, created_at
  ) values (
    v_audit_id,
    p_admin_user_id,
    case when p_key like 'feature.%' then 'set_feature_flag' else 'update_config' end,
    case when p_key like 'feature.%' then 'feature_flag' else 'economy_config' end,
    p_key,
    v_old_value,
    p_value,
    p_reason,
    v_now
  );

  return jsonb_build_object(
    'success', true,
    'key', p_key,
    'updatedValue', p_value,
    'auditLogId', v_audit_id
  );
end;
$$;

create or replace function public.empire_analytics_track(
  p_user_id uuid,
  p_session_id uuid,
  p_events jsonb
) returns jsonb language plpgsql security invoker set search_path = 'public' as $$
declare
  v_event jsonb;
  v_count integer := 0;
begin
  for v_event in select * from jsonb_array_elements(p_events) loop
    insert into public.analytics_events (
      user_id, session_id, event_name, properties, created_at
    ) values (
      p_user_id,
      p_session_id,
      v_event->>'eventName',
      coalesce(v_event->'properties', '{}'::jsonb),
      coalesce((v_event->>'timestamp')::timestamptz, now())
    );
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('acceptedCount', v_count);
end;
$$;

create or replace function public.empire_analytics_get_cohort_data()
returns jsonb language sql stable security invoker set search_path = 'public' as $$
  with user_signups as (
    select id as user_id, created_at as signup_date from public.users
  ),
  user_actives as (
    select user_id, array_agg(distinct created_at::date order by created_at::date) as active_dates
    from public.analytics_events
    where user_id is not null
    group by user_id
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'userId', s.user_id,
      'signupDate', s.signup_date,
      'activeDates', coalesce(a.active_dates, array[]::date[])
    )
  ), '[]'::jsonb)
  from user_signups s
  left join user_actives a on a.user_id = s.user_id;
$$;

create or replace function public.empire_analytics_get_metrics()
returns jsonb language sql stable security invoker set search_path = 'public' as $$
  select jsonb_build_object(
    'totalUsers', (select count(*)::integer from public.users),
    'payingUsers', (select count(distinct user_id)::integer from public.purchases where status = 'completed'),
    'totalStarsRevenue', (select coalesce(sum(stars_amount), 0)::integer from public.purchases where status = 'completed'),
    'activatedUsers', (
      select count(distinct e1.user_id)::integer
      from public.analytics_events e1
      where e1.event_name = 'tutorial_complete'
      and exists (
        select 1 from public.analytics_events e2
        where e2.user_id = e1.user_id and e2.event_name = 'business_upgrade'
      )
    )
  );
$$;

revoke all on function public.empire_leaderboard_get_season(uuid) from public, anon, authenticated;
revoke all on function public.empire_leaderboard_get_scores(uuid) from public, anon, authenticated;
revoke all on function public.empire_leaderboard_get_friends(uuid) from public, anon, authenticated;
revoke all on function public.empire_leaderboard_freeze(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.empire_shop_get_pass(uuid) from public, anon, authenticated;
revoke all on function public.empire_shop_create_invoice(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.empire_shop_fulfill_payment(text, text, integer, text) from public, anon, authenticated;
revoke all on function public.empire_config_get() from public, anon, authenticated;
revoke all on function public.empire_config_update(text, jsonb, uuid, text) from public, anon, authenticated;
revoke all on function public.empire_analytics_track(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.empire_analytics_get_cohort_data() from public, anon, authenticated;
revoke all on function public.empire_analytics_get_metrics() from public, anon, authenticated;

grant execute on function public.empire_leaderboard_get_season(uuid) to service_role;
grant execute on function public.empire_leaderboard_get_scores(uuid) to service_role;
grant execute on function public.empire_leaderboard_get_friends(uuid) to service_role;
grant execute on function public.empire_leaderboard_freeze(uuid, uuid, text) to service_role;
grant execute on function public.empire_shop_get_pass(uuid) to service_role;
grant execute on function public.empire_shop_create_invoice(uuid, text, uuid) to service_role;
grant execute on function public.empire_shop_fulfill_payment(text, text, integer, text) to service_role;
grant execute on function public.empire_config_get() to service_role;
grant execute on function public.empire_config_update(text, jsonb, uuid, text) to service_role;
grant execute on function public.empire_analytics_track(uuid, uuid, jsonb) to service_role;
grant execute on function public.empire_analytics_get_cohort_data() to service_role;
grant execute on function public.empire_analytics_get_metrics() to service_role;

commit;



-- >>> 202609140006_economy_starter_and_roi.sql <<<
begin;

-- 1. Ensure player_balances default cash is 100 (preventing 0-cash deadlock)
alter table public.player_balances 
  alter column cash set default 100;

-- 2. Trigger function to initialize new users with starter economy automatically
create or replace function public.empire_handle_new_user_starter_economy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 2.1 Initialize player balance with 100 starter cash
  insert into public.player_balances (user_id, cash, season_points)
  values (new.id, 100, 0)
  on conflict (user_id) do nothing;

  -- 2.2 Initialize all 6 canonical businesses at level 0 for the player
  insert into public.player_businesses (user_id, business_id, level, last_claim_at)
  select new.id, b.id, 0, now()
  from public.businesses b
  on conflict (user_id, business_id) do nothing;

  -- 2.3 Record immutable starter grant in the reward ledger
  insert into public.reward_ledger (user_id, delta_cash, delta_season_points, reason, metadata)
  values (new.id, 100, 0, 'starter_grant', '{"type":"base_onboarding","cash":100}'::jsonb);

  return new;
end;
$$;

drop trigger if exists trigger_new_user_starter_economy on public.users;
create trigger trigger_new_user_starter_economy
  after insert on public.users
  for each row
  execute function public.empire_handle_new_user_starter_economy();

-- 3. Dedicated idempotent RPC for initializing or boosting player economy
create or replace function public.empire_init_player_economy(
  p_user_id uuid,
  p_is_referred boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cash bigint := 100;
  v_bonus bigint := 0;
  v_existing_cash bigint;
begin
  if p_is_referred then
    v_bonus := 500;
    v_cash := v_cash + v_bonus;
  end if;

  select cash into v_existing_cash
  from public.player_balances
  where user_id = p_user_id;

  if v_existing_cash is null then
    insert into public.player_balances (user_id, cash, season_points)
    values (p_user_id, v_cash, 0)
    on conflict (user_id) do nothing;

    insert into public.reward_ledger (user_id, delta_cash, delta_season_points, reason, metadata)
    values (p_user_id, v_cash, 0, 'starter_grant', jsonb_build_object('type', 'onboarding', 'is_referred', p_is_referred, 'cash', v_cash));
  elsif p_is_referred and v_existing_cash < 600 then
    -- Add referral boost if player has not yet received it
    update public.player_balances
    set cash = cash + v_bonus, updated_at = now()
    where user_id = p_user_id;

    insert into public.reward_ledger (user_id, delta_cash, delta_season_points, reason, metadata)
    values (p_user_id, v_bonus, 0, 'referral_boost_grant', jsonb_build_object('type', 'referral_onboarding', 'cash', v_bonus));
  end if;

  -- Ensure all businesses exist
  insert into public.player_businesses (user_id, business_id, level, last_claim_at)
  select p_user_id, b.id, 0, now()
  from public.businesses b
  on conflict (user_id, business_id) do nothing;

  select cash into v_cash from public.player_balances where user_id = p_user_id;

  return jsonb_build_object(
    'success', true,
    'cash', v_cash,
    'isReferred', p_is_referred
  );
end;
$$;

-- 4. RPC to fetch full player economy state for API endpoints
create or replace function public.empire_economy_get_player_state(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cash bigint;
  v_season_points bigint;
  v_has_pass boolean := false;
  v_businesses jsonb;
begin
  select cash, season_points into v_cash, v_season_points
  from public.player_balances where user_id = p_user_id;

  -- Auto-initialize if player row does not exist yet
  if v_cash is null then
    v_cash := 100;
    v_season_points := 0;
  end if;

  select coalesce(is_active and expires_at > now(), false) into v_has_pass
  from public.player_entitlements
  where user_id = p_user_id and pass_type = 'convenience_pass';

  select jsonb_agg(
    jsonb_build_object(
      'slug', b.slug,
      'name', b.name,
      'level', coalesce(pb.level, 0),
      'baseCost', b.base_cost,
      'baseIncome', b.base_income,
      'sortOrder', b.sort_order,
      'lastClaimAt', coalesce(pb.last_claim_at, now())
    ) order by b.sort_order asc
  ) into v_businesses
  from public.businesses b
  left join public.player_businesses pb on pb.business_id = b.id and pb.user_id = p_user_id;

  return jsonb_build_object(
    'cash', coalesce(v_cash, 100),
    'seasonPoints', coalesce(v_season_points, 0),
    'hasConveniencePass', coalesce(v_has_pass, false),
    'businesses', coalesce(v_businesses, '[]'::jsonb)
  );
end;
$$;

-- Security & Privileges
revoke all on function public.empire_handle_new_user_starter_economy() from public, anon, authenticated;
revoke all on function public.empire_init_player_economy(uuid, boolean) from public, anon, authenticated;
revoke all on function public.empire_economy_get_player_state(uuid) from public, anon, authenticated;

grant execute on function public.empire_handle_new_user_starter_economy() to service_role;
grant execute on function public.empire_init_player_economy(uuid, boolean) to service_role;
grant execute on function public.empire_economy_get_player_state(uuid) to service_role;

commit;


-- >>> 202609140007_game_loop_apis.sql <<<
begin;

create table public.game_operation_replays (
  user_id uuid not null references public.users(id) on delete cascade,
  request_id uuid not null,
  operation text not null,
  request_payload text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);
alter table public.game_operation_replays enable row level security;
revoke all on public.game_operation_replays from public, anon, authenticated;
grant select, insert on public.game_operation_replays to service_role;

create function public.empire_business_milestone_multiplier(p_level integer)
returns numeric language sql immutable security invoker set search_path = '' as $$
  select case
    when p_level < 10 then 1 when p_level < 25 then 2
    when p_level < 50 then 4 when p_level < 100 then 8
    when p_level < 150 then 16
    else 16 * power(1.5::numeric, floor((p_level - 100) / 50.0))
  end;
$$;
create function public.empire_business_production(p_base_income bigint, p_level integer)
returns numeric language sql immutable security invoker set search_path = '' as $$
  select case when p_level <= 0 then 0 else
    p_base_income * p_level * power(1.07::numeric, p_level - 1)
      * public.empire_business_milestone_multiplier(p_level) end;
$$;
create function public.empire_business_upgrade_cost(p_base_cost bigint, p_current_level integer)
returns bigint language sql immutable security invoker set search_path = '' as $$
  select case when p_current_level <= 0 then p_base_cost else
    round(p_base_cost * power(1.18::numeric, p_current_level - 1))::bigint end;
$$;

create function public.empire_claim_offline_earnings(p_user_id uuid, p_request_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := now(); v_cap integer; v_earned bigint := 0;
  v_capped boolean := false; v_cash bigint; v_old public.game_operation_replays; v_result jsonb;
begin
  perform 1 from public.users where id=p_user_id for update;
  if not found then return jsonb_build_object('error','PLAYER_NOT_FOUND'); end if;
  if p_request_id is not null then
    select * into v_old from public.game_operation_replays where user_id=p_user_id and request_id=p_request_id;
    if found then
      if v_old.operation <> 'claim_offline_earnings' or v_old.request_payload <> '' then
        return jsonb_build_object('error','IDEMPOTENCY_CONFLICT');
      end if;
      return v_old.result || jsonb_build_object('_replayed',true);
    end if;
  end if;
  select case when exists(select 1 from public.player_entitlements
    where user_id=p_user_id and pass_type='convenience_pass' and is_active and expires_at>v_now)
    then 43200 else 14400 end into v_cap;
  select coalesce(sum(floor(public.empire_business_production(b.base_income,pb.level)
      * least(greatest(0,floor(extract(epoch from (v_now-pb.last_claim_at)))::bigint),v_cap::bigint))),0)::bigint,
    coalesce(bool_or(floor(extract(epoch from (v_now-pb.last_claim_at)))::bigint>=v_cap),false)
    into v_earned,v_capped
  from public.player_businesses pb join public.businesses b on b.id=pb.business_id
  where pb.user_id=p_user_id and pb.level>0;
  if v_earned>0 then
    update public.player_balances set cash=cash+v_earned,updated_at=v_now
      where user_id=p_user_id returning cash into v_cash;
    insert into public.reward_ledger(user_id,delta_cash,delta_season_points,reason,metadata)
      values(p_user_id,v_earned,0,'offline_claim',jsonb_build_object('offlineCapSeconds',v_cap,'isCapped',v_capped));
  else select cash into v_cash from public.player_balances where user_id=p_user_id; end if;
  update public.player_businesses set last_claim_at=v_now,updated_at=v_now where user_id=p_user_id and level>0;
  v_result:=jsonb_build_object('claimedAmount',v_earned,'newBalance',coalesce(v_cash,100),
    'claimedAt',v_now,'isCapped',v_capped);
  if p_request_id is not null then
    insert into public.game_operation_replays values(p_user_id,p_request_id,'claim_offline_earnings','',v_result,v_now);
  end if;
  return v_result;
end; $$;

create function public.empire_upgrade_business(p_user_id uuid,p_business_slug text,p_request_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz:=now(); v_bid uuid; v_name text; v_cost_base bigint; v_income bigint;
  v_level integer; v_cost bigint; v_cash bigint; v_new_level integer; v_cap integer;
  v_accrued bigint:=0; v_total numeric; v_old public.game_operation_replays; v_result jsonb;
begin
  perform 1 from public.users where id=p_user_id for update;
  if not found then return jsonb_build_object('error','PLAYER_NOT_FOUND'); end if;
  if p_request_id is not null then
    select * into v_old from public.game_operation_replays where user_id=p_user_id and request_id=p_request_id;
    if found then
      if v_old.operation<>'upgrade_business' or v_old.request_payload<>coalesce(p_business_slug,'') then
        return jsonb_build_object('error','IDEMPOTENCY_CONFLICT');
      end if;
      return v_old.result || jsonb_build_object('_replayed',true);
    end if;
  end if;
  select id,name,base_cost,base_income into v_bid,v_name,v_cost_base,v_income
    from public.businesses where slug=p_business_slug;
  if not found then
    v_result:=jsonb_build_object('error','BUSINESS_NOT_FOUND');
    if p_request_id is not null then insert into public.game_operation_replays
      values(p_user_id,p_request_id,'upgrade_business',coalesce(p_business_slug,''),v_result,v_now); end if;
    return v_result;
  end if;
  select case when exists(select 1 from public.player_entitlements
    where user_id=p_user_id and pass_type='convenience_pass' and is_active and expires_at>v_now)
    then 43200 else 14400 end into v_cap;
  select coalesce(sum(floor(public.empire_business_production(b.base_income,pb.level)
      * least(greatest(0,floor(extract(epoch from (v_now-pb.last_claim_at)))::bigint),v_cap::bigint))),0)::bigint
    into v_accrued from public.player_businesses pb join public.businesses b on b.id=pb.business_id
    where pb.user_id=p_user_id and pb.level>0;
  if v_accrued>0 then
    update public.player_balances set cash=cash+v_accrued,updated_at=v_now where user_id=p_user_id;
    insert into public.reward_ledger(user_id,delta_cash,delta_season_points,reason,metadata)
      values(p_user_id,v_accrued,0,'offline_claim',jsonb_build_object('settledBeforeUpgrade',true));
  end if;
  update public.player_businesses set last_claim_at=v_now,updated_at=v_now where user_id=p_user_id and level>0;
  insert into public.player_businesses(user_id,business_id,level,last_claim_at)
    values(p_user_id,v_bid,0,v_now) on conflict(user_id,business_id) do nothing;
  select pb.level,bal.cash into v_level,v_cash from public.player_businesses pb
    join public.player_balances bal on bal.user_id=pb.user_id
    where pb.user_id=p_user_id and pb.business_id=v_bid;
  v_cost:=public.empire_business_upgrade_cost(v_cost_base,v_level);
  if v_cash<v_cost then
    v_result:=jsonb_build_object('error','INSUFFICIENT_CASH');
    if p_request_id is not null then insert into public.game_operation_replays
      values(p_user_id,p_request_id,'upgrade_business',coalesce(p_business_slug,''),v_result,v_now); end if;
    return v_result;
  end if;
  v_new_level:=v_level+1; v_cash:=v_cash-v_cost;
  update public.player_balances set cash=v_cash,updated_at=v_now where user_id=p_user_id;
  update public.player_businesses set level=v_new_level,last_claim_at=v_now,updated_at=v_now
    where user_id=p_user_id and business_id=v_bid;
  insert into public.reward_ledger(user_id,delta_cash,delta_season_points,reason,metadata)
    values(p_user_id,-v_cost,0,'business_upgrade',jsonb_build_object('businessSlug',p_business_slug,
      'fromLevel',v_level,'toLevel',v_new_level,'cost',v_cost));
  select coalesce(sum(public.empire_business_production(b.base_income,pb.level)),0) into v_total
    from public.player_businesses pb join public.businesses b on b.id=pb.business_id
    where pb.user_id=p_user_id and pb.level>0;
  v_result:=jsonb_build_object('business',jsonb_build_object('slug',p_business_slug,'name',v_name,
    'level',v_new_level,'baseCost',v_cost_base,'baseIncome',v_income,
    'upgradeCost',public.empire_business_upgrade_cost(v_cost_base,v_new_level),
    'productionPerSecond',public.empire_business_production(v_income,v_new_level),'lastClaimAt',v_now),
    'remainingCash',v_cash,'totalProductionPerSecond',v_total);
  if p_request_id is not null then
    insert into public.game_operation_replays values(p_user_id,p_request_id,'upgrade_business',
      coalesce(p_business_slug,''),v_result,v_now);
  end if;
  return v_result;
end; $$;

create function public.empire_get_game_state(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_bal public.player_balances; v_pass boolean:=false; v_biz jsonb; v_total numeric; v_season jsonb; v_ref jsonb;
begin
  select * into v_bal from public.player_balances where user_id=p_user_id;
  select coalesce(is_active and expires_at>now(),false) into v_pass from public.player_entitlements
    where user_id=p_user_id and pass_type='convenience_pass';
  select jsonb_agg(jsonb_build_object('slug',b.slug,'name',b.name,'level',coalesce(pb.level,0),
    'baseCost',b.base_cost,'baseIncome',b.base_income,
    'upgradeCost',public.empire_business_upgrade_cost(b.base_cost,coalesce(pb.level,0)),
    'productionPerSecond',public.empire_business_production(b.base_income,coalesce(pb.level,0)),
    'lastClaimAt',coalesce(pb.last_claim_at,now())) order by b.sort_order) into v_biz
    from public.businesses b left join public.player_businesses pb on pb.business_id=b.id and pb.user_id=p_user_id;
  select coalesce(sum(public.empire_business_production(b.base_income,pb.level)),0) into v_total
    from public.player_businesses pb join public.businesses b on b.id=pb.business_id
    where pb.user_id=p_user_id and pb.level>0;
  select jsonb_build_object('id',id,'name',name,'status',status,'startsAt',starts_at,
    'endsAt',ends_at,'sruSnapshot',sru_snapshot) into v_season from public.seasons
    where status='active' order by starts_at desc limit 1;
  select jsonb_build_object('referralCode',coalesce(u.referral_code,''),
    'totalInvites',(select count(*) from public.referrals r where r.referrer_user_id=p_user_id),
    'qualifiedCount',(select count(*) from public.referrals r where r.referrer_user_id=p_user_id and r.status='qualified'),
    'totalEarnedPoints',(select coalesce(sum(e.reward_amount),0) from public.referral_events e
      join public.referrals r on r.id=e.referral_id where r.referrer_user_id=p_user_id and e.status='claimed'))
    into v_ref from public.users u where u.id=p_user_id;
  return jsonb_build_object('cash',coalesce(v_bal.cash,100),'seasonPoints',coalesce(v_bal.season_points,0),
    'totalProductionPerSecond',v_total,'offlineCapSeconds',case when coalesce(v_pass,false) then 43200 else 14400 end,
    'hasConveniencePass',coalesce(v_pass,false),'businesses',coalesce(v_biz,'[]'::jsonb),
    'activeSeason',v_season,'referral',v_ref);
end; $$;

create function public.empire_bind_referral(p_user_id uuid,p_referral_code text,p_request_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_ref uuid; v_existing uuid; v_created timestamptz; v_old public.game_operation_replays; v_result jsonb; v_now timestamptz:=now();
begin
  perform 1 from public.users where id=p_user_id for update;
  if not found then return jsonb_build_object('success',false,'error','PLAYER_NOT_FOUND','starterCashBoost',0); end if;
  if p_request_id is not null then
    select * into v_old from public.game_operation_replays where user_id=p_user_id and request_id=p_request_id;
    if found then
      if v_old.operation<>'bind_referral' or v_old.request_payload<>coalesce(p_referral_code,'') then
        return jsonb_build_object('success',false,'error','IDEMPOTENCY_CONFLICT','starterCashBoost',0);
      end if; return v_old.result;
    end if;
  end if;
  select referrer_user_id into v_existing from public.referrals where invitee_user_id=p_user_id;
  if found then
    v_result:=jsonb_build_object('success',false,'error','ALREADY_REFERRED','starterCashBoost',0);
    if p_request_id is not null then insert into public.game_operation_replays
      values(p_user_id,p_request_id,'bind_referral',coalesce(p_referral_code,''),v_result,v_now); end if;
    return v_result;
  end if;
  select id into v_ref from public.users where referral_code=p_referral_code;
  if not found then
    v_result:=jsonb_build_object('success',false,'error','INVALID_CODE','starterCashBoost',0);
    if p_request_id is not null then insert into public.game_operation_replays
      values(p_user_id,p_request_id,'bind_referral',coalesce(p_referral_code,''),v_result,v_now); end if;
    return v_result;
  end if;
  if v_ref=p_user_id then
    v_result:=jsonb_build_object('success',false,'error','SELF_REFERRAL','starterCashBoost',0);
    if p_request_id is not null then insert into public.game_operation_replays
      values(p_user_id,p_request_id,'bind_referral',coalesce(p_referral_code,''),v_result,v_now); end if;
    return v_result;
  end if;
  select created_at into v_created from public.users where id=p_user_id;
  if v_now-v_created>interval '30 minutes' then
    v_result:=jsonb_build_object('success',false,'error','BIND_WINDOW_EXPIRED','starterCashBoost',0);
    if p_request_id is not null then insert into public.game_operation_replays
      values(p_user_id,p_request_id,'bind_referral',coalesce(p_referral_code,''),v_result,v_now); end if;
    return v_result;
  end if;
  insert into public.referrals(invitee_user_id,referrer_user_id,code,status)
    values(p_user_id,v_ref,p_referral_code,'bound');
  update public.player_balances set cash=cash+500,updated_at=v_now where user_id=p_user_id;
  insert into public.reward_ledger(user_id,delta_cash,delta_season_points,reason,metadata)
    values(p_user_id,500,0,'referral_boost_grant',jsonb_build_object('referrerCode',p_referral_code));
  v_result:=jsonb_build_object('success',true,'starterCashBoost',500);
  if p_request_id is not null then insert into public.game_operation_replays
    values(p_user_id,p_request_id,'bind_referral',coalesce(p_referral_code,''),v_result,v_now); end if;
  return v_result;
end; $$;

create function public.empire_get_referral_status(p_user_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with stats as (
    select count(*) as total, count(*) filter(where r.status='qualified') as qualified
    from public.referrals r where r.referrer_user_id=p_user_id
  )
  select jsonb_build_object('referralCode',coalesce(u.referral_code,''),
    'deepLink','https://t.me/EmpireBot?start=ref_'||coalesce(u.referral_code,''),
    'totalInvites',stats.total,'qualifiedCount',stats.qualified,
    'totalEarnedPoints',(select coalesce(sum(e.reward_amount),0) from public.referral_events e
      join public.referrals r on r.id=e.referral_id where r.referrer_user_id=p_user_id and e.status='claimed'),
    'unlockedBadges',to_jsonb(array_remove(array[
      case when stats.qualified>=1 then 'recruiter' end,
      case when stats.qualified>=5 then 'networker' end,
      case when stats.qualified>=10 then 'influencer' end,
      case when stats.qualified>=25 then 'ambassador' end,
      case when stats.qualified>=50 then 'whale' end
    ],null))) from public.users u cross join stats where u.id=p_user_id;
$$;

create function public.empire_get_active_missions(p_user_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',mi.id,'key',m.key,'difficulty',m.difficulty,
    'title',m.title,'description',m.description,'progress',mi.progress,'target',mi.target,'status',mi.status,
    'rewardPoints',round(m.reward_sru_multiplier*s.sru_snapshot)::integer,'assignedDate',mi.assigned_date::text,
    'claimedAt',mi.claimed_at) order by m.difficulty,m.key),'[]'::jsonb)
  from public.mission_instances mi join public.missions m on m.id=mi.mission_id
    join public.seasons s on s.id=mi.season_id
  where mi.user_id=p_user_id and mi.assigned_date=current_date and mi.status in('in_progress','completed');
$$;

create function public.empire_claim_mission(p_user_id uuid,p_mission_instance_id uuid,p_request_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_status text; v_reward integer; v_key text; v_sid uuid; v_points bigint;
  v_old public.game_operation_replays; v_result jsonb; v_now timestamptz:=now();
begin
  perform 1 from public.users where id=p_user_id for update;
  if not found then return jsonb_build_object('error','PLAYER_NOT_FOUND'); end if;
  if p_request_id is not null then
    select * into v_old from public.game_operation_replays where user_id=p_user_id and request_id=p_request_id;
    if found then
      if v_old.operation<>'claim_mission' or v_old.request_payload<>coalesce(p_mission_instance_id::text,'') then
        return jsonb_build_object('error','IDEMPOTENCY_CONFLICT'); end if;
      return v_old.result;
    end if;
  end if;
  select mi.status,round(m.reward_sru_multiplier*s.sru_snapshot)::integer,m.key,mi.season_id
    into v_status,v_reward,v_key,v_sid from public.mission_instances mi
    join public.missions m on m.id=mi.mission_id join public.seasons s on s.id=mi.season_id
    where mi.id=p_mission_instance_id and mi.user_id=p_user_id;
  if not found then v_result:=jsonb_build_object('error','MISSION_NOT_FOUND');
  elsif v_status='claimed' then v_result:=jsonb_build_object('error','ALREADY_CLAIMED');
  elsif v_status<>'completed' then v_result:=jsonb_build_object('error','NOT_COMPLETED');
  else
    update public.mission_instances set status='claimed',claimed_at=v_now
      where id=p_mission_instance_id and user_id=p_user_id;
    update public.player_balances set season_points=season_points+v_reward,updated_at=v_now
      where user_id=p_user_id returning season_points into v_points;
    insert into public.season_scores(season_id,user_id,points,mission_points,referral_points,updated_at)
      values(v_sid,p_user_id,v_reward,v_reward,0,v_now) on conflict(season_id,user_id) do update
      set points=public.season_scores.points+excluded.points,
        mission_points=public.season_scores.mission_points+excluded.mission_points,updated_at=excluded.updated_at;
    insert into public.reward_ledger(user_id,delta_cash,delta_season_points,reason,metadata)
      values(p_user_id,0,v_reward,'mission_claim',jsonb_build_object('missionKey',v_key,'instanceId',p_mission_instance_id));
    v_result:=jsonb_build_object('missionInstanceId',p_mission_instance_id,'rewardPoints',v_reward,
      'newSeasonPoints',v_points,'claimedAt',v_now);
  end if;
  if p_request_id is not null then insert into public.game_operation_replays
    values(p_user_id,p_request_id,'claim_mission',coalesce(p_mission_instance_id::text,''),v_result,v_now); end if;
  return v_result;
end; $$;

create function public.empire_get_streak(p_user_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('currentStreak',coalesce(s.current_streak,0),
    'longestStreak',coalesce(s.longest_streak,0),'lastClaimDate',s.last_claim_date::text,
    'canClaimToday',coalesce(s.last_claim_date<>current_date,true),
    'todayRewardPoints',50+coalesce(s.current_streak,0)*10,
    'isCycleBonusToday',false)
  from (select 1) seed left join public.player_streaks s on s.user_id=p_user_id;
$$;

revoke all on function public.empire_business_milestone_multiplier(integer) from public,anon,authenticated;
revoke all on function public.empire_business_production(bigint,integer) from public,anon,authenticated;
revoke all on function public.empire_business_upgrade_cost(bigint,integer) from public,anon,authenticated;
revoke all on function public.empire_claim_offline_earnings(uuid,uuid) from public,anon,authenticated;
revoke all on function public.empire_upgrade_business(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.empire_get_game_state(uuid) from public,anon,authenticated;
revoke all on function public.empire_bind_referral(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.empire_get_referral_status(uuid) from public,anon,authenticated;
revoke all on function public.empire_get_active_missions(uuid) from public,anon,authenticated;
revoke all on function public.empire_claim_mission(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.empire_get_streak(uuid) from public,anon,authenticated;
grant execute on function public.empire_claim_offline_earnings(uuid,uuid) to service_role;
grant execute on function public.empire_upgrade_business(uuid,text,uuid) to service_role;
grant execute on function public.empire_get_game_state(uuid) to service_role;
grant execute on function public.empire_bind_referral(uuid,text,uuid) to service_role;
grant execute on function public.empire_get_referral_status(uuid) to service_role;
grant execute on function public.empire_get_active_missions(uuid) to service_role;
grant execute on function public.empire_claim_mission(uuid,uuid,uuid) to service_role;
grant execute on function public.empire_get_streak(uuid) to service_role;
commit;


-- >>> 202609140008_anti_fraud.sql <<<
-- =============================================================================
-- Migration: 202609140008_anti_fraud.sql
-- Description: Anti-Fraud Engine, Quarantined Rewards, RBAC & Admin Review System
-- Requirements: R2, R3 (Security, Auditability, Atomic Ledger Integration)
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Extend Admin Audit Logs Check Constraints
-- -----------------------------------------------------------------------------
alter table public.admin_audit_logs drop constraint if exists admin_audit_logs_action_check;
alter table public.admin_audit_logs add constraint admin_audit_logs_action_check check (
  action in (
    'update_config', 'set_feature_flag', 'freeze_season', 'ban_user', 'refund_purchase',
    'fraud_flag_created', 'fraud_flag_reviewed', 'fraud_flag_dismissed',
    'reward_frozen', 'reward_approved', 'reward_rejected',
    'admin_role_assigned', 'admin_role_revoked'
  )
);

alter table public.admin_audit_logs drop constraint if exists admin_audit_logs_target_type_check;
alter table public.admin_audit_logs add constraint admin_audit_logs_target_type_check check (
  target_type in (
    'economy_config', 'feature_flag', 'season', 'user', 'purchase',
    'fraud_flag', 'frozen_reward', 'admin_role'
  )
);

alter table public.admin_audit_logs drop constraint if exists admin_audit_logs_reason_check;
alter table public.admin_audit_logs add constraint admin_audit_logs_reason_check check (
  reason is null or length(reason) <= 1024
);

-- -----------------------------------------------------------------------------
-- 2. Admin Roles Table (RBAC)
-- -----------------------------------------------------------------------------
create table if not exists public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('admin', 'superadmin', 'auditor')),
  assigned_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, role)
);
create index if not exists admin_roles_user_id_idx on public.admin_roles(user_id);
create index if not exists admin_roles_role_idx on public.admin_roles(role);

-- -----------------------------------------------------------------------------
-- 3. Fraud Flags Table
-- -----------------------------------------------------------------------------
create table if not exists public.fraud_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  target_type text not null check (target_type in ('user', 'reward', 'transaction', 'referral', 'session')),
  target_id text not null,
  risk_score integer not null check (risk_score >= 0 and risk_score <= 100),
  reason_codes text[] not null check (array_length(reason_codes, 1) > 0),
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'pending' check (status in ('pending', 'investigating', 'resolved', 'dismissed')),
  metadata jsonb not null default '{}'::jsonb,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  resolution_notes text check (resolution_notes is null or length(resolution_notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fraud_flags_user_id_idx on public.fraud_flags(user_id);
create index if not exists fraud_flags_status_idx on public.fraud_flags(status);
create index if not exists fraud_flags_risk_score_idx on public.fraud_flags(risk_score desc);
create index if not exists fraud_flags_created_at_idx on public.fraud_flags(created_at desc);
create index if not exists fraud_flags_target_idx on public.fraud_flags(target_type, target_id);

-- -----------------------------------------------------------------------------
-- 4. Frozen Rewards Table (Reward Quarantine)
-- -----------------------------------------------------------------------------
create table if not exists public.frozen_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  fraud_flag_id uuid references public.fraud_flags(id) on delete set null,
  reward_type text not null check (reward_type in ('cash_claim', 'mission_reward', 'referral_bonus', 'streak_bonus', 'airdrop')),
  amount_cash bigint not null default 0 check (amount_cash >= 0),
  amount_season_points bigint not null default 0 check (amount_season_points >= 0),
  status text not null default 'frozen' check (status in ('frozen', 'approved', 'rejected')),
  freeze_reason text not null check (length(freeze_reason) between 1 and 256),
  source_ref_id text,
  metadata jsonb not null default '{}'::jsonb,
  frozen_at timestamptz not null default now(),
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text check (review_notes is null or length(review_notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (amount_cash > 0 or amount_season_points > 0),
  check ((status = 'frozen' and reviewed_at is null) or (status in ('approved', 'rejected') and reviewed_at is not null))
);
create index if not exists frozen_rewards_user_id_idx on public.frozen_rewards(user_id);
create index if not exists frozen_rewards_status_idx on public.frozen_rewards(status);
create index if not exists frozen_rewards_frozen_at_idx on public.frozen_rewards(frozen_at desc);
create index if not exists frozen_rewards_flag_id_idx on public.frozen_rewards(fraud_flag_id);

-- -----------------------------------------------------------------------------
-- 5. Row Level Security & Service Role Grants
-- -----------------------------------------------------------------------------
alter table public.admin_roles enable row level security;
alter table public.fraud_flags enable row level security;
alter table public.frozen_rewards enable row level security;

revoke all on public.admin_roles, public.fraud_flags, public.frozen_rewards from public, anon, authenticated;
grant select, insert, update, delete on public.admin_roles, public.fraud_flags, public.frozen_rewards to service_role;

-- -----------------------------------------------------------------------------
-- 6. Stored Procedures / RPC Functions
-- -----------------------------------------------------------------------------

-- 6.1 RBAC Role Verification
create or replace function public.empire_admin_check_role(
  p_user_id uuid,
  p_required_role text default 'admin'
) returns boolean
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_has_role boolean := false;
begin
  if p_user_id is null then
    return false;
  end if;

  select exists (
    select 1 from public.admin_roles
    where user_id = p_user_id
      and (role = p_required_role or role = 'superadmin' or (p_required_role = 'auditor' and role in ('admin', 'superadmin', 'auditor')))
  ) into v_has_role;

  return v_has_role;
end;
$$;

-- 6.2 Fraud Flag Creation
create or replace function public.empire_fraud_create_flag(
  p_user_id uuid,
  p_target_type text,
  p_target_id text,
  p_risk_score integer,
  p_reason_codes text[],
  p_severity text default null,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_flag_id uuid := gen_random_uuid();
  v_severity text := p_severity;
  v_now timestamptz := now();
begin
  if v_severity is null or v_severity not in ('low', 'medium', 'high', 'critical') then
    if p_risk_score >= 85 then
      v_severity := 'critical';
    elsif p_risk_score >= 60 then
      v_severity := 'high';
    elsif p_risk_score >= 30 then
      v_severity := 'medium';
    else
      v_severity := 'low';
    end if;
  end if;

  if p_reason_codes is null or array_length(p_reason_codes, 1) is null or array_length(p_reason_codes, 1) = 0 then
    p_reason_codes := array['UNKNOWN_RISK'];
  end if;

  insert into public.fraud_flags (
    id, user_id, target_type, target_id, risk_score, reason_codes, severity, status, metadata, created_at, updated_at
  ) values (
    v_flag_id, p_user_id, p_target_type, p_target_id, p_risk_score, p_reason_codes, v_severity, 'pending', coalesce(p_metadata, '{}'::jsonb), v_now, v_now
  );

  update public.users
  set risk_score = greatest(risk_score, p_risk_score), updated_at = v_now
  where id = p_user_id;

  insert into public.analytics_events (
    user_id, event_name, properties, created_at
  ) values (
    p_user_id,
    'fraud_flag_created',
    jsonb_build_object('flagId', v_flag_id, 'riskScore', p_risk_score, 'severity', v_severity, 'reasonCodes', p_reason_codes, 'targetType', p_target_type, 'targetId', p_target_id),
    v_now
  );

  return jsonb_build_object(
    'success', true,
    'flagId', v_flag_id,
    'riskScore', p_risk_score,
    'severity', v_severity,
    'status', 'pending',
    'createdAt', v_now
  );
end;
$$;

-- 6.3 Reward Freezing (Quarantine)
create or replace function public.empire_fraud_freeze_reward(
  p_user_id uuid,
  p_reward_type text,
  p_amount_cash bigint,
  p_amount_season_points bigint,
  p_freeze_reason text,
  p_fraud_flag_id uuid default null,
  p_source_ref_id text default null,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_frozen_id uuid := gen_random_uuid();
  v_now timestamptz := now();
begin
  if (coalesce(p_amount_cash, 0) <= 0 and coalesce(p_amount_season_points, 0) <= 0) then
    return jsonb_build_object('error', 'INVALID_REWARD_AMOUNT');
  end if;

  insert into public.frozen_rewards (
    id, user_id, fraud_flag_id, reward_type, amount_cash, amount_season_points, status, freeze_reason, source_ref_id, metadata, frozen_at, created_at, updated_at
  ) values (
    v_frozen_id, p_user_id, p_fraud_flag_id, p_reward_type, coalesce(p_amount_cash, 0), coalesce(p_amount_season_points, 0), 'frozen', p_freeze_reason, p_source_ref_id, coalesce(p_metadata, '{}'::jsonb), v_now, v_now, v_now
  );

  insert into public.analytics_events (
    user_id, event_name, properties, created_at
  ) values (
    p_user_id,
    'reward_frozen',
    jsonb_build_object('frozenRewardId', v_frozen_id, 'rewardType', p_reward_type, 'amountCash', coalesce(p_amount_cash, 0), 'amountSeasonPoints', coalesce(p_amount_season_points, 0), 'reason', p_freeze_reason),
    v_now
  );

  insert into public.admin_audit_logs (
    admin_user_id, action, target_type, target_key, old_value, new_value, reason, created_at
  ) values (
    null,
    'reward_frozen',
    'frozen_reward',
    v_frozen_id::text,
    null,
    jsonb_build_object('userId', p_user_id, 'amountCash', coalesce(p_amount_cash, 0), 'amountSeasonPoints', coalesce(p_amount_season_points, 0), 'rewardType', p_reward_type),
    p_freeze_reason,
    v_now
  );

  return jsonb_build_object(
    'success', true,
    'frozenRewardId', v_frozen_id,
    'status', 'frozen',
    'amountCash', coalesce(p_amount_cash, 0),
    'amountSeasonPoints', coalesce(p_amount_season_points, 0),
    'frozenAt', v_now
  );
end;
$$;

-- 6.4 Admin Review Reward (Atomic Balance Credit & Audit)
create or replace function public.empire_admin_review_reward(
  p_frozen_reward_id uuid,
  p_admin_user_id uuid,
  p_decision text,
  p_notes text
) returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_frozen public.frozen_rewards;
  v_now timestamptz := now();
  v_new_cash bigint;
  v_new_season_points bigint;
  v_idempotency_key text;
  v_active_season_id uuid;
begin
  if not public.empire_admin_check_role(p_admin_user_id, 'admin') then
    return jsonb_build_object('error', 'FORBIDDEN');
  end if;

  if p_decision not in ('approve', 'reject') then
    return jsonb_build_object('error', 'INVALID_DECISION');
  end if;

  if p_notes is null or length(trim(p_notes)) = 0 then
    return jsonb_build_object('error', 'REASONING_REQUIRED');
  end if;

  select * into v_frozen
  from public.frozen_rewards
  where id = p_frozen_reward_id
  for update;

  if not found then
    return jsonb_build_object('error', 'REWARD_NOT_FOUND');
  end if;

  if v_frozen.status <> 'frozen' then
    return jsonb_build_object('error', 'ALREADY_REVIEWED', 'currentStatus', v_frozen.status);
  end if;

  if p_decision = 'approve' then
    update public.frozen_rewards set
      status = 'approved',
      reviewed_by = p_admin_user_id,
      reviewed_at = v_now,
      review_notes = p_notes,
      updated_at = v_now
    where id = p_frozen_reward_id;

    update public.player_balances set
      cash = cash + v_frozen.amount_cash,
      season_points = season_points + v_frozen.amount_season_points,
      updated_at = v_now
    where user_id = v_frozen.user_id
    returning cash, season_points into v_new_cash, v_new_season_points;

    if not found then
      insert into public.player_balances (user_id, cash, season_points, updated_at)
      values (v_frozen.user_id, 100 + v_frozen.amount_cash, v_frozen.amount_season_points, v_now)
      returning cash, season_points into v_new_cash, v_new_season_points;
    end if;

    if v_frozen.amount_season_points > 0 then
      select id into v_active_season_id
      from public.seasons
      where status = 'active'
      order by starts_at desc limit 1;

      if v_active_season_id is not null then
        insert into public.season_scores (season_id, user_id, points, updated_at)
        values (v_active_season_id, v_frozen.user_id, v_frozen.amount_season_points, v_now)
        on conflict (season_id, user_id) do update set
          points = season_scores.points + excluded.points,
          updated_at = excluded.updated_at;
      end if;
    end if;

    v_idempotency_key := encode(sha256(('unfreeze_approval_' || p_frozen_reward_id::text)::bytea), 'hex');
    insert into public.reward_ledger (
      user_id, delta_cash, delta_season_points, reason, idempotency_key, metadata, created_at
    ) values (
      v_frozen.user_id,
      v_frozen.amount_cash,
      v_frozen.amount_season_points,
      'reward_unfrozen_approved',
      v_idempotency_key,
      jsonb_build_object('frozenRewardId', p_frozen_reward_id, 'approvedBy', p_admin_user_id, 'notes', p_notes),
      v_now
    )
    on conflict (idempotency_key) do nothing;

    if v_frozen.fraud_flag_id is not null then
      update public.fraud_flags set
        status = 'resolved',
        reviewed_by = p_admin_user_id,
        reviewed_at = v_now,
        resolution_notes = left('Approved via reward review: ' || p_notes, 1000),
        updated_at = v_now
      where id = v_frozen.fraud_flag_id and status in ('pending', 'investigating');
    end if;

    insert into public.admin_audit_logs (
      admin_user_id, action, target_type, target_key, old_value, new_value, reason, created_at
    ) values (
      p_admin_user_id,
      'reward_approved',
      'frozen_reward',
      p_frozen_reward_id::text,
      jsonb_build_object('status', 'frozen'),
      jsonb_build_object('status', 'approved', 'creditedCash', v_frozen.amount_cash, 'creditedSeasonPoints', v_frozen.amount_season_points),
      left(p_notes, 1024),
      v_now
    );

    return jsonb_build_object(
      'success', true,
      'decision', 'approved',
      'frozenRewardId', p_frozen_reward_id,
      'creditedCash', v_frozen.amount_cash,
      'creditedSeasonPoints', v_frozen.amount_season_points,
      'newCash', v_new_cash,
      'newSeasonPoints', v_new_season_points,
      'reviewedAt', v_now
    );

  else -- reject
    update public.frozen_rewards set
      status = 'rejected',
      reviewed_by = p_admin_user_id,
      reviewed_at = v_now,
      review_notes = p_notes,
      updated_at = v_now
    where id = p_frozen_reward_id;

    if v_frozen.fraud_flag_id is not null then
      update public.fraud_flags set
        status = 'resolved',
        reviewed_by = p_admin_user_id,
        reviewed_at = v_now,
        resolution_notes = left('Rejected via reward review: ' || p_notes, 1000),
        updated_at = v_now
      where id = v_frozen.fraud_flag_id and status in ('pending', 'investigating');
    end if;

    insert into public.admin_audit_logs (
      admin_user_id, action, target_type, target_key, old_value, new_value, reason, created_at
    ) values (
      p_admin_user_id,
      'reward_rejected',
      'frozen_reward',
      p_frozen_reward_id::text,
      jsonb_build_object('status', 'frozen'),
      jsonb_build_object('status', 'rejected', 'canceledCash', v_frozen.amount_cash, 'canceledSeasonPoints', v_frozen.amount_season_points),
      left(p_notes, 1024),
      v_now
    );

    return jsonb_build_object(
      'success', true,
      'decision', 'rejected',
      'frozenRewardId', p_frozen_reward_id,
      'canceledCash', v_frozen.amount_cash,
      'canceledSeasonPoints', v_frozen.amount_season_points,
      'reviewedAt', v_now
    );
  end if;
end;
$$;

-- 6.5 Admin Review Flag
create or replace function public.empire_admin_review_flag(
  p_flag_id uuid,
  p_admin_user_id uuid,
  p_decision text,
  p_notes text
) returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_flag public.fraud_flags;
  v_new_status text;
  v_now timestamptz := now();
begin
  if not public.empire_admin_check_role(p_admin_user_id, 'admin') then
    return jsonb_build_object('error', 'FORBIDDEN');
  end if;

  if p_decision = 'resolve' then
    v_new_status := 'resolved';
  elsif p_decision = 'dismiss' then
    v_new_status := 'dismissed';
  elsif p_decision = 'investigate' then
    v_new_status := 'investigating';
  else
    return jsonb_build_object('error', 'INVALID_DECISION');
  end if;

  select * into v_flag from public.fraud_flags where id = p_flag_id for update;
  if not found then
    return jsonb_build_object('error', 'FLAG_NOT_FOUND');
  end if;

  update public.fraud_flags set
    status = v_new_status,
    reviewed_by = p_admin_user_id,
    reviewed_at = v_now,
    resolution_notes = left(p_notes, 1000),
    updated_at = v_now
  where id = p_flag_id;

  insert into public.admin_audit_logs (
    admin_user_id, action, target_type, target_key, old_value, new_value, reason, created_at
  ) values (
    p_admin_user_id,
    case when v_new_status = 'dismissed' then 'fraud_flag_dismissed' else 'fraud_flag_reviewed' end,
    'fraud_flag',
    p_flag_id::text,
    jsonb_build_object('status', v_flag.status),
    jsonb_build_object('status', v_new_status),
    left(p_notes, 1024),
    v_now
  );

  return jsonb_build_object(
    'success', true,
    'flagId', p_flag_id,
    'status', v_new_status,
    'reviewedAt', v_now
  );
end;
$$;

-- 6.6 Admin Get Fraud Flags (Paginated)
create or replace function public.empire_admin_get_fraud_flags(
  p_status text default null,
  p_user_id uuid default null,
  p_severity text default null,
  p_limit integer default 50,
  p_offset integer default 0
) returns jsonb
language plpgsql
stable
security definer
set search_path = 'public'
as $$
declare
  v_flags jsonb;
  v_total integer;
begin
  select count(*)::integer into v_total
  from public.fraud_flags f
  where (p_status is null or f.status = p_status)
    and (p_user_id is null or f.user_id = p_user_id)
    and (p_severity is null or f.severity = p_severity);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', f.id,
      'userId', f.user_id,
      'targetType', f.target_type,
      'targetId', f.target_id,
      'riskScore', f.risk_score,
      'reasonCodes', f.reason_codes,
      'severity', f.severity,
      'status', f.status,
      'metadata', f.metadata,
      'reviewedBy', f.reviewed_by,
      'reviewedAt', f.reviewed_at,
      'resolutionNotes', f.resolution_notes,
      'createdAt', f.created_at,
      'updatedAt', f.updated_at,
      'user', jsonb_build_object(
        'telegramId', u.telegram_user_id::text,
        'username', u.username,
        'firstName', u.first_name,
        'status', u.status,
        'userRiskScore', u.risk_score
      )
    ) order by f.created_at desc
  ), '[]'::jsonb) into v_flags
  from (
    select * from public.fraud_flags
    where (p_status is null or status = p_status)
      and (p_user_id is null or user_id = p_user_id)
      and (p_severity is null or severity = p_severity)
    order by created_at desc
    limit coalesce(p_limit, 50)
    offset coalesce(p_offset, 0)
  ) f
  join public.users u on u.id = f.user_id;

  return jsonb_build_object(
    'flags', v_flags,
    'total', v_total,
    'limit', coalesce(p_limit, 50),
    'offset', coalesce(p_offset, 0)
  );
end;
$$;

-- 6.7 Admin Get Frozen Rewards (Paginated)
create or replace function public.empire_admin_get_frozen_rewards(
  p_status text default 'frozen',
  p_user_id uuid default null,
  p_limit integer default 50,
  p_offset integer default 0
) returns jsonb
language plpgsql
stable
security definer
set search_path = 'public'
as $$
declare
  v_rewards jsonb;
  v_total integer;
begin
  select count(*)::integer into v_total
  from public.frozen_rewards fr
  where (p_status is null or fr.status = p_status)
    and (p_user_id is null or fr.user_id = p_user_id);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', fr.id,
      'userId', fr.user_id,
      'fraudFlagId', fr.fraud_flag_id,
      'rewardType', fr.reward_type,
      'amountCash', fr.amount_cash,
      'amountSeasonPoints', fr.amount_season_points,
      'status', fr.status,
      'freezeReason', fr.freeze_reason,
      'sourceRefId', fr.source_ref_id,
      'metadata', fr.metadata,
      'frozenAt', fr.frozen_at,
      'reviewedBy', fr.reviewed_by,
      'reviewedAt', fr.reviewed_at,
      'reviewNotes', fr.review_notes,
      'user', jsonb_build_object(
        'telegramId', u.telegram_user_id::text,
        'username', u.username,
        'firstName', u.first_name,
        'currentCash', pb.cash,
        'currentSeasonPoints', pb.season_points
      )
    ) order by fr.frozen_at desc
  ), '[]'::jsonb) into v_rewards
  from (
    select * from public.frozen_rewards
    where (p_status is null or status = p_status)
      and (p_user_id is null or user_id = p_user_id)
    order by frozen_at desc
    limit coalesce(p_limit, 50)
    offset coalesce(p_offset, 0)
  ) fr
  join public.users u on u.id = fr.user_id
  left join public.player_balances pb on pb.user_id = fr.user_id;

  return jsonb_build_object(
    'rewards', v_rewards,
    'total', v_total,
    'limit', coalesce(p_limit, 50),
    'offset', coalesce(p_offset, 0)
  );
end;
$$;

-- 6.8 Role Assignment Helper
create or replace function public.empire_admin_assign_role(
  p_target_user_id uuid,
  p_role text,
  p_assigned_by uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_now timestamptz := now();
begin
  if p_role not in ('admin', 'superadmin', 'auditor') then
    return jsonb_build_object('error', 'INVALID_ROLE');
  end if;

  if p_assigned_by is not null and not public.empire_admin_check_role(p_assigned_by, 'superadmin') then
    return jsonb_build_object('error', 'FORBIDDEN_SUPERADMIN_REQUIRED');
  end if;

  insert into public.admin_roles (user_id, role, assigned_by, created_at, updated_at)
  values (p_target_user_id, p_role, p_assigned_by, v_now, v_now)
  on conflict (user_id, role) do update set updated_at = v_now;

  insert into public.admin_audit_logs (
    admin_user_id, action, target_type, target_key, old_value, new_value, reason, created_at
  ) values (
    p_assigned_by,
    'admin_role_assigned',
    'admin_role',
    p_target_user_id::text,
    null,
    jsonb_build_object('role', p_role),
    'Role assigned by ' || coalesce(p_assigned_by::text, 'system'),
    v_now
  );

  return jsonb_build_object(
    'success', true,
    'userId', p_target_user_id,
    'role', p_role
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Revocations & Grants
-- -----------------------------------------------------------------------------
revoke all on function public.empire_admin_check_role(uuid, text) from public, anon, authenticated;
revoke all on function public.empire_fraud_create_flag(uuid, text, text, integer, text[], text, jsonb) from public, anon, authenticated;
revoke all on function public.empire_fraud_freeze_reward(uuid, text, bigint, bigint, text, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.empire_admin_review_reward(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.empire_admin_review_flag(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.empire_admin_get_fraud_flags(text, uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.empire_admin_get_frozen_rewards(text, uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.empire_admin_assign_role(uuid, text, uuid) from public, anon, authenticated;

grant execute on function public.empire_admin_check_role(uuid, text) to service_role;
grant execute on function public.empire_fraud_create_flag(uuid, text, text, integer, text[], text, jsonb) to service_role;
grant execute on function public.empire_fraud_freeze_reward(uuid, text, bigint, bigint, text, uuid, text, jsonb) to service_role;
grant execute on function public.empire_admin_review_reward(uuid, uuid, text, text) to service_role;
grant execute on function public.empire_admin_review_flag(uuid, uuid, text, text) to service_role;
grant execute on function public.empire_admin_get_fraud_flags(text, uuid, text, integer, integer) to service_role;
grant execute on function public.empire_admin_get_frozen_rewards(text, uuid, integer, integer) to service_role;
grant execute on function public.empire_admin_assign_role(uuid, text, uuid) to service_role;

commit;


-- >>> 202609140009_missions_and_launch.sql <<<
-- =============================================================================
-- Migration: 202609140009_missions_and_launch.sql
-- Description: Mission Pool Assignment, Daily Streak Claiming, Qualified Referral Milestones & Concurrency Optimization
-- Requirements: R1, R2, R3, R4
-- =============================================================================

begin;

-- Migrations 3 and 4 are the canonical mission/referral schema. This migration
-- deliberately adds no compatibility columns or synchronization triggers.

-- -----------------------------------------------------------------------------
-- 4. Composite Indexes for Concurrency & High-Volume Querying
-- -----------------------------------------------------------------------------
create index if not exists idx_mission_instances_player_date on public.mission_instances(user_id, assigned_date);
create index if not exists idx_player_streaks_user_date on public.player_streaks(user_id, last_claim_date);
create index if not exists idx_referrals_invitee_status on public.referrals(invitee_user_id, status);
create index if not exists idx_player_balances_user_id on public.player_balances(user_id);
create index if not exists idx_mission_instances_user_status on public.mission_instances(user_id, status);
create index if not exists idx_referrals_referrer_status on public.referrals(referrer_user_id, status);
create index if not exists idx_referral_events_referral_status on public.referral_events(referral_id, status);

-- -----------------------------------------------------------------------------
-- 5. Stored Procedure: empire_assign_daily_missions
-- -----------------------------------------------------------------------------
create or replace function public.empire_assign_daily_missions(
  p_user_id uuid,
  p_target_date date default current_date
)
returns jsonb as $$
declare
  v_season_id uuid;
  v_week_monday date;
  v_count integer;
  v_easy_id uuid;
  v_normal_id uuid;
  v_hard_id uuid;
  v_weekly_id uuid;
  v_easy_target integer;
  v_normal_target integer;
  v_hard_target integer;
  v_weekly_target integer;
begin
  select id into v_season_id from public.seasons where status = 'active' order by created_at desc limit 1;
  if v_season_id is null then
    select id into v_season_id from public.seasons order by created_at desc limit 1;
  end if;

  -- Check if daily missions already assigned for p_target_date
  select count(*) into v_count
  from public.mission_instances mi
  join public.missions m on m.id = mi.mission_id
  where mi.user_id = p_user_id
    and mi.assigned_date = p_target_date
    and m.difficulty in ('easy', 'normal', 'hard');

  if v_count = 0 then
    -- Pick 1 Easy
    select id, target into v_easy_id, v_easy_target
    from public.missions
    where difficulty = 'easy' and enabled = true
    order by id
    limit 1 offset (('x' || substr(md5(p_user_id::text || ':' || p_target_date::text || ':easy'), 1, 7))::bit(28)::integer % 3);

    if v_easy_id is not null then
      insert into public.mission_instances (user_id, season_id, mission_id, progress, target, status, assigned_date)
      values (p_user_id, v_season_id, v_easy_id, 0, v_easy_target, 'in_progress', p_target_date)
      on conflict (user_id, mission_id, assigned_date) do nothing;
    end if;

    -- Pick 1 Normal
    select id, target into v_normal_id, v_normal_target
    from public.missions
    where difficulty = 'normal' and enabled = true
    order by id
    limit 1 offset (('x' || substr(md5(p_user_id::text || ':' || p_target_date::text || ':normal'), 1, 7))::bit(28)::integer % 3);

    if v_normal_id is not null then
      insert into public.mission_instances (user_id, season_id, mission_id, progress, target, status, assigned_date)
      values (p_user_id, v_season_id, v_normal_id, 0, v_normal_target, 'in_progress', p_target_date)
      on conflict (user_id, mission_id, assigned_date) do nothing;
    end if;

    -- Pick 1 Hard
    select id, target into v_hard_id, v_hard_target
    from public.missions
    where difficulty = 'hard' and enabled = true
    order by id
    limit 1 offset (('x' || substr(md5(p_user_id::text || ':' || p_target_date::text || ':hard'), 1, 7))::bit(28)::integer % 2);

    if v_hard_id is not null then
      insert into public.mission_instances (user_id, season_id, mission_id, progress, target, status, assigned_date)
      values (p_user_id, v_season_id, v_hard_id, 0, v_hard_target, 'in_progress', p_target_date)
      on conflict (user_id, mission_id, assigned_date) do nothing;
    end if;
  end if;

  -- Weekly mission assignment
  v_week_monday := date_trunc('week', p_target_date)::date;

  select count(*) into v_count
  from public.mission_instances mi
  join public.missions m on m.id = mi.mission_id
  where mi.user_id = p_user_id
    and mi.assigned_date = v_week_monday
    and m.difficulty = 'weekly';

  if v_count = 0 then
    select id, target into v_weekly_id, v_weekly_target
    from public.missions
    where difficulty = 'weekly' and enabled = true
    order by id
    limit 1;

    if v_weekly_id is not null then
      insert into public.mission_instances (user_id, season_id, mission_id, progress, target, status, assigned_date)
      values (p_user_id, v_season_id, v_weekly_id, 0, v_weekly_target, 'in_progress', v_week_monday)
      on conflict (user_id, mission_id, assigned_date) do nothing;
    end if;
  end if;

  return jsonb_build_object('success', true, 'assignedDate', p_target_date, 'weekMonday', v_week_monday);
end;
$$ language plpgsql security definer set search_path = '';

-- -----------------------------------------------------------------------------
-- 6. Stored Procedure: empire_increment_mission_progress
-- -----------------------------------------------------------------------------
create or replace function public.empire_increment_mission_progress(
  p_user_id uuid,
  p_action_key text,
  p_increment integer default 1
)
returns jsonb as $$
declare
  v_rec record;
  v_new_progress integer;
  v_new_status text;
  v_completed_count integer := 0;
  v_updated_count integer := 0;
begin
  if p_increment <= 0 then
    return jsonb_build_object('updated', 0, 'completed', 0);
  end if;

  for v_rec in
    select mi.id, mi.progress, mi.target, mi.status, m.key, m.difficulty
    from public.mission_instances mi
    join public.missions m on m.id = mi.mission_id
    where mi.user_id = p_user_id
      and mi.status = 'in_progress'
      and (
        (p_action_key = 'claim_cash' and m.key in ('claim_cash_2', 'claim_cash_5')) or
        (p_action_key = 'claim_offline_4h' and m.key = 'claim_offline_4h') or
        (p_action_key = 'upgrade_any' and m.key in ('upgrade_any_3', 'upgrade_any_10')) or
        (p_action_key = 'reach_milestone' and m.key = 'reach_milestone') or
        (p_action_key = 'upgrade_factory_tier' and m.key = 'upgrade_factory_tier') or
        (p_action_key = 'view_friends' and m.key = 'view_friends') or
        (p_action_key = 'daily_mission_completed' and m.key = 'weekly_complete_15_dailies')
      )
    for update of mi
  loop
    v_new_progress := least(v_rec.target, v_rec.progress + p_increment);
    if v_new_progress >= v_rec.target then
      v_new_status := 'completed';
      v_completed_count := v_completed_count + 1;
    else
      v_new_status := 'in_progress';
    end if;

    update public.mission_instances
    set progress = v_new_progress,
        status = v_new_status
    where id = v_rec.id;

    v_updated_count := v_updated_count + 1;
  end loop;

  -- If any daily mission was completed, increment the weekly mission counter
  if v_completed_count > 0 and p_action_key <> 'daily_mission_completed' then
    perform public.empire_increment_mission_progress(p_user_id, 'daily_mission_completed', v_completed_count);
  end if;

  return jsonb_build_object('updated', v_updated_count, 'completed', v_completed_count);
end;
$$ language plpgsql security definer set search_path = '';

-- -----------------------------------------------------------------------------
-- 7. Stored Procedure: empire_claim_mission
-- -----------------------------------------------------------------------------
create or replace function public.empire_legacy_claim_mission_009(
  p_user_id uuid,
  p_mission_instance_id uuid,
  p_request_id uuid default null
)
returns jsonb as $$
declare
  v_instance record;
  v_mission record;
  v_season record;
  v_reward_points integer;
  v_new_season_points bigint;
  v_idempotency_key text;
begin
  -- Lock the mission instance FOR UPDATE
  select * into v_instance
  from public.mission_instances
  where id = p_mission_instance_id and user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('error', 'MISSION_NOT_FOUND');
  end if;

  if v_instance.status = 'claimed' then
    return jsonb_build_object('error', 'ALREADY_CLAIMED');
  end if;

  if v_instance.status <> 'completed' then
    return jsonb_build_object('error', 'NOT_COMPLETED');
  end if;

  select * into v_mission
  from public.missions
  where id = v_instance.mission_id;

  select * into v_season
  from public.seasons
  where status = 'active'
  order by created_at desc
  limit 1;

  if v_season.sru_snapshot is null then
    v_reward_points := round(coalesce(v_mission.reward_sru_multiplier, 1.0) * 500);
  else
    v_reward_points := round(coalesce(v_mission.reward_sru_multiplier, 1.0) * v_season.sru_snapshot);
  end if;

  -- Update mission instance to claimed
  update public.mission_instances
  set status = 'claimed',
      claimed_at = now()
  where id = p_mission_instance_id;

  -- Lock and credit player balances
  update public.player_balances
  set season_points = season_points + v_reward_points,
      updated_at = now()
  where user_id = p_user_id
  returning season_points into v_new_season_points;

  -- Credit season scores if active season exists
  if v_season.id is not null then
    insert into public.season_scores (season_id, user_id, points, mission_points, updated_at)
    values (v_season.id, p_user_id, v_reward_points, v_reward_points, now())
    on conflict (season_id, user_id) do update
    set points = season_scores.points + excluded.points,
        mission_points = season_scores.mission_points + excluded.mission_points,
        updated_at = now();
  end if;

  -- Record reward ledger entry
  v_idempotency_key := coalesce(p_request_id::text, md5(p_mission_instance_id::text || ':' || now()::text));
  insert into public.reward_ledger (
    user_id, delta_cash, delta_season_points, reason, idempotency_key, metadata
  )
  values (
    p_user_id,
    0,
    v_reward_points,
    'mission_reward',
    v_idempotency_key,
    jsonb_build_object('missionInstanceId', p_mission_instance_id, 'missionKey', v_mission.key)
  )
  on conflict (idempotency_key) do nothing;

  return jsonb_build_object(
    'success', true,
    'missionInstanceId', p_mission_instance_id,
    'rewardPoints', v_reward_points,
    'newSeasonPoints', v_new_season_points,
    'claimedAt', now()
  );
end;
$$ language plpgsql security definer set search_path = '';

-- -----------------------------------------------------------------------------
-- 8. Stored Procedure: empire_claim_streak
-- -----------------------------------------------------------------------------
create or replace function public.empire_claim_streak(
  p_user_id uuid,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_streak record;
  v_today date := current_date;
  v_new_streak integer;
  v_is_cycle_bonus boolean := false;
  v_multiplier numeric;
  v_sru integer;
  v_reward_points integer;
  v_new_season_points bigint;
  v_longest integer;
  v_season record;
  v_idempotency_key text;
  v_old public.game_operation_replays;
  v_result jsonb;
  v_now timestamptz := now();
begin
  perform 1 from public.users where id = p_user_id for update;
  if not found then
    return jsonb_build_object('error', 'PLAYER_NOT_FOUND');
  end if;

  if p_request_id is not null then
    select * into v_old from public.game_operation_replays where user_id = p_user_id and request_id = p_request_id;
    if found then
      if v_old.operation <> 'claim_streak' or v_old.request_payload <> coalesce(v_today::text, '') then
        return jsonb_build_object('error', 'IDEMPOTENCY_CONFLICT');
      end if;
      return v_old.result;
    end if;
  end if;

  -- Lock streak record FOR UPDATE
  select * into v_streak
  from public.player_streaks
  where user_id = p_user_id
  for update;

  if not found then
    insert into public.player_streaks (user_id, current_streak, longest_streak, last_claim_date, updated_at)
    values (p_user_id, 0, 0, null, v_now)
    returning * into v_streak;
  end if;

  -- Reject duplicate claim on the same calendar day
  if v_streak.last_claim_date = v_today then
    v_result := jsonb_build_object('error', 'ALREADY_CLAIMED');
    if p_request_id is not null then
      insert into public.game_operation_replays
      values (p_user_id, p_request_id, 'claim_streak', coalesce(v_today::text, ''), v_result, v_now);
    end if;
    return v_result;
  end if;

  -- Evaluate consecutive days
  if v_streak.last_claim_date = v_today - 1 then
    v_new_streak := v_streak.current_streak + 1;
  else
    v_new_streak := 1;
  end if;

  -- Check Day 7 cycle bonus
  if v_new_streak >= 7 then
    v_is_cycle_bonus := true;
    v_multiplier := 1.0;
  else
    v_is_cycle_bonus := false;
    v_multiplier := 0.25;
  end if;

  select coalesce(sru_snapshot, 500) into v_sru
  from public.seasons
  where status = 'active'
  order by created_at desc
  limit 1;
  if v_sru is null then
    v_sru := 500;
  end if;

  v_reward_points := round(v_multiplier * v_sru);
  v_longest := greatest(coalesce(v_streak.longest_streak, 0), v_new_streak);

  -- Clean cycle reset if Day 7 reached
  update public.player_streaks
  set current_streak = case when v_new_streak >= 7 then 0 else v_new_streak end,
      longest_streak = v_longest,
      last_claim_date = v_today,
      updated_at = v_now
  where user_id = p_user_id;

  -- Lock and credit player balance
  update public.player_balances
  set season_points = season_points + v_reward_points,
      updated_at = v_now
  where user_id = p_user_id
  returning season_points into v_new_season_points;

  -- Credit season scores
  select id into v_season
  from public.seasons
  where status = 'active'
  order by created_at desc
  limit 1;

  if v_season.id is not null then
    insert into public.season_scores (season_id, user_id, points, updated_at)
    values (v_season.id, p_user_id, v_reward_points, v_now)
    on conflict (season_id, user_id) do update
    set points = public.season_scores.points + excluded.points,
        updated_at = excluded.updated_at;
  end if;

  -- Record reward ledger entry (64-hex idempotency key)
  v_idempotency_key := encode(sha256(('streak:' || p_user_id::text || ':' || v_today::text || ':' || coalesce(p_request_id::text, 'none'))::bytea), 'hex');
  insert into public.reward_ledger (
    user_id, delta_cash, delta_season_points, reason, idempotency_key, metadata
  )
  values (
    p_user_id,
    0,
    v_reward_points,
    'streak_claim',
    v_idempotency_key,
    jsonb_build_object('streakDay', v_new_streak, 'isCycleBonus', v_is_cycle_bonus)
  )
  on conflict (idempotency_key) do nothing;

  v_result := jsonb_build_object(
    'success', true,
    'currentStreak', v_new_streak,
    'newStreak', v_new_streak,
    'rewardPoints', v_reward_points,
    'newSeasonPoints', v_new_season_points,
    'isCycleBonus', v_is_cycle_bonus,
    'claimedAt', v_now
  );

  if p_request_id is not null then
    insert into public.game_operation_replays
    values (p_user_id, p_request_id, 'claim_streak', coalesce(v_today::text, ''), v_result, v_now);
  end if;

  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. Stored Procedure: empire_evaluate_referral_milestones
-- -----------------------------------------------------------------------------
create or replace function public.empire_evaluate_referral_milestones(
  p_invitee_user_id uuid
)
returns jsonb as $$
declare
  v_referral record;
  v_max_level integer;
  v_total_levels integer;
  v_active_days integer;
  v_sru integer := 500;
  v_q_count integer := 0;
  v_whale_factor numeric := 1.0;
  v_reward_amount integer;
  v_new_events jsonb := '[]'::jsonb;
begin
  select * into v_referral
  from public.referrals
  where invitee_user_id = p_invitee_user_id;

  if not found then
    return jsonb_build_object('qualified', false, 'events', '[]'::jsonb);
  end if;

  -- Get active season SRU
  select coalesce(sru_snapshot, 500) into v_sru
  from public.seasons
  where status = 'active'
  order by created_at desc
  limit 1;
  if v_sru is null then
    v_sru := 500;
  end if;

  -- Calculate qualified count for referrer
  select count(*) into v_q_count
  from public.referrals
  where referrer_user_id = v_referral.referrer_user_id
    and status = 'qualified';

  if v_q_count > 20 then
    v_whale_factor := greatest(0.25, sqrt(20.0 / v_q_count));
  else
    v_whale_factor := 1.0;
  end if;

  -- Milestone 1: activation (0.5x SRU) -> highest business level >= 1
  select coalesce(max(level), 0) into v_max_level
  from public.player_businesses
  where user_id = p_invitee_user_id;

  if v_max_level >= 1 and not exists (
    select 1 from public.referral_events
    where referral_id = v_referral.id and milestone = 'activation'
  ) then
    v_reward_amount := round(0.5 * v_sru * v_whale_factor);
    insert into public.referral_events (referral_id, milestone, reward_amount, status, qualified_at)
    values (v_referral.id, 'activation', v_reward_amount, 'pending', now())
    on conflict (referral_id, milestone) do nothing;

    -- Mark referral qualified
    update public.referrals set status = 'qualified' where id = v_referral.id;

    v_new_events := v_new_events || jsonb_build_object('milestone', 'activation', 'reward', v_reward_amount);
  end if;

  -- Count distinct active days
  select count(distinct date(issued_at at time zone 'UTC')) into v_active_days
  from public.auth_sessions
  where user_id = p_invitee_user_id;

  if v_active_days is null or v_active_days = 0 then
    select count(distinct date(created_at at time zone 'UTC')) into v_active_days
    from public.reward_ledger
    where user_id = p_invitee_user_id;
  end if;

  -- Milestone 2: retained_d2 (1.0x SRU) -> >= 2 distinct active days
  if v_active_days >= 2 and not exists (
    select 1 from public.referral_events
    where referral_id = v_referral.id and milestone = 'retained_d2'
  ) then
    v_reward_amount := round(1.0 * v_sru * v_whale_factor);
    insert into public.referral_events (referral_id, milestone, reward_amount, status, qualified_at)
    values (v_referral.id, 'retained_d2', v_reward_amount, 'pending', now())
    on conflict (referral_id, milestone) do nothing;

    v_new_events := v_new_events || jsonb_build_object('milestone', 'retained_d2', 'reward', v_reward_amount);
  end if;

  -- Milestone 3: retained_d7 (2.0x SRU) -> within 7.5 days, >= 4 active days
  if (now() <= v_referral.bound_at + interval '7 days 12 hours') and v_active_days >= 4 and not exists (
    select 1 from public.referral_events
    where referral_id = v_referral.id and milestone = 'retained_d7'
  ) then
    v_reward_amount := round(2.0 * v_sru * v_whale_factor);
    insert into public.referral_events (referral_id, milestone, reward_amount, status, qualified_at)
    values (v_referral.id, 'retained_d7', v_reward_amount, 'pending', now())
    on conflict (referral_id, milestone) do nothing;

    v_new_events := v_new_events || jsonb_build_object('milestone', 'retained_d7', 'reward', v_reward_amount);
  end if;

  -- Milestone 4: progression (1.5x SRU) -> total empire levels >= 10
  select coalesce(sum(level), 0) into v_total_levels
  from public.player_businesses
  where user_id = p_invitee_user_id;

  if v_total_levels >= 10 and not exists (
    select 1 from public.referral_events
    where referral_id = v_referral.id and milestone = 'progression'
  ) then
    v_reward_amount := round(1.5 * v_sru * v_whale_factor);
    insert into public.referral_events (referral_id, milestone, reward_amount, status, qualified_at)
    values (v_referral.id, 'progression', v_reward_amount, 'pending', now())
    on conflict (referral_id, milestone) do nothing;

    v_new_events := v_new_events || jsonb_build_object('milestone', 'progression', 'reward', v_reward_amount);
  end if;

  return jsonb_build_object('success', true, 'newEvents', v_new_events);
end;
$$ language plpgsql security definer set search_path = '';

-- -----------------------------------------------------------------------------
-- 10. Stored Procedure: empire_claim_referral_reward
-- -----------------------------------------------------------------------------
create or replace function public.empire_claim_referral_reward(
  p_referrer_user_id uuid,
  p_event_id uuid,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event record;
  v_new_season_points bigint;
  v_season record;
  v_idempotency_key text;
  v_old public.game_operation_replays;
  v_result jsonb;
  v_now timestamptz := now();
begin
  if p_request_id is not null then
    select * into v_old from public.game_operation_replays where user_id = p_referrer_user_id and request_id = p_request_id;
    if found then
      if v_old.operation <> 'claim_referral_reward' or v_old.request_payload <> coalesce(p_event_id::text, '') then
        return jsonb_build_object('error', 'IDEMPOTENCY_CONFLICT');
      end if;
      return v_old.result;
    end if;
  end if;

  select re.*, r.referrer_user_id
  into v_event
  from public.referral_events re
  join public.referrals r on r.id = re.referral_id
  where re.id = p_event_id
  for update of re;

  if not found or v_event.referrer_user_id <> p_referrer_user_id then
    return jsonb_build_object('error', 'EVENT_NOT_FOUND');
  end if;

  if v_event.status = 'claimed' then
    return jsonb_build_object('error', 'ALREADY_CLAIMED');
  end if;

  if v_event.status = 'frozen' then
    return jsonb_build_object('error', 'REWARD_FROZEN');
  end if;

  -- Update event status to claimed
  update public.referral_events
  set status = 'claimed',
      claimed_at = v_now
  where id = p_event_id;

  -- Lock and credit referrer player balance
  update public.player_balances
  set season_points = season_points + v_event.reward_amount,
      updated_at = v_now
  where user_id = p_referrer_user_id
  returning season_points into v_new_season_points;

  -- Credit season scores
  select id into v_season
  from public.seasons
  where status = 'active'
  order by created_at desc
  limit 1;

  if v_season.id is not null then
    insert into public.season_scores (season_id, user_id, points, referral_points, updated_at)
    values (v_season.id, p_referrer_user_id, v_event.reward_amount, v_event.reward_amount, v_now)
    on conflict (season_id, user_id) do update
    set points = public.season_scores.points + excluded.points,
        referral_points = public.season_scores.referral_points + excluded.referral_points,
        updated_at = excluded.updated_at;
  end if;

  -- Record reward ledger entry (64-hex idempotency key)
  v_idempotency_key := encode(sha256(('referral_claim:' || p_referrer_user_id::text || ':' || p_event_id::text || ':' || coalesce(p_request_id::text, 'none'))::bytea), 'hex');
  insert into public.reward_ledger (
    user_id, delta_cash, delta_season_points, reason, idempotency_key, metadata
  )
  values (
    p_referrer_user_id,
    0,
    v_event.reward_amount,
    'referral_reward_claim',
    v_idempotency_key,
    jsonb_build_object('eventId', p_event_id, 'milestone', v_event.milestone)
  )
  on conflict (idempotency_key) do nothing;

  v_result := jsonb_build_object(
    'success', true,
    'eventId', p_event_id,
    'rewardPoints', v_event.reward_amount,
    'newSeasonPoints', v_new_season_points,
    'claimedAt', v_now
  );

  if p_request_id is not null then
    insert into public.game_operation_replays
    values (p_referrer_user_id, p_request_id, 'claim_referral_reward', coalesce(p_event_id::text, ''), v_result, v_now);
  end if;

  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- 11. Stored Procedure: empire_get_active_missions
-- -----------------------------------------------------------------------------
create or replace function public.empire_legacy_get_active_missions_009(
  p_user_id uuid
)
returns jsonb as $$
declare
  v_res jsonb;
begin
  -- Automatically assign daily missions if missing for current date
  perform public.empire_assign_daily_missions(p_user_id, current_date);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', mi.id,
      'key', m.key,
      'difficulty', m.difficulty,
      'title', m.title,
      'description', m.description,
      'progress', mi.progress,
      'target', mi.target,
      'status', mi.status,
      'rewardPoints', coalesce(m.reward_points, round(m.reward_sru_multiplier * 500)),
      'assignedDate', mi.assigned_date::text,
      'claimedAt', mi.claimed_at
    ) order by case m.difficulty when 'easy' then 1 when 'normal' then 2 when 'hard' then 3 when 'weekly' then 4 else 5 end
  ), '[]'::jsonb) into v_res
  from public.mission_instances mi
  join public.missions m on m.id = mi.mission_id
  where mi.user_id = p_user_id
    and (
      (m.difficulty in ('easy', 'normal', 'hard') and mi.assigned_date = current_date) or
      (m.difficulty = 'weekly' and mi.assigned_date = date_trunc('week', current_date)::date)
    );

  return v_res;
end;
$$ language plpgsql security definer;

-- -----------------------------------------------------------------------------
-- 12. Stored Procedure: empire_get_streak
-- -----------------------------------------------------------------------------
create or replace function public.empire_legacy_get_streak_009(
  p_user_id uuid
)
returns jsonb as $$
declare
  v_streak record;
  v_today date := current_date;
  v_can_claim boolean;
  v_next_streak integer;
  v_sru integer := 500;
  v_reward_points integer;
  v_is_cycle boolean;
begin
  select * into v_streak
  from public.player_streaks
  where user_id = p_user_id;

  if not found then
    v_can_claim := true;
    v_next_streak := 1;
    v_is_cycle := false;
  elsif v_streak.last_claim_date = v_today then
    v_can_claim := false;
    v_next_streak := v_streak.current_streak;
    v_is_cycle := (v_next_streak = 7);
  elsif v_streak.last_claim_date = v_today - 1 then
    v_can_claim := true;
    v_next_streak := case when v_streak.current_streak >= 7 then 1 else v_streak.current_streak + 1 end;
    v_is_cycle := (v_next_streak = 7);
  else
    v_can_claim := true;
    v_next_streak := 1;
    v_is_cycle := false;
  end if;

  select coalesce(sru_snapshot, 500) into v_sru
  from public.seasons
  where status = 'active'
  order by created_at desc
  limit 1;
  if v_sru is null then
    v_sru := 500;
  end if;

  v_reward_points := round((case when v_is_cycle then 1.0 else 0.25 end) * v_sru);

  return jsonb_build_object(
    'currentStreak', coalesce(v_streak.current_streak, 0),
    'longestStreak', coalesce(v_streak.longest_streak, 0),
    'lastClaimDate', v_streak.last_claim_date,
    'canClaimToday', v_can_claim,
    'todayRewardPoints', v_reward_points,
    'isCycleBonusToday', v_is_cycle
  );
end;
$$ language plpgsql security definer;

-- -----------------------------------------------------------------------------
-- 13. Stored Procedure: empire_get_referral_status
-- -----------------------------------------------------------------------------
create or replace function public.empire_legacy_get_referral_status_009(
  p_user_id uuid
)
returns jsonb as $$
declare
  v_code text;
  v_total_invites integer := 0;
  v_qualified_count integer := 0;
  v_total_earned bigint := 0;
  v_badges text[] := '{}';
begin
  select referral_code into v_code
  from public.users
  where id = p_user_id;

  if v_code is null then
    v_code := substr(md5(p_user_id::text), 1, 8);
    update public.users set referral_code = v_code where id = p_user_id and referral_code is null;
  end if;

  select count(*) into v_total_invites
  from public.referrals
  where referrer_user_id = p_user_id;

  select count(*) into v_qualified_count
  from public.referrals
  where referrer_user_id = p_user_id
    and status = 'qualified';

  select coalesce(sum(re.reward_amount), 0) into v_total_earned
  from public.referral_events re
  join public.referrals r on r.id = re.referral_id
  where r.referrer_user_id = p_user_id
    and re.status = 'claimed';

  if v_qualified_count >= 1 then
    v_badges := array_append(v_badges, 'recruiter');
    v_badges := array_append(v_badges, 'badge_early_connector');
  end if;
  if v_qualified_count >= 3 then
    v_badges := array_append(v_badges, 'preset_extra_automation');
  end if;
  if v_qualified_count >= 5 then
    v_badges := array_append(v_badges, 'pass_7d');
  end if;
  if v_qualified_count >= 10 then
    v_badges := array_append(v_badges, 'frame_exclusive_referral');
  end if;
  if v_qualified_count >= 25 then
    v_badges := array_append(v_badges, 'emblem_custom_slot');
  end if;
  if v_qualified_count >= 50 then
    v_badges := array_append(v_badges, 'cosmetic_founder_set');
  end if;
  if v_qualified_count >= 100 then
    v_badges := array_append(v_badges, 'ambassador_eligibility');
  end if;

  return jsonb_build_object(
    'referralCode', v_code,
    'deepLink', 'https://t.me/EmpireBot?startapp=ref_' || v_code,
    'totalInvites', v_total_invites,
    'qualifiedCount', v_qualified_count,
    'totalEarnedPoints', v_total_earned,
    'unlockedBadges', to_jsonb(v_badges)
  );
end;
$$ language plpgsql security definer;

-- -----------------------------------------------------------------------------
-- 14. Stored Procedure: empire_bind_referral
-- -----------------------------------------------------------------------------
create or replace function public.empire_legacy_bind_referral_009(
  p_user_id uuid,
  p_referral_code text
)
returns jsonb as $$
declare
  v_referrer_id uuid;
  v_user_created timestamptz;
  v_existing uuid;
begin
  select id into v_referrer_id
  from public.users
  where referral_code = p_referral_code;

  if not found then
    return jsonb_build_object('success', false, 'error', 'INVALID_CODE', 'starterCashBoost', 0);
  end if;

  if v_referrer_id = p_user_id then
    return jsonb_build_object('success', false, 'error', 'SELF_REFERRAL', 'starterCashBoost', 0);
  end if;

  -- Check already referred
  select id into v_existing
  from public.referrals
  where invitee_user_id = p_user_id;

  if v_existing is not null then
    return jsonb_build_object('success', false, 'error', 'ALREADY_REFERRED', 'starterCashBoost', 0);
  end if;

  -- Check 30 minute window
  select created_at into v_user_created
  from public.users
  where id = p_user_id;

  if v_user_created is not null and now() > v_user_created + interval '30 minutes' then
    return jsonb_build_object('success', false, 'error', 'BIND_WINDOW_EXPIRED', 'starterCashBoost', 0);
  end if;

  -- Insert referral link
  insert into public.referrals (invitee_user_id, referrer_user_id, code, bound_at, status)
  values (p_user_id, v_referrer_id, p_referral_code, now(), 'bound');

  -- Credit starter cash boost (+500 Cash)
  update public.player_balances
  set cash = cash + 500,
      updated_at = now()
  where user_id = p_user_id;

  insert into public.reward_ledger (user_id, delta_cash, delta_season_points, reason, idempotency_key, metadata)
  values (
    p_user_id,
    500,
    0,
    'referral_starter_boost',
    md5(p_user_id::text || ':referral_boost:' || p_referral_code),
    jsonb_build_object('referrerId', v_referrer_id, 'code', p_referral_code)
  )
  on conflict (idempotency_key) do nothing;

  return jsonb_build_object('success', true, 'starterCashBoost', 500);
end;
$$ language plpgsql security definer;

-- -----------------------------------------------------------------------------
-- 15. Stored Procedure: empire_claim_offline_earnings
-- -----------------------------------------------------------------------------
create or replace function public.empire_legacy_claim_offline_earnings_009(
  p_user_id uuid,
  p_offline_cap_seconds integer default 14400
)
returns jsonb as $$
declare
  v_biz record;
  v_total_earned bigint := 0;
  v_elapsed_seconds numeric;
  v_capped_seconds numeric;
  v_earned bigint;
  v_is_capped boolean := false;
  v_new_balance bigint;
  v_max_elapsed numeric := 0;
begin
  -- Lock player balance
  select cash into v_new_balance
  from public.player_balances
  where user_id = p_user_id
  for update;

  for v_biz in
    select pb.id, pb.business_slug, pb.level, pb.last_claim_at, b.base_income, b.sort_order
    from public.player_businesses pb
    join public.businesses b on b.slug = pb.business_slug
    where pb.user_id = p_user_id and pb.level > 0
    for update of pb
  loop
    v_elapsed_seconds := extract(epoch from (now() - v_biz.last_claim_at));
    if v_elapsed_seconds > v_max_elapsed then
      v_max_elapsed := v_elapsed_seconds;
    end if;

    if v_elapsed_seconds > p_offline_cap_seconds then
      v_capped_seconds := p_offline_cap_seconds;
      v_is_capped := true;
    else
      v_capped_seconds := greatest(0, v_elapsed_seconds);
    end if;

    v_earned := round((v_biz.base_income * v_biz.level * power(1.1, greatest(0, v_biz.level - 1)) * (case when v_biz.level >= 10 then 1.5 else 1.0 end)) * v_capped_seconds);
    v_total_earned := v_total_earned + v_earned;

    update public.player_businesses
    set last_claim_at = now()
    where id = v_biz.id;
  end loop;

  if v_total_earned > 0 then
    update public.player_balances
    set cash = cash + v_total_earned,
        updated_at = now()
    where user_id = p_user_id
    returning cash into v_new_balance;

    insert into public.reward_ledger (user_id, delta_cash, delta_season_points, reason, idempotency_key, metadata)
    values (
      p_user_id,
      v_total_earned,
      0,
      'offline_earnings',
      md5(p_user_id::text || ':claim:' || now()::text),
      jsonb_build_object('claimedAmount', v_total_earned, 'isCapped', v_is_capped)
    )
    on conflict (idempotency_key) do nothing;

    -- Progress hooks: claim_cash
    perform public.empire_increment_mission_progress(p_user_id, 'claim_cash', 1);

    -- If offline duration >= 4 hours (14,400 seconds)
    if v_max_elapsed >= 14400 then
      perform public.empire_increment_mission_progress(p_user_id, 'claim_offline_4h', 1);
    end if;
  end if;

  return jsonb_build_object(
    'claimedAmount', v_total_earned,
    'newBalance', coalesce(v_new_balance, 0),
    'claimedAt', now(),
    'isCapped', v_is_capped
  );
end;
$$ language plpgsql security definer;

-- -----------------------------------------------------------------------------
-- 16. Stored Procedure: empire_upgrade_business
-- -----------------------------------------------------------------------------
create or replace function public.empire_legacy_upgrade_business_009(
  p_user_id uuid,
  p_business_slug text,
  p_request_id text default null
)
returns jsonb as $$
declare
  v_biz_def record;
  v_player_biz record;
  v_cash bigint;
  v_upgrade_cost bigint;
  v_new_level integer;
  v_new_cash bigint;
  v_new_prod numeric;
begin
  select * into v_biz_def
  from public.businesses
  where slug = p_business_slug;

  if not found then
    return jsonb_build_object('error', 'BUSINESS_NOT_FOUND');
  end if;

  -- Lock balance
  select cash into v_cash
  from public.player_balances
  where user_id = p_user_id
  for update;

  select * into v_player_biz
  from public.player_businesses
  where user_id = p_user_id and business_slug = p_business_slug
  for update;

  if not found then
    v_new_level := 1;
    v_upgrade_cost := v_biz_def.base_cost;
  else
    v_new_level := v_player_biz.level + 1;
    v_upgrade_cost := round(v_biz_def.base_cost * power(1.15, v_player_biz.level));
  end if;

  if v_cash < v_upgrade_cost then
    return jsonb_build_object('error', 'INSUFFICIENT_CASH');
  end if;

  -- Deduct cash
  update public.player_balances
  set cash = cash - v_upgrade_cost,
      updated_at = now()
  where user_id = p_user_id
  returning cash into v_new_cash;

  -- Update or insert player business
  if v_player_biz.id is null then
    insert into public.player_businesses (user_id, business_slug, level, last_claim_at)
    values (p_user_id, p_business_slug, v_new_level, now())
    returning * into v_player_biz;
  else
    update public.player_businesses
    set level = v_new_level,
        updated_at = now()
    where id = v_player_biz.id
    returning * into v_player_biz;
  end if;

  v_new_prod := round(v_biz_def.base_income * v_new_level * power(1.1, greatest(0, v_new_level - 1)) * (case when v_new_level >= 10 then 1.5 else 1.0 end));

  -- Record ledger
  insert into public.reward_ledger (user_id, delta_cash, delta_season_points, reason, idempotency_key, metadata)
  values (
    p_user_id,
    -v_upgrade_cost,
    0,
    'business_upgrade',
    coalesce(p_request_id, md5(p_user_id::text || ':' || p_business_slug || ':' || v_new_level::text)),
    jsonb_build_object('businessSlug', p_business_slug, 'level', v_new_level, 'cost', v_upgrade_cost)
  )
  on conflict (idempotency_key) do nothing;

  -- Action progression hooks:
  -- 1. upgrade_any
  perform public.empire_increment_mission_progress(p_user_id, 'upgrade_any', 1);

  -- 2. reach_milestone (when level reaches 10, 25, 50, 100, 200)
  if v_new_level in (10, 25, 50, 100, 200) then
    perform public.empire_increment_mission_progress(p_user_id, 'reach_milestone', 1);
  end if;

  -- 3. upgrade_factory_tier (when business is factory or higher)
  if p_business_slug in ('factory', 'tech_company', 'global_holding') then
    perform public.empire_increment_mission_progress(p_user_id, 'upgrade_factory_tier', 1);
  end if;

  -- 4. Evaluate invitee referral milestones if user was referred
  perform public.empire_evaluate_referral_milestones(p_user_id);

  return jsonb_build_object(
    'success', true,
    'business', jsonb_build_object(
      'slug', p_business_slug,
      'name', v_biz_def.name,
      'level', v_new_level,
      'baseCost', v_biz_def.base_cost,
      'baseIncome', v_biz_def.base_income,
      'upgradeCost', round(v_biz_def.base_cost * power(1.15, v_new_level)),
      'productionPerSecond', v_new_prod,
      'lastClaimAt', v_player_biz.last_claim_at
    ),
    'remainingCash', v_new_cash,
    'totalProductionPerSecond', v_new_prod
  );
end;
$$ language plpgsql security definer;

-- -----------------------------------------------------------------------------
-- 17. Stored Procedure: empire_get_game_state
-- -----------------------------------------------------------------------------
create or replace function public.empire_legacy_get_game_state_009(
  p_user_id uuid
)
returns jsonb as $$
declare
  v_balance record;
  v_businesses jsonb;
  v_season jsonb;
  v_streak jsonb;
  v_missions jsonb;
begin
  -- Automatically assign daily missions if needed
  perform public.empire_assign_daily_missions(p_user_id, current_date);

  select * into v_balance from public.player_balances where user_id = p_user_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'slug', b.slug,
      'name', b.name,
      'level', coalesce(pb.level, 0),
      'baseCost', b.base_cost,
      'baseIncome', b.base_income,
      'upgradeCost', round(b.base_cost * power(1.15, coalesce(pb.level, 0))),
      'productionPerSecond', case when coalesce(pb.level, 0) = 0 then 0 else round(b.base_income * pb.level * power(1.1, greatest(0, pb.level - 1)) * (case when pb.level >= 10 then 1.5 else 1.0 end)) end,
      'lastClaimAt', coalesce(pb.last_claim_at, now())
    ) order by b.sort_order
  ), '[]'::jsonb) into v_businesses
  from public.businesses b
  left join public.player_businesses pb on pb.business_slug = b.slug and pb.user_id = p_user_id;

  select jsonb_build_object(
    'id', s.id,
    'name', s.name,
    'status', s.status,
    'startsAt', s.starts_at,
    'endsAt', s.ends_at,
    'sruSnapshot', s.sru_snapshot
  ) into v_season
  from public.seasons s
  where s.status = 'active'
  order by s.created_at desc
  limit 1;

  v_streak := public.empire_get_streak(p_user_id);
  v_missions := public.empire_get_active_missions(p_user_id);

  return jsonb_build_object(
    'cash', coalesce(v_balance.cash, 100),
    'seasonPoints', coalesce(v_balance.season_points, 0),
    'businesses', v_businesses,
    'activeSeason', v_season,
    'streak', v_streak,
    'missions', v_missions
  );
end;
$$ language plpgsql security definer;

-- -----------------------------------------------------------------------------
-- 18. Permissions and Grants
-- -----------------------------------------------------------------------------
drop function public.empire_legacy_claim_mission_009(uuid, uuid, uuid);
drop function public.empire_legacy_get_active_missions_009(uuid);
drop function public.empire_legacy_get_streak_009(uuid);
drop function public.empire_legacy_get_referral_status_009(uuid);
drop function public.empire_legacy_bind_referral_009(uuid, text);
drop function public.empire_legacy_claim_offline_earnings_009(uuid, integer);
drop function public.empire_legacy_upgrade_business_009(uuid, text, text);
drop function public.empire_legacy_get_game_state_009(uuid);
grant select, insert, update on public.missions, public.mission_instances, public.player_streaks, public.referrals, public.referral_events to service_role;
revoke all on function public.empire_assign_daily_missions(uuid, date) from public, anon, authenticated;
revoke all on function public.empire_increment_mission_progress(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.empire_claim_streak(uuid, uuid) from public, anon, authenticated;
revoke all on function public.empire_evaluate_referral_milestones(uuid) from public, anon, authenticated;
revoke all on function public.empire_claim_referral_reward(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.empire_assign_daily_missions(uuid, date) to service_role;
grant execute on function public.empire_increment_mission_progress(uuid, text, integer) to service_role;
grant execute on function public.empire_claim_mission(uuid, uuid, uuid) to service_role;
grant execute on function public.empire_claim_streak(uuid, uuid) to service_role;
grant execute on function public.empire_evaluate_referral_milestones(uuid) to service_role;
grant execute on function public.empire_claim_referral_reward(uuid, uuid, uuid) to service_role;
grant execute on function public.empire_get_active_missions(uuid) to service_role;
grant execute on function public.empire_get_streak(uuid) to service_role;
grant execute on function public.empire_get_referral_status(uuid) to service_role;
grant execute on function public.empire_bind_referral(uuid, text, uuid) to service_role;
grant execute on function public.empire_claim_offline_earnings(uuid, uuid) to service_role;
grant execute on function public.empire_upgrade_business(uuid, text, uuid) to service_role;
grant execute on function public.empire_get_game_state(uuid) to service_role;

commit;


-- >>> 202609140010_designated_admins.sql <<<
-- =============================================================================
-- Migration: 202609140010_designated_admins.sql
-- Description: Designated Superadmins (@Barandnz, @Mberked) Auto-Role Assignment & Role Checks
-- =============================================================================

begin;

-- 1. Ensure public.admin_roles table exists
create table if not exists public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('admin', 'superadmin', 'auditor')),
  assigned_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, role)
);

-- 2. Stored Procedure: empire_admin_check_role enhancement
create or replace function public.empire_admin_check_role(
  p_user_id uuid,
  p_required_role text default 'admin'
) returns boolean
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_has_role boolean := false;
  v_username text;
begin
  if p_user_id is null then
    return false;
  end if;

  -- Check if user is one of the designated admins (@Barandnz, @Mberked)
  select lower(username) into v_username
  from public.users
  where id = p_user_id;

  if v_username in ('barandnz', 'mberked') then
    return true;
  end if;

  select exists (
    select 1 from public.admin_roles
    where user_id = p_user_id
      and (role = p_required_role or role = 'superadmin' or (p_required_role = 'auditor' and role in ('admin', 'superadmin', 'auditor')))
  ) into v_has_role;

  return v_has_role;
end;
$$;

-- 3. Automatic Assignment Trigger Function for Designated Admins
create or replace function public.empire_handle_designated_admins()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if lower(coalesce(new.username, '')) in ('barandnz', 'mberked') then
    insert into public.admin_roles (user_id, role, assigned_by, created_at, updated_at)
    values (new.id, 'superadmin', null, now(), now())
    on conflict (user_id, role) do update set updated_at = now();
  end if;
  return new;
end;
$$;

-- Drop and re-create trigger on public.users
drop trigger if exists trg_designated_admins_auto_assign on public.users;
create trigger trg_designated_admins_auto_assign
  after insert or update of username on public.users
  for each row
  execute function public.empire_handle_designated_admins();

-- 4. Retroactive grant for any existing records
insert into public.admin_roles (user_id, role, assigned_by, created_at, updated_at)
select id, 'superadmin', null, now(), now()
from public.users
where lower(username) in ('barandnz', 'mberked')
on conflict (user_id, role) do update set updated_at = now();

grant execute on function public.empire_admin_check_role(uuid, text) to service_role;

commit;


-- >>> 202609140011_admin_governance.sql <<<
-- =============================================================================
-- Migration: 202609140011_admin_governance.sql
-- Description: Admin Governance, Dynamic Feature Flags, RBAC, and Audit Logging
-- =============================================================================

begin;

-- 1. Ensure public.admin_audit_logs table has admin_username column and updated constraints
alter table public.admin_audit_logs add column if not exists admin_username text;
create index if not exists admin_audit_logs_username_idx on public.admin_audit_logs(admin_username);
create index if not exists admin_audit_logs_created_at_desc_idx on public.admin_audit_logs(created_at desc);

alter table public.admin_audit_logs drop constraint if exists admin_audit_logs_action_check;
alter table public.admin_audit_logs add constraint admin_audit_logs_action_check check (
  action in (
    'update_config', 'set_feature_flag', 'freeze_season', 'ban_user', 'refund_purchase',
    'fraud_flag_created', 'fraud_flag_reviewed', 'fraud_flag_dismissed',
    'reward_frozen', 'reward_approved', 'reward_rejected',
    'admin_role_assigned', 'admin_role_revoked',
    'unfreeze_account', 'reject_account'
  )
);

-- 2. Seed canonical baseline values for dynamic toggles
insert into public.economy_config(key, value, description) values
  ('feature.stars_payments', 'false'::jsonb, 'Telegram Stars payment processing toggle'),
  ('feature.maintenance_mode', 'false'::jsonb, 'Global emergency maintenance mode toggle'),
  ('feature.referrals', 'true'::jsonb, 'Player referral reward system toggle'),
  ('economy.multiplier', '1.0'::jsonb, 'Global idle economy cash production multiplier')
on conflict (key) do nothing;

-- 3. Stored Procedure: empire_admin_update_config with idempotency and audit trail
create or replace function public.empire_admin_update_config(
  p_key text,
  p_value jsonb,
  p_admin_user_id uuid default null,
  p_reason text default null,
  p_request_id uuid default null,
  p_admin_username text default null
) returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_old_value jsonb;
  v_audit_id uuid := coalesce(p_request_id, gen_random_uuid());
  v_now timestamptz := now();
  v_username text := p_admin_username;
  v_existing_log record;
  v_action text;
  v_target_type text;
begin
  -- Idempotency check: If p_request_id already logged, return existing result
  if p_request_id is not null then
    select id, target_key, new_value into v_existing_log
    from public.admin_audit_logs
    where id = p_request_id;

    if found then
      return jsonb_build_object(
        'success', true,
        'key', v_existing_log.target_key,
        'updatedValue', v_existing_log.new_value,
        'auditLogId', v_existing_log.id
      );
    end if;
  end if;

  -- Resolve admin username if not provided
  if v_username is null and p_admin_user_id is not null then
    select username into v_username
    from public.users
    where id = p_admin_user_id;
  end if;

  -- Lock and read current value
  select value into v_old_value
  from public.economy_config
  where key = p_key
  for update;

  -- Upsert config value
  insert into public.economy_config (key, value, updated_at)
  values (p_key, p_value, v_now)
  on conflict (key) do update set
    value = excluded.value,
    updated_at = excluded.updated_at;

  v_action := case when p_key like 'feature.%' then 'set_feature_flag' else 'update_config' end;
  v_target_type := case when p_key like 'feature.%' then 'feature_flag' else 'economy_config' end;

  -- Insert immutable audit log
  insert into public.admin_audit_logs (
    id, admin_user_id, admin_username, action, target_type, target_key, old_value, new_value, reason, created_at
  ) values (
    v_audit_id,
    p_admin_user_id,
    v_username,
    v_action,
    v_target_type,
    p_key,
    v_old_value,
    p_value,
    p_reason,
    v_now
  );

  return jsonb_build_object(
    'success', true,
    'key', p_key,
    'updatedValue', p_value,
    'auditLogId', v_audit_id
  );
end;
$$;

-- 4. Delegate empire_config_update to empire_admin_update_config
create or replace function public.empire_config_update(
  p_key text,
  p_value jsonb,
  p_admin_user_id uuid default null,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_username text;
begin
  if p_admin_user_id is not null then
    select username into v_username from public.users where id = p_admin_user_id;
  end if;

  return public.empire_admin_update_config(
    p_key,
    p_value,
    p_admin_user_id,
    p_reason,
    null,
    v_username
  );
end;
$$;

-- 5. Stored Procedure: empire_admin_get_audit_logs
create or replace function public.empire_admin_get_audit_logs(
  p_limit int default 50,
  p_offset int default 0,
  p_target_key text default null
) returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_total int;
  v_logs jsonb;
begin
  select count(*) into v_total
  from public.admin_audit_logs a
  where (p_target_key is null or a.target_key = p_target_key);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'adminUserId', a.admin_user_id,
      'adminUsername', coalesce(a.admin_username, u.username),
      'action', a.action,
      'targetType', a.target_type,
      'targetKey', a.target_key,
      'oldValue', a.old_value,
      'newValue', a.new_value,
      'reason', a.reason,
      'createdAt', to_char(a.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ) order by a.created_at desc
  ), '[]'::jsonb) into v_logs
  from (
    select * from public.admin_audit_logs
    where (p_target_key is null or target_key = p_target_key)
    order by created_at desc
    limit least(greatest(p_limit, 1), 100)
    offset greatest(p_offset, 0)
  ) a
  left join public.users u on u.id = a.admin_user_id;

  return jsonb_build_object(
    'logs', v_logs,
    'total', v_total
  );
end;
$$;

-- 6. Stored Procedure: empire_admin_get_flagged_accounts
create or replace function public.empire_admin_get_flagged_accounts(
  p_limit int default 50,
  p_offset int default 0
) returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_total int;
  v_accounts jsonb;
begin
  select count(distinct u.id) into v_total
  from public.users u
  left join public.fraud_flags f on f.user_id = u.id and f.status in ('pending', 'investigating')
  left join public.frozen_rewards r on r.user_id = u.id and r.status = 'frozen'
  where u.risk_score > 0 or f.id is not null or r.id is not null;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'userId', sub.id,
      'telegramId', sub.telegram_user_id,
      'username', sub.username,
      'firstName', sub.first_name,
      'riskScore', sub.risk_score,
      'status', sub.status,
      'pendingFlagsCount', sub.pending_flags_count,
      'frozenRewardsCount', sub.frozen_rewards_count,
      'totalFrozenCash', sub.total_frozen_cash,
      'totalFrozenSeasonPoints', sub.total_frozen_points,
      'highestSeverity', sub.highest_severity,
      'createdAt', to_char(sub.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ) order by sub.risk_score desc, sub.created_at desc
  ), '[]'::jsonb) into v_accounts
  from (
    select
      u.id,
      u.telegram_user_id,
      u.username,
      u.first_name,
      u.risk_score,
      u.status,
      u.created_at,
      count(distinct f.id) filter (where f.status in ('pending', 'investigating')) as pending_flags_count,
      count(distinct r.id) filter (where r.status = 'frozen') as frozen_rewards_count,
      coalesce(sum(r.amount_cash) filter (where r.status = 'frozen'), 0) as total_frozen_cash,
      coalesce(sum(r.amount_season_points) filter (where r.status = 'frozen'), 0) as total_frozen_points,
      case
        max(case
          when f.severity = 'critical' then 4
          when f.severity = 'high' then 3
          when f.severity = 'medium' then 2
          when f.severity = 'low' then 1
          else 0
        end)
        when 4 then 'critical'
        when 3 then 'high'
        when 2 then 'medium'
        when 1 then 'low'
        else 'none'
      end as highest_severity
    from public.users u
    left join public.fraud_flags f on f.user_id = u.id and f.status in ('pending', 'investigating')
    left join public.frozen_rewards r on r.user_id = u.id and r.status = 'frozen'
    where u.risk_score > 0 or f.id is not null or r.id is not null
    group by u.id, u.telegram_user_id, u.username, u.first_name, u.risk_score, u.status, u.created_at
    order by u.risk_score desc, u.created_at desc
    limit least(greatest(p_limit, 1), 100)
    offset greatest(p_offset, 0)
  ) sub;

  return jsonb_build_object(
    'accounts', v_accounts,
    'total', v_total
  );
end;
$$;

-- 7. Stored Procedure: empire_admin_unfreeze_account
create or replace function public.empire_admin_unfreeze_account(
  p_target_user_id uuid,
  p_admin_user_id uuid default null,
  p_notes text default null,
  p_request_id uuid default null,
  p_admin_username text default null
) returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_user record;
  v_admin_username text := p_admin_username;
  v_now timestamptz := now();
  v_audit_id uuid := coalesce(p_request_id, gen_random_uuid());
  v_existing_log record;
  v_reward record;
  v_total_credited_cash numeric := 0;
  v_total_credited_points numeric := 0;
  v_unfrozen_count int := 0;
  v_old_status text;
  v_active_season_id uuid;
  v_result jsonb;
begin
  -- Idempotency check: if request_id already processed
  if p_request_id is not null then
    select id, new_value into v_existing_log
    from public.admin_audit_logs
    where id = p_request_id;

    if found then
      return v_existing_log.new_value;
    end if;
  end if;

  -- 1. Check target user exists
  select id, username, status, risk_score into v_user
  from public.users
  where id = p_target_user_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'USER_NOT_FOUND');
  end if;

  v_old_status := v_user.status;

  -- 2. Resolve admin username
  if v_admin_username is null and p_admin_user_id is not null then
    select username into v_admin_username
    from public.users
    where id = p_admin_user_id;
  end if;

  -- 3. Find active season
  select id into v_active_season_id
  from public.seasons
  where status = 'active'
    and starts_at <= v_now
    and ends_at > v_now
  order by starts_at desc
  limit 1;

  -- 4. Process all frozen rewards for this user
  for v_reward in
    select id, reward_type, amount_cash, amount_season_points, fraud_flag_id
    from public.frozen_rewards
    where user_id = p_target_user_id and status = 'frozen'
    for update
  loop
    update public.frozen_rewards
    set status = 'approved',
        reviewed_by = p_admin_user_id,
        review_notes = coalesce(p_notes, 'Account unfreeze by admin'),
        reviewed_at = v_now,
        updated_at = v_now
    where id = v_reward.id;

    v_total_credited_cash := v_total_credited_cash + v_reward.amount_cash;
    v_total_credited_points := v_total_credited_points + v_reward.amount_season_points;
    v_unfrozen_count := v_unfrozen_count + 1;

    -- If linked to a flag, resolve that flag
    if v_reward.fraud_flag_id is not null then
      update public.fraud_flags
      set status = 'resolved',
          reviewed_by = p_admin_user_id,
          resolution_notes = coalesce(p_notes, 'Unfrozen with account'),
          reviewed_at = v_now,
          updated_at = v_now
      where id = v_reward.fraud_flag_id and status in ('pending', 'investigating');
    end if;

    -- Insert into reward_ledger if amounts > 0
    if v_reward.amount_cash > 0 or v_reward.amount_season_points > 0 then
      insert into public.reward_ledger (
        user_id, delta_cash, delta_season_points, reason, idempotency_key, metadata, created_at
      ) values (
        p_target_user_id,
        v_reward.amount_cash,
        v_reward.amount_season_points,
        'reward_unfrozen_approved',
        encode(sha256(('unfreeze_account_' || v_reward.id::text)::bytea), 'hex'),
        jsonb_build_object('rewardId', v_reward.id, 'rewardType', v_reward.reward_type, 'notes', p_notes),
        v_now
      )
      on conflict (idempotency_key) do nothing;
    end if;
  end loop;

  -- 5. Credit player balance
  if v_total_credited_cash > 0 or v_total_credited_points > 0 then
    insert into public.player_balances (user_id, cash, season_points, updated_at)
    values (p_target_user_id, v_total_credited_cash, v_total_credited_points, v_now)
    on conflict (user_id) do update set
      cash = player_balances.cash + excluded.cash,
      season_points = player_balances.season_points + excluded.season_points,
      updated_at = v_now;

    -- Update season_scores if active season and points > 0
    if v_active_season_id is not null and v_total_credited_points > 0 then
      insert into public.season_scores (season_id, user_id, points, updated_at)
      values (v_active_season_id, p_target_user_id, v_total_credited_points, v_now)
      on conflict (season_id, user_id) do update set
        points = season_scores.points + excluded.points,
        updated_at = v_now;
    end if;
  end if;

  -- 6. Resolve remaining pending fraud flags for this user
  update public.fraud_flags
  set status = 'resolved',
      reviewed_by = p_admin_user_id,
      resolution_notes = coalesce(p_notes, 'Account unfreeze by admin'),
      reviewed_at = v_now,
      updated_at = v_now
  where user_id = p_target_user_id and status in ('pending', 'investigating');

  -- 7. Restore user status to active and reset risk score
  update public.users
  set status = 'active',
      risk_score = 0,
      updated_at = v_now
  where id = p_target_user_id;

  v_result := jsonb_build_object(
    'success', true,
    'userId', p_target_user_id,
    'status', 'active',
    'unfrozenRewardsCount', v_unfrozen_count,
    'creditedCash', v_total_credited_cash,
    'creditedSeasonPoints', v_total_credited_points,
    'reviewedAt', to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );

  -- 8. Insert admin audit log
  insert into public.admin_audit_logs (
    id, admin_user_id, admin_username, action, target_type, target_key, old_value, new_value, reason, created_at
  ) values (
    v_audit_id,
    p_admin_user_id,
    v_admin_username,
    'unfreeze_account',
    'user',
    p_target_user_id::text,
    jsonb_build_object('status', v_old_status, 'riskScore', v_user.risk_score),
    v_result,
    p_notes,
    v_now
  );

  return v_result;
end;
$$;

-- 8. Permissions
revoke all on function public.empire_admin_update_config(text, jsonb, uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.empire_admin_update_config(text, jsonb, uuid, text, uuid, text) to service_role;

revoke all on function public.empire_admin_get_audit_logs(int, int, text) from public, anon, authenticated;
grant execute on function public.empire_admin_get_audit_logs(int, int, text) to service_role;

revoke all on function public.empire_admin_get_flagged_accounts(int, int) from public, anon, authenticated;
grant execute on function public.empire_admin_get_flagged_accounts(int, int) to service_role;

revoke all on function public.empire_admin_unfreeze_account(uuid, uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.empire_admin_unfreeze_account(uuid, uuid, text, uuid, text) to service_role;

commit;


-- >>> COMPATIBILITY & SEED DATA <<<
alter table public.missions add column if not exists reward_points integer default 375;
update public.missions set reward_points = round(reward_sru_multiplier * 500) where reward_points is null or reward_points = 375;

alter table public.referrals add column if not exists referrer_id uuid;
alter table public.referrals add column if not exists invitee_id uuid;
alter table public.referrals add column if not exists is_qualified boolean default false;
alter table public.referrals add column if not exists qualified_at timestamptz;

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
    select id into new.business_slug from public.businesses where slug = new.business_slug;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sync_player_businesses_slug on public.player_businesses;
create trigger trg_sync_player_businesses_slug
  before insert or update on public.player_businesses
  for each row execute function public.sync_player_businesses_slug();

alter table public.reward_ledger drop constraint if exists reward_ledger_idempotency_key_check;

insert into public.seasons (id, name, status, starts_at, ends_at, sru_snapshot, qap_snapshot)
values ('00000000-0000-0000-0000-000000000001', 'Genesis Season', 'active', now() - interval '1 day', now() + interval '30 days', 500, 100)
on conflict do nothing;
