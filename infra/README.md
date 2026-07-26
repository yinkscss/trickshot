# Infra stubs

Hosting lock: **AWS/GCP + Cloudflare** (`hosting=aws_cf`).

## Planned surfaces

| Surface | Role | Phase |
|---|---|---|
| Cloudflare | CDN, DNS, WAF, PWA asset edge | Alpha staging |
| AWS or GCP | API compute + managed Postgres + Redis | Alpha |
| Goldsky | Subgraphs + Mirror for tournament escrow events | Beta |

## Alpha checklist

1. Staging API behind Cloudflare (TLS + cache bypass for `/health` and score APIs).
2. Postgres + Redis provisioned; wire `DATABASE_URL` / `REDIS_URL` from `.env.example`.
3. Static `apps/web` build on Cloudflare Pages (or S3 + CloudFront).
4. Celo Sepolia RPC via private provider in prod staging (Forno OK for local).

## Goldsky (Beta+)

Placeholder config lives in `infra/goldsky/`. Do not wire mainnet indexing until escrow events are final.
