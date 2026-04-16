# OpenDeploy

OpenDeploy is an open-source deployment platform. **Phase 2** implements a **real build pipeline** (repo checkout + BuildKit image build + artifact metadata + audit trail) while still **not** exposing any public routing to customer workloads.

## Stack

- **Monorepo**: pnpm workspaces, TypeScript (strict)
- **Web**: Next.js (App Router), Tailwind, Clerk, minimal shadcn-style UI primitives
- **API**: NestJS, Prisma, PostgreSQL, Redis, BullMQ
- **Worker**: Node + BullMQ consumer that performs repo checkout + BuildKit builds and reports status/logs via internal APIs
- **Local infra**: Docker Compose for Postgres + Redis (`infra/docker/docker-compose.yml`)

## Quick start

### 1) Start databases (Postgres + Redis)

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

### 2) Configure environment

Copy `.env.example` to `.env` at the repo root for API defaults, and create `apps/web/.env.local` for Next.js + Clerk **publishable** key.

Required highlights:

- `DATABASE_URL`, `REDIS_URL`
- `CLERK_SECRET_KEY` (API + web server)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (web)
- `INTERNAL_API_SECRET` (long random string; shared with worker)
- `API_PUBLIC_URL` (worker uses this to call back into the API)

Build pipeline (Phase 2):

- `GITHUB_APP_ID` + `GITHUB_APP_PRIVATE_KEY` (GitHub App auth for installation tokens)
- Worker must have `git` and `docker buildx` available (Docker Desktop on dev machines is fine)
- Optional worker config:
  - `BUILD_TIMEOUT_MS` (default 20 minutes)
  - `DOCKERFILE_PATH` (default `Dockerfile`)
  - `BUILD_CONTEXT_PATH` (default `.`)
  - `REGISTRY_PUSH_ENABLED` (`true`/`false`)
  - `REGISTRY_REPOSITORY` (required if pushing)

### 3) Migrate / generate

```bash
pnpm install
pnpm db:push
```

### 4) Run services (three terminals)

```bash
pnpm dev:api
pnpm dev:web
pnpm dev:worker
```

Open `http://localhost:3000`.

> **Note:** `apps/web` middleware intentionally **disables Clerk protection when Clerk keys are missing** so `next build` can run in CI without secrets. **Do not ship production without setting Clerk keys.**

### Optional seed

Set `SEED_CLERK_USER_ID` to your Clerk user id, then:

```bash
pnpm db:seed
```

## Workspace bootstrap

Create a workspace via API (after you can obtain a Clerk session token), or insert via Prisma Studio. The dashboard lists workspaces returned by `GET /workspaces`.

Creating a **project** via UI/API auto-creates `preview` and `production` environments.

## Tests

```bash
pnpm test
pnpm --filter @opendeploy/api build
pnpm --filter @opendeploy/web build
```

## Documentation

- `docs/architecture/phase-1.md`
- `docs/architecture/phase-2.md`
- `docs/security/threat-model-phase-1.md`
- `docs/security/worker-isolation-phase-2.md`
- `docs/adr/` — key architectural decisions

## Phase 3+ (remaining work)

- Stronger worker sandboxing (rootless BuildKit, explicit network policy, resource limits)
- Preview URL routing and edge (Caddy-first) TLS
- GitHub webhook → deployment automation with branch allowlists for production
- Clerk webhooks (user lifecycle) wired end-to-end
- Object storage for artifacts/logs, autoscaling workers, billing, custom domains
- Sentry + centralized metrics
