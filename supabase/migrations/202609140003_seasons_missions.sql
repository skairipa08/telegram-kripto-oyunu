begin;

-- Seasons Model
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 64),
  status text not null default 'upcoming' check (status in ('upcoming', 'active', 'frozen', 'ended')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  sru_snapshot integer not null default 500 check (sru_snapshot >= 100 and sru_snapshot <= 500),
  qap_snapshot integer not null default 100 check (qap_snapshot >= 0),
  config_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- Seed Genesis Season 1
insert into public.seasons (name, status, starts_at, ends_at, sru_snapshot, qap_snapshot)
values ('Genesis Season', 'active', now(), now() + interval '30 days', 500, 100);

-- Season Scores per Player
create table public.season_scores (
  season_id uuid not null references public.seasons(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  points bigint not null default 0 check (points >= 0),
  mission_points bigint not null default 0 check (mission_points >= 0),
  referral_points bigint not null default 0 check (referral_points >= 0),
  updated_at timestamptz not null default now(),
  primary key (season_id, user_id)
);
create index season_scores_leaderboard_idx on public.season_scores(season_id, points desc);

-- Canonical Mission Definitions Pool
create table public.missions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9_]{1,64}$'),
  difficulty text not null check (difficulty in ('easy', 'normal', 'hard', 'weekly')),
  title text not null check (length(title) between 1 and 128),
  description text not null check (length(description) between 1 and 256),
  target integer not null check (target > 0),
  reward_sru_multiplier numeric(4, 2) not null check (reward_sru_multiplier > 0),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.missions (key, difficulty, title, description, target, reward_sru_multiplier) values
  ('upgrade_any_3', 'easy', 'Hızlı Yatırım', 'Herhangi bir işletmeyi 3 kez yükselt', 3, 0.75),
  ('claim_cash_2', 'easy', 'Tahsilat Zamanı', 'İşletmelerden 2 kez gelir topla', 2, 0.75),
  ('view_friends', 'easy', 'Ağını Genişlet', 'Arkadaşlar sekmesini ziyaret et', 1, 0.75),
  ('upgrade_any_10', 'normal', 'Büyüme Dalgası', 'Toplam 10 kez işletme yükseltmesi yap', 10, 1.00),
  ('reach_milestone', 'normal', 'Dönüm Noktası', 'Bir işletmeyi seviye dönüm noktasına (10, 25, 50 vb.) ulaştır', 1, 1.00),
  ('claim_cash_5', 'normal', 'Düzenli Gelir', '5 kez gelir topla', 5, 1.00),
  ('claim_offline_4h', 'hard', 'Büyük Hasat', 'En az 4 saatlik çevrimdışı birikmiş kazancı tek seferde topla', 1, 1.25),
  ('upgrade_factory_tier', 'hard', 'Sanayi Devrimi', 'Fabrika veya üst düzey bir işletmeyi en az 1 kez yükselt', 1, 1.25),
  ('weekly_complete_15_dailies', 'weekly', 'Haftalık Azim', 'Hafta boyunca toplam 15 günlük görevi başarıyla tamamla', 15, 5.00);

-- Player Assigned Mission Instances
create table public.mission_instances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  mission_id uuid not null references public.missions(id),
  progress integer not null default 0 check (progress >= 0),
  target integer not null check (target > 0),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'claimed')),
  assigned_date date not null default current_date,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, mission_id, assigned_date),
  check ((status = 'claimed' and claimed_at is not null) or (status <> 'claimed' and claimed_at is null))
);
create index mission_instances_user_date_idx on public.mission_instances(user_id, assigned_date);

-- Daily Streak State
create table public.player_streaks (
  user_id uuid primary key references public.users(id) on delete cascade,
  current_streak integer not null default 0 check (current_streak >= 0 and current_streak <= 7),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_claim_date date,
  updated_at timestamptz not null default now()
);

-- Row Level Security
alter table public.seasons enable row level security;
alter table public.season_scores enable row level security;
alter table public.missions enable row level security;
alter table public.mission_instances enable row level security;
alter table public.player_streaks enable row level security;

revoke all on public.seasons, public.season_scores, public.missions, public.mission_instances, public.player_streaks from public, anon, authenticated;
grant select, insert, update on public.seasons, public.season_scores, public.missions, public.mission_instances, public.player_streaks to service_role;

commit;
