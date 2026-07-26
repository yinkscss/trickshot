# Infra stubs

Hosting lock: **AWS/GCP + Cloudflare** for the PWA edge (`hosting=aws_cf`).  
Backend lock: **Supabase** (`backend=supabase`) for Postgres + Edge Functions.

## Planned surfaces

| Surface | Role | Phase |
|---|---|---|
| Cloudflare | CDN, DNS, WAF, PWA asset edge | Alpha staging |
| Supabase | Postgres, migrations, Edge Functions, storage | Alpha |
| Goldsky | Subgraphs + Mirror for tournament escrow events | Beta |

## Alpha checklist

1. Supabase project (local via CLI + hosted staging project).
2. Wire `VITE_SUPABASE_URL` / anon key / service role (Edge only) from `.env.example`.
3. Static `apps/web` build on Cloudflare Pages (or S3 + CloudFront).
4. Celo Sepolia RPC via private provider in prod staging (Forno OK for local).
5. Do **not** provision Redis — removed from stack lock.

## Goldsky (Beta+)

Placeholder config lives in `infra/goldsky/`. Do not wire mainnet indexing until escrow events are final.
