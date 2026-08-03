-- Migration: 20260802_continue_purchases.sql
-- Issue #52: Continue purchase confirm Edge Function & ledger (idempotent)
--
-- Product & legal constraints:
--   - legal=no_continue_tourney (TOURNAMENT_ALLOWS_CONTINUES === false)
--   - Continues banned in tournament mode (and challenges mode per mode rules)
--   - Idempotent on (tx_hash, log_index)

-- ---------------------------------------------------------------------------
-- 1. continue_intents
-- ---------------------------------------------------------------------------
create table public.continue_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  run_id uuid references public.runs (id) on delete set null,
  mode text not null check (mode in ('casual', 'daily', 'tournament', 'challenges')),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'expired')),
  tx_hash text,
  expires_at timestamptz not null default (now() + interval '1 hour'),
  created_at timestamptz not null default now()
);

comment on table public.continue_intents is
  'Pre-tx continue intent (issue #52). Anchors purchase to authenticated user '
  'before broadcasting ContinuePurchased tx on Celo. Expires after 1 hour.';

create index continue_intents_user_status_idx
  on public.continue_intents (user_id, status, expires_at desc);

alter table public.continue_intents enable row level security;
grant select, insert, update, delete on public.continue_intents to service_role;

-- ---------------------------------------------------------------------------
-- 2. continue_purchases
-- ---------------------------------------------------------------------------
create table public.continue_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  run_id uuid references public.runs (id) on delete set null,
  mode text not null check (mode in ('casual', 'daily', 'tournament', 'challenges')),
  tx_hash text not null,
  log_index integer not null check (log_index >= 0),
  payment_token text,
  price text,
  status text not null default 'confirmed',
  created_at timestamptz not null default now()
);

comment on table public.continue_purchases is
  'Confirmed on-chain continue purchases ledger (issue #52). '
  '(tx_hash, log_index) pair ensures idempotency.';

-- Idempotency constraint: unique (tx_hash, log_index)
create unique index if not exists continue_purchases_tx_log_idx
  on public.continue_purchases (tx_hash, log_index);

create index continue_purchases_user_idx
  on public.continue_purchases (user_id, run_id, created_at desc);

alter table public.continue_purchases enable row level security;
grant select, insert, update on public.continue_purchases to service_role;

-- ---------------------------------------------------------------------------
-- 3. RPC: confirm_continue_purchase(...)
-- ---------------------------------------------------------------------------
create or replace function public.confirm_continue_purchase(
  p_intent_id uuid,
  p_user_id uuid,
  p_run_id uuid,
  p_mode text,
  p_tx_hash text,
  p_log_index integer,
  p_payment_token text,
  p_price text
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_continue_id uuid;
begin
  -- Insert into continue_purchases
  insert into public.continue_purchases (
    user_id, run_id, mode, tx_hash, log_index, payment_token, price, status
  )
  values (
    p_user_id, p_run_id, p_mode, p_tx_hash, p_log_index, p_payment_token, p_price, 'confirmed'
  )
  returning id into v_continue_id;

  -- Mark intent confirmed if intent_id passed
  if p_intent_id is not null then
    update public.continue_intents
    set status = 'confirmed', tx_hash = p_tx_hash
    where id = p_intent_id and user_id = p_user_id;
  end if;

  return v_continue_id;
end;
$$;

comment on function public.confirm_continue_purchase is
  'Atomic confirm of continue purchase: inserts into continue_purchases and updates intent status. SECURITY DEFINER.';

grant execute on function public.confirm_continue_purchase to service_role;