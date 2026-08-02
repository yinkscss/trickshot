-- Issue #8: Run score Edge Function + hybrid replay anti-cheat
-- Adds the runs_start_nonces table (server-issued seeds) and
-- the daily_leaderboard() RPC for public board reads.

-- ---------------------------------------------------------------------------
-- runs_start_nonces
-- ---------------------------------------------------------------------------
-- The server mints the run seed on runs-start and records it here.
-- runs-finish looks up the nonce to confirm: the seed was server-issued,
-- it belongs to the submitting user, it has not expired, and it has not been
-- used already. This prevents seed-stuffing attacks where a client submits a
-- runs-finish payload with an arbitrary seed it never played through.
--
-- Lifetime: 2 hours — long enough for any real run; short enough to cap
-- attacker reuse windows. Expired rows are pruned inside runs-finish
-- (DELETE WHERE expires_at < now() AND used = true) to avoid unbounded growth.

create table public.runs_start_nonces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  mode text not null check (mode in ('casual', 'daily', 'tournament', 'challenges')),
  seed text not null,
  expires_at timestamptz not null default (now() + interval '2 hours'),
  used boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.runs_start_nonces is
  'Server-issued run seeds (issue #8). Each POST /runs-start inserts one row. '
  'POST /runs-finish validates that runId exists, belongs to the user, is '
  'unexpired, and marks it used. Prevents seed-stuffing.';

create index runs_start_nonces_user_expires_idx
  on public.runs_start_nonces (user_id, expires_at desc)
  where used = false;

alter table public.runs_start_nonces enable row level security;

-- ---------------------------------------------------------------------------
-- Grants — service_role only (consistent with init_schema.sql posture)
-- ---------------------------------------------------------------------------
grant select, insert, update, delete
  on public.runs_start_nonces
  to service_role;

-- ---------------------------------------------------------------------------
-- daily_leaderboard() — public RPC
-- ---------------------------------------------------------------------------
-- Returns the top N accepted/verified runs for a mode on a given UTC date.
-- SECURITY DEFINER: runs as the function owner (service_role equivalent in
-- Supabase) so it can join public.runs and public.users despite RLS blocking
-- anon/authenticated. The result set is safe to expose — wallet_address is
-- the player's public Celo address, intentionally public on a leaderboard.
--
-- Called by GET /functions/v1/leaderboard without auth (public scores).

create or replace function public.daily_leaderboard(
  p_mode   text,
  p_date   date    default current_date,
  p_limit  integer default 100
)
returns table (
  rank          bigint,
  user_id       uuid,
  wallet_address text,
  score         integer,
  chain_length  integer,
  created_at    timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    row_number() over (order by r.chain_length desc, r.score desc, r.created_at asc) as rank,
    r.user_id,
    u.wallet_address,
    r.score,
    r.chain_length,
    r.created_at
  from public.runs r
  join public.users u on u.id = r.user_id
  where r.mode  = p_mode
    and r.status = 'verified'
    and r.created_at::date = p_date
  order by r.chain_length desc, r.score desc, r.created_at asc
  limit least(p_limit, 500);  -- hard cap: never return more than 500 rows
$$;

comment on function public.daily_leaderboard(text, date, integer) is
  'Returns the top-N verified runs for the given mode on a UTC date. '
  'Sorted by chain_length desc (replay-authoritative), then score desc '
  '(client-declared tiebreak), then created_at asc (first-in wins). '
  'SECURITY DEFINER so anon callers can read without RLS bypass.';
