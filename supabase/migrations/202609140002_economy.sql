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
