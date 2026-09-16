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
