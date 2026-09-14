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
