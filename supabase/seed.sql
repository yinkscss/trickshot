-- Local dev seed data (loaded by `supabase db reset`, see supabase/config.toml
-- [db.seed]). Not applied to hosted/staging projects.

insert into public.powerup_skus (id, name, price_cents, active) values
  ('aim_assist', 'Aim Assist', 99, true),
  ('slow_drop', 'Slow Drop', 79, true),
  ('wide_hoop', 'Wide Hoop', 129, true),
  ('magnet_star', 'Magnet Star', 149, true)
on conflict (id) do nothing;
