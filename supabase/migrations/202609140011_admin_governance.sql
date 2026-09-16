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
