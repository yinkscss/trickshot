-- Issue #9: Powerup catalog + inventory (shop data plane)
-- Extends the init_schema stubs with the full purchase/confirm/use flow.
--
-- What init_schema already created:
--   powerup_skus  — catalog (price_cents, active)
--   inventory     — per-user balances (user_id, sku, quantity)
--   purchases     — purchase ledger stub (tx_hash nullable, no log_index)
--
-- This migration adds:
--   1. on_chain_sku_id column on powerup_skus (uint256 → bigint mapping)
--   2. log_index + payment_token on purchases + (tx_hash, log_index) UNIQUE
--   3. purchase_intents — pre-tx intent records (idempotency anchor)
--   4. inventory_use_log — append-only powerup consumption audit
--   5. RPCs: active_powerup_catalog(), user_inventory(uuid)
--   6. Grants on new tables

-- ---------------------------------------------------------------------------
-- 1. powerup_skus: add on-chain SKU ID mapping
-- ---------------------------------------------------------------------------
-- PowerupShop.sol uses uint256 skuId (numeric). The DB uses text IDs.
-- This column maps them: aim_assist=1, slow_drop=2, wide_hoop=3, magnet_star=4.
-- purchase-confirm validates the decoded PowerupPurchased.skuId against this.

alter table public.powerup_skus
  add column if not exists on_chain_sku_id bigint;

comment on column public.powerup_skus.on_chain_sku_id is
  'Numeric skuId used by PowerupShop.sol (uint256). Maps the text SKU key '
  'to the on-chain identifier so purchase-confirm can validate the decoded '
  'PowerupPurchased event. Null = not yet deployed on-chain.';

-- Seed the on-chain IDs for the Alpha SKUs (matches contract setSku calls)
update public.powerup_skus set on_chain_sku_id = 1 where id = 'aim_assist';
update public.powerup_skus set on_chain_sku_id = 2 where id = 'slow_drop';
update public.powerup_skus set on_chain_sku_id = 3 where id = 'wide_hoop';
update public.powerup_skus set on_chain_sku_id = 4 where id = 'magnet_star';

-- ---------------------------------------------------------------------------
-- 2. purchases: add log_index + payment_token + idempotency constraint
-- ---------------------------------------------------------------------------
-- PowerupPurchased(buyer, skuId, amount, unitPrice, totalPrice, paymentToken, ts)
-- The (tx_hash, log_index) pair uniquely identifies one event in one tx.
-- Duplicate confirm with same pair → no-op (idempotent).

alter table public.purchases
  add column if not exists log_index integer,
  add column if not exists payment_token text;

comment on column public.purchases.log_index is
  'Log index of the PowerupPurchased event within the tx (0-based). '
  'Combined with tx_hash forms the idempotency key for purchase-confirm.';
comment on column public.purchases.payment_token is
  'ERC-20 contract address used for payment (cUSD/USDC on Celo Sepolia).';

-- Idempotency constraint: same on-chain event → same DB row (no duplicate credits)
-- Partial unique: only when both are non-null (unconfirmed purchases have neither)
create unique index if not exists purchases_tx_log_idx
  on public.purchases (tx_hash, log_index)
  where tx_hash is not null and log_index is not null;

-- ---------------------------------------------------------------------------
-- 3. purchase_intents
-- ---------------------------------------------------------------------------
-- Records the player's intent to buy before the on-chain tx is broadcast.
-- purchase-confirm looks this up by intentId to validate the purchaser's
-- identity and the specific SKU/quantity being confirmed.
-- Prevents: confirming someone else's tx against your account.

create table public.purchase_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  sku text not null references public.powerup_skus (id),
  quantity integer not null default 1 check (quantity > 0),
  price_cents integer not null check (price_cents > 0),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'expired')),
  tx_hash text,
  expires_at timestamptz not null default (now() + interval '1 hour'),
  created_at timestamptz not null default now()
);

comment on table public.purchase_intents is
  'Pre-tx purchase intent (issue #9). Client calls purchase-intent before '
  'broadcasting the on-chain tx. purchase-confirm looks up the intent to '
  'validate buyer identity, SKU, and quantity. Prevents alien-tx replay '
  '(confirming someone else''s tx for your account). Expires after 1 hour.';

create index purchase_intents_user_status_idx
  on public.purchase_intents (user_id, status, expires_at desc);

alter table public.purchase_intents enable row level security;
grant select, insert, update, delete on public.purchase_intents to service_role;

-- ---------------------------------------------------------------------------
-- 4. inventory_use_log
-- ---------------------------------------------------------------------------
-- Append-only audit trail of powerup consumption.
-- Decrements happen on inventory; this table records WHY and for which run.

create table public.inventory_use_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  sku text not null references public.powerup_skus (id),
  quantity integer not null default 1 check (quantity > 0),
  run_id uuid references public.runs (id) on delete set null,
  mode text check (mode in ('casual', 'daily', 'tournament', 'challenges')),
  used_at timestamptz not null default now()
);

comment on table public.inventory_use_log is
  'Append-only log of powerup consumption (issue #9). One row per '
  'inventory-use call. run_id links to the run the powerup was used in '
  '(nullable — not always available at use time). mode is validated as '
  'non-tournament before insertion.';

create index inventory_use_log_user_idx on public.inventory_use_log (user_id, used_at desc);

alter table public.inventory_use_log enable row level security;
grant select, insert on public.inventory_use_log to service_role;

-- ---------------------------------------------------------------------------
-- 5. RLS policies — catalog & inventory (public + per-user reads)
-- ---------------------------------------------------------------------------
-- powerup_skus: active catalog is public (no auth required)
-- Note: Browser reads go through GET /catalog Edge Function (service role),
-- so this policy is for future direct-Supabase reads (e.g. Supabase client SDK).

create policy "active skus readable by anyone"
  on public.powerup_skus for select
  using (active = true);

comment on policy "active skus readable by anyone" on public.powerup_skus is
  'Active SKUs are public — no RNG, no hidden catalog. Inactive SKUs are '
  'never exposed (admin only via service_role).';

-- Grant anon read on powerup_skus for the RLS policy to work
grant select on public.powerup_skus to anon;
grant select on public.powerup_skus to authenticated;

-- inventory: users read their own rows only
-- Our auth model uses custom JWTs (not Supabase JWT), so auth.uid() won't
-- match. For Alpha, inventory reads go through the Edge Function (service role).
-- This policy is a forward-compatibility stub for when we wire auth.uid().
create policy "users read own inventory"
  on public.inventory for select
  using (true);  -- Alpha stub: relaxed until Supabase JWT integration

comment on policy "users read own inventory" on public.inventory is
  'Alpha stub — effective access is gated by the Edge Function requireAuth(). '
  'Once Supabase JWT is integrated, tighten to: auth.uid()::text = user_id::text';

-- Grant authenticated role read on inventory
grant select on public.inventory to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Catalog RPC — active_powerup_catalog()
-- ---------------------------------------------------------------------------
create or replace function public.active_powerup_catalog()
returns table (
  id text,
  name text,
  price_cents integer,
  on_chain_sku_id bigint
)
language sql stable security definer
set search_path = public
as $$
  select id, name, price_cents, on_chain_sku_id
  from public.powerup_skus
  where active = true
  order by price_cents asc;
$$;

comment on function public.active_powerup_catalog() is
  'Returns all active powerup SKUs sorted by price. SECURITY DEFINER so '
  'anon callers can read without service role. No random rolls — fixed '
  'price/effect catalog only (STACK_LOCK: monetization=continue_powerup).';

-- ---------------------------------------------------------------------------
-- 7. Inventory RPC — user_inventory(uuid)
-- ---------------------------------------------------------------------------
-- Called from Edge Functions (which pass the verified userId from the JWT).
-- Not exposed directly to the browser.

create or replace function public.user_inventory(p_user_id uuid)
returns table (sku text, quantity integer)
language sql stable security definer
set search_path = public
as $$
  select i.sku, i.quantity
  from public.inventory i
  where i.user_id = p_user_id and i.quantity > 0
  order by i.sku;
$$;

comment on function public.user_inventory(uuid) is
  'Returns non-zero inventory rows for a user. Called from Edge Functions '
  'with the server-verified userId. SECURITY DEFINER.';

-- ---------------------------------------------------------------------------
-- 8. increment_inventory() — atomic upsert for purchase-confirm
-- ---------------------------------------------------------------------------
-- Called by purchase-confirm inside a logical transaction.
-- INSERT ... ON CONFLICT DO UPDATE avoids the read-then-write race that
-- would double-credit concurrent confirms for the same (user, sku).

create or replace function public.increment_inventory(
  p_user_id uuid,
  p_sku text,
  p_quantity integer
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.inventory (user_id, sku, quantity)
  values (p_user_id, p_sku, p_quantity)
  on conflict (user_id, sku)
  do update set
    quantity = public.inventory.quantity + excluded.quantity,
    updated_at = now();
$$;

comment on function public.increment_inventory(uuid, text, integer) is
  'Atomic UPSERT: inserts a new inventory row or increments an existing '
  'one. Used by purchase-confirm to credit powerups after on-chain confirm. '
  'SECURITY DEFINER — called from Edge Functions via supabaseAdmin.rpc().';

-- ---------------------------------------------------------------------------
-- 9. decrement_inventory() — atomic decrement for inventory-use
-- ---------------------------------------------------------------------------
-- Returns the new quantity. Raises an exception if quantity would go negative.

create or replace function public.decrement_inventory(
  p_user_id uuid,
  p_sku text,
  p_quantity integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_qty integer;
begin
  update public.inventory
  set quantity = quantity - p_quantity,
      updated_at = now()
  where user_id = p_user_id
    and sku = p_sku
    and quantity >= p_quantity
  returning quantity into new_qty;

  if new_qty is null then
    raise exception 'insufficient_inventory: user=% sku=% requested=% available=%',
      p_user_id, p_sku, p_quantity,
      coalesce((select quantity from public.inventory where user_id = p_user_id and sku = p_sku), 0)
    using errcode = 'P0001';
  end if;

  return new_qty;
end;
$$;

comment on function public.decrement_inventory(uuid, text, integer) is
  'Atomic decrement for powerup consumption. Raises P0001 if quantity < requested. '
  'Used by inventory-use Edge Function. SECURITY DEFINER.';

grant execute on function public.increment_inventory(uuid, text, integer) to service_role;
grant execute on function public.decrement_inventory(uuid, text, integer) to service_role;
grant execute on function public.active_powerup_catalog() to service_role;
grant execute on function public.active_powerup_catalog() to anon;
grant execute on function public.user_inventory(uuid) to service_role;

