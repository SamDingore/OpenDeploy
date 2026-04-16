# Phase 1 — Secure control-plane skeleton

## Planes

### Control plane (`apps/web`, `apps/api`)

- **Web**: Next.js dashboard, Clerk authentication, Tailwind + shadcn-style primitives, SSE via an authenticated Next.js route proxy.
- **API**: NestJS modules for auth, workspaces, projects, GitHub scaffolding, deployments, webhooks, workers listing, internal worker callbacks, and audit logging.
- **Data**: PostgreSQL via Prisma (`packages/db`), Redis for BullMQ.

### Worker plane (`apps/worker`)

- Consumes BullMQ jobs from the shared `deployments` queue.
- Registers with the API using `INTERNAL_API_SECRET`.
- Simulates pipeline steps and updates deployment state through **internal HTTP endpoints only** (no direct shelling from HTTP handlers).

### Edge plane

- **Not implemented in Phase 1.** ADR documents defer Caddy vs Nginx until preview/prod routing exists.

## Primary user flows

1. User signs in with Clerk.
2. User belongs to one or more workspaces (`WorkspaceMember` + RBAC).
3. Projects own environments (auto-created: `preview`, `production`).
4. Creating a deployment inserts rows, enqueues a BullMQ job, transitions `created → queued`, and emits SSE events.
5. Worker claims the job, moves through the state machine, appends structured logs, finishes `healthy` or `failed`.
6. GitHub webhooks are verified, deduped (`WebhookEvent`), and persisted before any future enqueue logic.

## Trust boundaries

- Untrusted repository code does **not** run in `web` or `api` containers in Phase 1.
- Worker plane is logically separate; even though builds are simulated, status transitions go through the same internal API surface intended for real workers later.

## Observability

- Structured logs: Nest `Logger` in API; worker uses `console` with structured objects (Phase 2: unify on pino/OTel).
- Sentry: recommended next step (`SENTRY_DSN` hook points documented in threat model).

