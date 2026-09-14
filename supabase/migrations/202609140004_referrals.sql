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
