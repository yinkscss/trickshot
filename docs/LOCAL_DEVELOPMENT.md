# Local Development Walkthrough

This guide gets the Trick Shot monorepo running on Windows. It covers the browser game first, then the optional local Supabase backend and Foundry contracts.

## 1. What you need

### Required for the browser client

- Windows 10 or later
- Git, including support for submodules
- Node.js `>=20`
- npm `10`
- A Chromium, Firefox, or Edge browser
- Internet access for npm packages and the remote Celo Sepolia RPC used by default

Check the versions from PowerShell:

```powershell
git --version
node --version
npm --version
```

### Required only for local backend development

- Docker Desktop, running with Linux containers
- Supabase CLI, invoked through `npx supabase`
- At least several GB of free disk space for the local Postgres, Auth, Studio, and storage containers

The local Supabase stack uses API port `54321`, database port `54322`, Studio port `54323`, and email testing UI port `54324`. Stop other services using these ports before starting Supabase.

### Required only for smart-contract work

- Foundry (`forge`, `cast`, and `anvil`)
- The repository submodules initialized under `contracts/lib`
- A funded Celo Sepolia account only for testnet deployment
- A Blockscout API key only for contract verification

Do not use a mainnet private key for local development or Alpha testing.

## 2. Clone and install

Open PowerShell and run from the repository root:

```powershell
git clone <repository-url>
Set-Location trickshot
git submodule update --init --recursive
npm ci
```

Use `npm ci` because the repository includes `package-lock.json`. Use `npm install` only when intentionally changing dependencies.

Build the workspace packages once so dependent packages can resolve their generated declarations:

```powershell
npm run build
```

## 3. Configure environment variables

Copy the root template. In PowerShell:

```powershell
Copy-Item .env.example .env
```

The root `.env` is ignored by Git. Never commit it or place private keys, Magic secrets, Supabase service-role keys, or signing secrets in `VITE_*` variables.

### Minimum client configuration

For the client, set these values in `.env`:

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<value-from-supabase-status-or-staging>
VITE_MAGIC_PUBLISHABLE_KEY=<Magic-publishable-key>
VITE_CELO_CHAIN_ID=11142220
VITE_CELO_RPC_URL=https://forno.celo-sepolia.celo-testnet.org
```

The canvas game can be opened before Magic and Supabase are configured, but sign-in, authenticated runs, purchases, and server-backed features need valid values. The browser must only receive public `VITE_*` values and the Supabase anon key.

### Full local backend configuration

After Supabase starts, run:

```powershell
npx supabase status
```

Copy the local API URL, anon/publishable key, and service-role/secret key into the matching variables in `.env`:

```dotenv
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<local-anon-or-publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<local-service-role-or-secret-key>
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<same-public-local-key>
RUN_SIGNING_SECRET=dev-only-change-me
```

For local Magic authentication, also set `MAGIC_SECRET_KEY` and `VITE_MAGIC_PUBLISHABLE_KEY` from a Magic sandbox application. `MAGIC_SECRET_KEY` is server-only and must never be exposed to the browser.

## 4. Run the browser game

From the repository root:

```powershell
npm run dev:web
```

Open the URL printed by Vite, normally `http://localhost:5173` or `http://127.0.0.1:5173`.

The web client is a vanilla TypeScript Canvas2D app. Its gameplay authority is the custom physics and logic packages; Phaser is not required.

To stop the dev server, press `Ctrl+C` in its terminal.

## 5. Run the local Supabase backend

Start Docker Desktop first, then from the repository root:

```powershell
npm run build:edge
npx supabase start
npx supabase status
```

The Edge build is required because function import maps resolve the generated files in `packages/*/dist`. The first start downloads the local images and applies the migrations and seed data. The seed creates the initial `powerup_skus` catalog.

Every migration filename must have a unique numeric version prefix. If Supabase reports a duplicate `schema_migrations_pkey` version, rename the newer migration with the next available timestamp before starting again.

If `.env` was created before Supabase started, update the Supabase values using the output from `npx supabase status`.

Reset the local database when you need a clean schema and seed state:

```powershell
npm run supabase:reset
```

Serve Edge Functions locally in a separate terminal:

```powershell
npx supabase functions serve
```

The Edge Functions use the custom Magic-to-Supabase session flow. Supabase Auth is not the primary player login. See [`supabase/README.md`](../supabase/README.md) for the auth, replay, and function details.

When finished, stop the local stack with:

```powershell
npx supabase stop
```

## 6. Build and validate the TypeScript app

Run the narrowest relevant check first:

```powershell
# Build all shared, physics, logic, and web packages
npm run build

# Typecheck all shared, physics, logic, and web packages
npm run typecheck

# Unit tests for packages and web
npm test

# Production web build and PWA verification
npm run build:web

# Serve the production build locally
npm run preview -w @trickshot/web
```

The production build writes to `apps/web/dist/`. Do not hand-edit the generated service worker; change its source configuration in `apps/web/vite.config.ts`.

Run Edge Function tests without requiring a running Supabase stack:

```powershell
npm run test:edge
```

## 7. Build and test contracts

Check Foundry is installed:

```powershell
forge --version
cast --version
```

Initialize the OpenZeppelin and forge-std submodules if you did not already do so:

```powershell
git submodule update --init --recursive
```

Build and test without deploying:

```powershell
npm run contracts:build
npm run contracts:test
```

The Alpha network is Celo Sepolia, chain ID `11142220`, not Celo mainnet. Contract deployment additionally needs the variables in [`contracts/.env.example`](../contracts/.env.example), including `PRIVATE_KEY`, `DEPLOY_OWNER`, `TREASURY_ADDRESS`, and `PAYMENT_TOKEN`.

Dry-run a Sepolia deployment before broadcasting:

```powershell
npm run contracts:deploy:sepolia:dry
```

Only broadcast after checking the script output and wallet/network configuration:

```powershell
npm run contracts:deploy:sepolia
```

Deployments write JSON output under `contracts/deployments/`. Treat those files as deployment artifacts and do not commit private keys or secrets.

## 8. Optional screenshot and PWA checks

The screenshot helper expects a running web server and Playwright's Chromium browser:

```powershell
node scripts/capture-pitch-screens.mjs http://127.0.0.1:5173
node scripts/verify-pwa.mjs
```

For a real PWA/MiniPay check, use an HTTPS deployment or a device-accessible preview and follow the checklist in [`apps/web/README.md`](../apps/web/README.md).

## 9. One-command verification sequence

For a normal code change, this is the recommended order:

```powershell
npm ci
npm run build
npm run typecheck
npm test
npm run build:web
npm run test:edge
npm run contracts:test
```

The full sequence does not require Docker unless the change needs live Supabase integration. Contract tests require Foundry and initialized submodules.

## 10. Common problems

### `npm` or Node version errors

Install Node.js 20 or newer, reopen PowerShell, and check `node --version` and `npm --version` again. Use the repository root, not an individual workspace directory, for `npm ci`.

### `supabase start` cannot connect

Start Docker Desktop, confirm it is using Linux containers, and check that ports `54321` through `54324` are free. Then retry `npx supabase start`.

### `supabase start` cannot find a package under `supabase/packages`

Run `npm run build:edge` and confirm Edge Function import maps use `../../../packages/...` paths. Function import maps are relative to `supabase/functions/<function>/`, so `../../packages/...` incorrectly points inside `supabase/`.

### Supabase reports a duplicate migration version

Ensure every file in `supabase/migrations/` starts with a unique numeric prefix. Rename the newer migration, preserving its SQL, and retry the local start.

### The browser reports missing Supabase variables

Confirm the file is named exactly `.env`, is at the repository root, and contains `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Restart Vite after changing environment variables.

### Magic login fails

Set both `VITE_MAGIC_PUBLISHABLE_KEY` for the browser and `MAGIC_SECRET_KEY` for the `auth-magic` Edge Function. A placeholder key is enough to boot the UI but not to authenticate.

### Contract receipt verification uses the wrong network

Use Celo Sepolia chain ID `11142220` for Alpha. Any environment using the obsolete Alfajores ID `44787` must be corrected before testing a purchase or continue confirmation.

## References

- [Repository README](../README.md)
- [Stack lock](./STACK_LOCK.md)
- [Contributing guide](../CONTRIBUTING.md)
- [Web client README](../apps/web/README.md)
- [Supabase README](../supabase/README.md)
- [Contracts README](../contracts/README.md)
- [Infrastructure and staging README](../infra/README.md)
