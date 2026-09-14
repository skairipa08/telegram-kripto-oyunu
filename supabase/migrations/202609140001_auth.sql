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
