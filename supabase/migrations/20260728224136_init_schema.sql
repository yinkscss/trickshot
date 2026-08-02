-- Trick Shot backend foundations (issue #6)
-- Stack lock: backend=supabase (docs/STACK_LOCK.md). Wallet login remains
-- Magic.link (wallet=magic) -- Supabase Auth is NOT the primary player login,
-- so these tables are plain `public` schema tables, not tied to `auth.users`.
--
-- Security model (deny-by-default):
--   - RLS is enabled on every table below with ZERO policies for `anon` /
--     `authenticated`. No policies + RLS enabled = those roles get nothing.
--   - No GRANTs are given to `anon` / `authenticated` either (belt and
--     suspenders -- newer Supabase defaults no longer auto-expose new public
--     tables, but we make the denial explicit rather than relying on that).
--   - `service_role` is explicitly GRANTed table access below. It also has
--     BYPASSRLS, so it is the only role that can read/write these tables --
--     and it is only ever used from Supabase Edge Functions, never the
--     browser (the service role key must never ship to the client).
--   - Issue #7 (Magic <-> Supabase session bridge) will add real per-user
--     `authenticated` policies scoped to the bridged identity; until then,
--     all app reads/writes go through Edge Functions using the service role.

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
create table public.users (
  id uuid primary key default gen_random_uuid(),
  magic_issuer text not null unique,
  wallet_address text not null unique,
  created_at timestamptz not null default now()
);

comment on table public.users is
  'Player identity bridged from Magic.link (magic_issuer = Magic DID/issuer, '
  'wallet_address = the provisioned Celo wallet). Not tied to auth.users -- '
  'Supabase Auth is not the primary player login (wallet=magic).';

alter table public.users enable row level security;

-- ---------------------------------------------------------------------------
-- runs
-- ---------------------------------------------------------------------------
create table public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  mode text not null check (mode in ('casual', 'daily', 'tournament', 'challenges')),
  score integer not null default 0 check (score >= 0),
  chain_length integer not null default 0 check (chain_length >= 0),
  seed text not null,
  continues_used integer not null default 0 check (continues_used >= 0),
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  input_log jsonb,
  created_at timestamptz not null default now()
);

comment on table public.runs is
  'One row per finished run. Mirrors @trickshot/shared RunSummary / InputLog. '
  'mode matches the GameMode union in @trickshot/shared. status stays '
  '''pending'' until the hybrid replay verifier (issue #8) confirms or '
  'rejects the attached input_log.';
comment on column public.runs.input_log is
  'Raw serialized InputLog (see packages/shared/src/input-log.ts) for hybrid '
  'server replay. Nullable because not every mode/run records one (Alpha).';

create index runs_user_id_idx on public.runs (user_id);
create index runs_mode_created_at_idx on public.runs (mode, created_at desc);

alter table public.runs enable row level security;

-- ---------------------------------------------------------------------------
-- powerup_skus
-- ---------------------------------------------------------------------------
create table public.powerup_skus (
  id text primary key,
  name text not null,
  price_cents integer not null check (price_cents > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.powerup_skus is
  'Powerup catalog stub (issue #9 fleshes out purchase flow). id is the sku '
  'string used by @trickshot/shared assertCanUsePowerup(mode, sku). Prices '
  'are integer cents (no floats), matching the bps-style convention already '
  'used for on-chain GameEconomics.';

alter table public.powerup_skus enable row level security;

-- ---------------------------------------------------------------------------
-- inventory
-- ---------------------------------------------------------------------------
create table public.inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  sku text not null references public.powerup_skus (id),
  quantity integer not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  unique (user_id, sku)
);

comment on table public.inventory is
  'Per-user powerup balances. One row per (user_id, sku); quantity is '
  'incremented on confirmed purchases and decremented on consumption.';

create index inventory_user_id_idx on public.inventory (user_id);

alter table public.inventory enable row level security;

-- ---------------------------------------------------------------------------
-- purchases
-- ---------------------------------------------------------------------------
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  sku text not null references public.powerup_skus (id),
  quantity integer not null default 1 check (quantity > 0),
  price_cents integer not null check (price_cents >= 0),
  tx_hash text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'failed')),
  created_at timestamptz not null default now()
);

comment on table public.purchases is
  'Purchase ledger stub (issue #9). price_cents snapshots the price paid at '
  'purchase time (independent of later catalog price changes). tx_hash is '
  'nullable -- the on-chain payment reference is wired up alongside the '
  'shop/escrow contracts, not part of this foundational schema.';

create index purchases_user_id_idx on public.purchases (user_id);

alter table public.purchases enable row level security;

-- ---------------------------------------------------------------------------
-- Explicit grants -- service_role only. anon/authenticated get nothing.
-- ---------------------------------------------------------------------------
grant usage on schema public to service_role;

grant select, insert, update, delete on
  public.users,
  public.runs,
  public.powerup_skus,
  public.inventory,
  public.purchases
to service_role;
