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
