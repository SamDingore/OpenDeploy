# OpenDeploy

OpenDeploy is an open-source deployment platform. **Phase 2** implements a **real build pipeline** (repo checkout + BuildKit image build + artifact metadata + audit trail). **Phase 3** adds **runtime releases**, **health-gated routing**, **PR previews**, **production activation**, **rollback**, and a **Caddy** edge. **Phase 4** adds **production custom domains** with **DNS verification**, **queue-driven issuance**, and **DB-gated** edge configuration (still no raw tenant Caddyfiles). **Phase 5** focuses on **hardening and operations**: **node pools** and worker posture (**rootless** hints, **runner class**), **OpenTelemetry** + **BullMQ trace carriers**, **workspace quotas**, **reconciliation** jobs, **edge config versioning** (prefer **Caddy admin over Unix socket**), and an **Operations** dashboard for admins.

## Stack

- **Monorepo**: pnpm workspaces, TypeScript (strict)
- **Web**: Next.js (App Router), Tailwind, Clerk, minimal shadcn-style UI primitives
- **API**: NestJS, Prisma, PostgreSQL, Redis, BullMQ
- **Worker**: Node + BullMQ consumer: BuildKit builds (Phase 2), runtime `docker run` / health checks / teardown (Phase 3), **and** custom-domain jobs + periodic reconcile (Phase 4); Phase 5 **OTel** bootstrap + optional pool / rootless registration env vars
- **Edge (Phase 3–4)**: Caddy in Docker Compose (`infra/docker/docker-compose.yml`) on `opendeploy_runtime`; custom hostnames are allowlisted from Postgres before appearing in generated config
- **Local infra**: Docker Compose for Postgres + Redis + optional Caddy (`infra/docker/docker-compose.yml`)

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

Runtime & routing (Phase 3):

- `PLATFORM_PUBLIC_DOMAIN` (e.g. `deploy.local` — pair with `/etc/hosts` or real DNS for `*.domain`)
- Worker: Docker CLI for `docker run`; `RUNTIME_DOCKER_NETWORK=opendeploy_runtime` (Compose creates this network)
- Optional: `CADDY_ADMIN_URL=http://localhost:2019` after `docker compose up` (maps container admin API), or **`CADDY_ADMIN_UNIX_SOCKET`** for a permissioned socket in production
- Optional: `EDGE_NODE_NAME` for **edge config version** scoping; `ENABLE_RECONCILER=false` to disable API cron reconcilers
- Optional: `CADDY_ACME_EMAIL` for real-certificate issuance on public hostnames (required for meaningful **custom domain** TLS against Let’s Encrypt)
- Custom domains: point **customer DNS** (CNAME) at the same edge that serves `PLATFORM_PUBLIC_DOMAIN`; worker must run so the `domains` queue and reconcile cron execute
- **OpenTelemetry**: set `OTEL_EXPORTER_OTLP_ENDPOINT` (and optional `OTEL_SERVICE_NAME`); use `OTEL_SDK_DISABLED=true` to turn off local dev export
- Worker optional: `WORKER_NODE_POOL`, `WORKER_ROOTLESS_CAPABLE=true`, `WORKER_IDENTITY_FINGERPRINT`
- Optional: `SECRETS_ENCRYPTION_KEY` (64 hex chars) for `EnvironmentSecret` storage
- `PREVIEW_TTL_HOURS` (default 168) for orphaned preview GC

Web (`apps/web/.env.local`):

- `NEXT_PUBLIC_PLATFORM_DOMAIN` — optional display/fallback; should match `PLATFORM_PUBLIC_DOMAIN`

### 3) Migrate / generate

```bash
pnpm install
pnpm db:push
# or: pnpm --filter @opendeploy/db exec prisma migrate deploy
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
- `docs/architecture/phase-3.md`
- `docs/architecture/phase-4.md`
- `docs/architecture/phase-5.md`
- `docs/architecture/phase-6.md`
- `docs/architecture/phase-7.md`
- `docs/security/threat-model-phase-1.md`
- `docs/security/worker-isolation-phase-2.md`
- `docs/security/runtime-routing-phase-3.md`
- `docs/security/custom-domains-phase-4.md`
- `docs/security/hardening-phase-5.md`
- `docs/security/distributed-control-plane-phase-6.md`
- `docs/security/global-traffic-governance-phase-7.md`
- `docs/adr/` — key architectural decisions

## Phase 6+ (remaining work)

See `docs/architecture/phase-6.md` (distribution, backend portability, progressive delivery, identity/policy). Domain-specific follow-ups remain tracked in `docs/architecture/phase-4.md` (apex/DNS-01, wildcards, DNS providers, BYO certs, stronger renewal/ARI).

## Operator notes (Phase 7 direction)

Phase 7 (see `docs/architecture/phase-7.md`) makes global operations safer by introducing a few operator-facing primitives:

- **Change sets**: sensitive routing/policy/DR changes should be represented as versioned `ChangeSet`s, validated before apply and rollbackable on failure.
- **Approvals**: `ApprovalPolicy` can require approval for high-impact operations (global traffic changes, region/fleet drain, cross-region failover, regulated backend switches).
- **Exceptions + expiry**: `PolicyException` is explicit, scoped, and time-bounded (`expiresAt` enforced).
- **Break-glass**: emergency override is supported but separately audited, scoped, and temporary; it should not allow raw edge edits as the source of truth.
- **Failover/drain workflows**: region/fleet drain, evacuation, and restoration are first-class workflows with health + identity safety checks and OpenTelemetry/audit coverage.
