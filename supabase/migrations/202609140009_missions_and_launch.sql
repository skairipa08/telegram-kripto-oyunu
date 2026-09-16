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
