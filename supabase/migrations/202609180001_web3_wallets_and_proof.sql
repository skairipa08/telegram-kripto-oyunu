-- =============================================================================
-- Migration: 202609180001_web3_wallets_and_proof.sql
-- Description: Production-grade TON Wallets, Cryptographic Nonces, and Airdrop Claims
-- =============================================================================

begin;

-- 1. Table: public.user_wallets
-- Enforces 1-wallet-per-account and 1-account-per-wallet (Anti-Sybil invariant)
create table if not exists public.user_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  address text not null, -- Canonical representation: workchain:accountHash (e.g. 0:abcdef...)
  friendly_address text not null, -- User-facing representation (e.g. EQC... or UQC...)
  wallet_provider text not null default 'generic',
  public_key text,
  verified boolean not null default true,
  is_locked boolean not null default false, -- Locked once snapshot is taken
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_user_wallets_user_id unique (user_id),
  constraint uq_user_wallets_canonical_address unique (address)
);

create index if not exists user_wallets_address_idx on public.user_wallets(address);
create index if not exists user_wallets_user_id_idx on public.user_wallets(user_id);

-- 2. Table: public.auth_nonces
-- High-entropy single-use cryptographic challenges with atomic consumption
create table if not exists public.auth_nonces (
  id uuid primary key default gen_random_uuid(),
  nonce_id text not null,
  user_id uuid not null references public.users(id) on delete cascade,
  purpose text not null check (purpose in ('LINK_WALLET', 'AUTH', 'AIRDROP_CLAIM')),
  consumed boolean not null default false,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  constraint uq_auth_nonces_nonce_id unique (nonce_id)
);

create index if not exists auth_nonces_lookup_idx on public.auth_nonces(nonce_id, user_id, purpose, consumed, expires_at);

-- 3. Table: public.airdrop_claims
-- Idempotent, tamper-proof airdrop token allocation claims per season
create table if not exists public.airdrop_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  season_id text not null,
  canonical_address text not null,
  points bigint not null check (points >= 0),
  tier text not null check (tier in ('Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze')),
  claimed_at timestamptz not null default now(),
  constraint uq_airdrop_claims_user_season unique (user_id, season_id),
  constraint uq_airdrop_claims_address_season unique (canonical_address, season_id)
);

create index if not exists airdrop_claims_lookup_idx on public.airdrop_claims(user_id, season_id);

-- 4. Stored Procedure: Atomic Nonce Consumption
create or replace function public.empire_consume_nonce(
  p_nonce_id text,
  p_user_id uuid,
  p_purpose text
) returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_updated record;
begin
  update public.auth_nonces
  set consumed = true,
      consumed_at = now()
  where nonce_id = p_nonce_id
    and user_id = p_user_id
    and purpose = p_purpose
    and consumed = false
    and expires_at > now()
  returning id, nonce_id into v_updated;

  if not found then
    return jsonb_build_object('success', false, 'error', 'NONCE_INVALID_OR_CONSUMED');
  end if;

  return jsonb_build_object('success', true);
end;
$$;

-- 5. Stored Procedure: Atomic Wallet Connection with Sybil Detection
create or replace function public.empire_connect_wallet(
  p_user_id uuid,
  p_canonical_address text,
  p_friendly_address text,
  p_provider text default 'generic',
  p_public_key text default null
) returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_existing record;
begin
  -- Check if this canonical address is already held by another user
  select user_id into v_existing
  from public.user_wallets
  where address = p_canonical_address
  for update;

  if found and v_existing.user_id <> p_user_id then
    return jsonb_build_object(
      'success', false,
      'code', 'WALLET_ALREADY_LINKED',
      'error', 'Bu TON cüzdanı başka bir hesaba zaten bağlanmış (Sybil koruması).'
    );
  end if;

  -- Upsert for current user
  insert into public.user_wallets (
    user_id, address, friendly_address, wallet_provider, public_key, verified, updated_at
  ) values (
    p_user_id, p_canonical_address, p_friendly_address, p_provider, p_public_key, true, now()
  )
  on conflict (user_id) do update set
    address = excluded.address,
    friendly_address = excluded.friendly_address,
    wallet_provider = excluded.wallet_provider,
    public_key = coalesce(excluded.public_key, user_wallets.public_key),
    verified = true,
    updated_at = now()
  where user_wallets.is_locked = false;

  if not found then
    return jsonb_build_object(
      'success', false,
      'code', 'WALLET_LOCKED',
      'error', 'Cüzdan kilitlenmiştir ve artık değiştirilemez.'
    );
  end if;

  return jsonb_build_object('success', true);
end;
$$;

commit;
