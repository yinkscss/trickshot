-- Migration: 20260801_challenge_progress.sql
-- Issue #43: Challenge progress + per-level stars persistence (Supabase backend)
--
-- Product decisions (2026-07-27):
--   1. Challenges are a 4th GameMode ("challenges")
--   2. Persistence target is Supabase challenge_progress table (not localStorage-only)
--   3. Challenge per-level stars (0-3) are separate from endless soft-currency stars

create table public.challenge_progress (
  user_id uuid not null references public.users (id) on delete cascade,
  level_index integer not null check (level_index >= 0),
  cleared boolean not null default false,
  stars integer not null default 0 check (stars >= 0 and stars <= 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, level_index)
);

comment on table public.challenge_progress is
  'Per-user level progress for challenges mode (issue #43). Stores cleared status '
  'and best star count collected per level (0-3).';

comment on column public.challenge_progress.level_index is
  '0-indexed challenge level number (0 to CHALLENGE_LEVEL_COUNT - 1).';
comment on column public.challenge_progress.cleared is
  'True if the user has successfully cleared this challenge level.';
comment on column public.challenge_progress.stars is
  'Best star count (0-3) earned on this level. Independent of endless soft currency.';

create index challenge_progress_user_idx
  on public.challenge_progress (user_id, level_index);

alter table public.challenge_progress enable row level security;
grant select, insert, update, delete on public.challenge_progress to service_role;

-- ---------------------------------------------------------------------------
-- RPC: get_user_challenge_progress(uuid)
-- ---------------------------------------------------------------------------
create or replace function public.get_user_challenge_progress(p_user_id uuid)
returns table (
  level_index integer,
  cleared boolean,
  stars integer
)
language sql stable security definer
set search_path = public
as $$
  select level_index, cleared, stars
  from public.challenge_progress
  where user_id = p_user_id
  order by level_index asc;
$$;

comment on function public.get_user_challenge_progress(uuid) is
  'Returns all challenge level progress rows for a user sorted by level_index. SECURITY DEFINER.';

-- ---------------------------------------------------------------------------
-- RPC: upsert_challenge_progress(uuid, integer, boolean, integer)
-- ---------------------------------------------------------------------------
create or replace function public.upsert_challenge_progress(
  p_user_id uuid,
  p_level_index integer,
  p_cleared boolean,
  p_stars integer
)
returns table (
  level_index integer,
  cleared boolean,
  stars integer
)
language plpgsql security definer
set search_path = public
as $$
declare
  res_cleared boolean;
  res_stars integer;
begin
  insert into public.challenge_progress (user_id, level_index, cleared, stars)
  values (p_user_id, p_level_index, p_cleared, p_stars)
  on conflict (user_id, level_index)
  do update set
    cleared = public.challenge_progress.cleared or excluded.cleared,
    stars = greatest(public.challenge_progress.stars, excluded.stars),
    updated_at = now();

  select c.cleared, c.stars into res_cleared, res_stars
  from public.challenge_progress c
  where c.user_id = p_user_id and c.level_index = p_level_index;

  return query select p_level_index, res_cleared, res_stars;
end;
$$;

comment on function public.upsert_challenge_progress(uuid, integer, boolean, integer) is
  'Atomic UPSERT: inserts or updates level progress for a user. Retains cleared=true '
  'once cleared, and updates stars to max(existing, new). SECURITY DEFINER.';

grant execute on function public.get_user_challenge_progress(uuid) to service_role;
grant execute on function public.upsert_challenge_progress(uuid, integer, boolean, integer) to service_role;
