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

