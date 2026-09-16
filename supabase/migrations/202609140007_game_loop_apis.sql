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
