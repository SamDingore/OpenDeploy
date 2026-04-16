# Phase 3: runtime releases and platform-managed routing

Phase 2 proved OpenDeploy can **build** a container image from a GitHub-linked repo with a full audit trail. Phase 3 takes the next bounded step: **run** that image as an isolated runtime, **verify health**, attach **platform-owned** traffic via **Caddy**, and support **preview** (PR) and **production** releases with **rollback**.

**Phase 4** covers **custom domains** and **tenant TLS automation** (see `docs/architecture/phase-4.md`). Phase 3 docs remain accurate for platform-owned routing only.

## Objective

Move from:

- built image exists  
- artifact metadata exists  

to:

- image runs as a **managed** runtime container  
- **health** is verified before any public route is attached  
- **preview** traffic routes to PR deployments (`pr-<n>.<project>.<platform-domain>`)  
- **production** traffic routes to the **single active** release per environment  
- **release** and **route** changes are **auditable**  
- **rollback** restores a previous healthy production artifact and **rebinds** the route  

## Three planes (split-plane preserved)

| Plane | Responsibility |
|--------|------------------|
| **Control** | `apps/api`, `apps/web`, Postgres, Prisma, Redis, BullMQ, auth, orchestration, audit, UI |
| **Worker / runtime** | `apps/worker`: BuildKit builds (Phase 2) **and** runtime provisioning, health probes, teardown, log shipping |
| **Edge** | **Caddy**: TLS + reverse proxy from validated DB state only |

Untrusted customer code **never** runs inside API or web processes.

## Build vs release

- **Build** (`Deployment`): source → image (`DeploymentStatus` through `build_succeeded`).  
- **Release**: image → `RuntimeInstance` → health → `RouteBinding` → edge config.

This separation avoids overloading “deployment” for two different lifecycles.

## Data model (Prisma)

Key models:

- `Release` — ties a successful `BuildArtifact` to an `Environment`; `ReleaseType` preview/production; `ReleaseStatus` state machine.  
- `RuntimeInstance` — Docker container identity (`containerName`, `upstreamDial`, resource metadata).  
- `PlatformHostname` — stable hostname row per preview PR or production site (`*.platformDomain`).  
- `RouteBinding` — attaches a hostname to a **healthy** runtime (`RouteBindingStatus`).  
- `HealthCheckResult` — persisted probe history.  
- `RuntimeLogChunk` — runtime logs (redacted patterns for secrets).  
- `EnvironmentSecret` — optional AES-GCM encrypted env injection (`SECRETS_ENCRYPTION_KEY`).  

`Environment` adds `runtimeContainerPort`, `runtimeHealthCheck` JSON, and `activeReleaseId` (production pointer).

## Routing model

- **Platform domain** from `PLATFORM_PUBLIC_DOMAIN` (e.g. `deploy.local` in dev).  
- **Preview**: `pr-<number>.<project-slug>.<domain>`  
- **Production**: `<project-slug>.<domain>`  
- Hostnames are validated with `isPlatformManagedHostname` before persistence.

## Caddy integration

- `CaddyService.applyFromDatabase()` loads **only** `attached` `RouteBinding` rows and generates a Caddyfile via `buildCaddyfile` (no user-supplied raw config).  
- Apply path: optional `CADDY_ADMIN_URL` POST `/load` with `Content-Type: text/caddyfile`, and/or `CADDYFILE_PATH` for volume workflows.  
- Local Compose: `infra/docker/docker-compose.yml` includes Caddy on shared Docker network `opendeploy_runtime`.

## Orchestration (BullMQ)

Queues:

- `releases` — provision jobs (`ReleaseJobPayload`).  
- `release-teardown` — stop containers, detach routes, finalize DB (`ReleaseTeardownPayload`).

Retries: provision/teardown jobs use exponential backoff; **complete-provision** failures (e.g. Caddy reload) throw so the worker can retry.

## Security controls (summary)

- No `--privileged`, no host networking, no arbitrary host mounts in runtime path (worker constructs `docker run` args).  
- Bounded CPU/memory via `RUNTIME_CPU_LIMIT` / `RUNTIME_MEMORY_LIMIT`.  
- Secrets: encrypted at rest when `SECRETS_ENCRYPTION_KEY` is set; redaction in runtime logs.  
- Route attach only after **successful** health check persisted.  
- Audit events for release lifecycle, route attach, rollback, teardown, secret upsert.

## Local dev checklist

1. `docker compose -f infra/docker/docker-compose.yml up -d` (Postgres, Redis, Caddy, network).  
2. `docker network ls` should show `opendeploy_runtime`.  
3. Set `PLATFORM_PUBLIC_DOMAIN`, optional `CADDY_ADMIN_URL=http://localhost:2019`.  
4. Worker: Docker CLI + `RUNTIME_DOCKER_NETWORK=opendeploy_runtime`.  
5. Map preview/prod hostnames in `/etc/hosts` or use real DNS for `*.platform.domain` in non-local setups.

## Acceptance mapping

| Criterion | Implementation |
|-----------|------------------|
| Launch artifact as runtime | Worker `docker run` + `RuntimeInstance` |
| PR preview URL | Webhook PR flow + `PlatformHostname` + route after health |
| Default-branch production | Push to `productionBranchRule` / repo default → production `Deployment` → release |
| Route after health | `completeProvisionAfterHealth` |
| Rollback | `rollbackProduction` + new release from stopped candidate |
| PR closed teardown | Webhook `closed` → `teardownPreviewForPr` |
| Auditable routes | `audit` on attach + teardown |
| Runtime logs in UI | `RuntimeLogChunk` on release detail |
| No custom domains | Hostname validation + docs |

## Phase 4 (TODO)

- **Custom domains**: ownership verification, ACME per-tenant certs, Let’s Encrypt rate-limit strategy, safe backoff.  
- **Stronger isolation**: rootless Docker / gVisor / dedicated runner VMs; network policies between tenants.  
- **Observability**: metrics, tracing, centralized log sink, SLOs on edge reload and provision latency.  
- **Multi-region / HA edge**: replicated Caddy config source, health-checked upstream pools.  
- **Progressive delivery**: canary / weighted routing (not raw Caddyfile editing by users).  
- **Kubernetes / Nomad** optional execution backends with the same control-plane contracts.  
- **Persistent volumes** for stateful apps (explicit product decision + backup story).  
- **Autoscaling** runtimes and workers based on queue depth and CPU.

## Folder structure (Phase 3 additions)

```
apps/api/src/releases/          # ReleasesModule, CaddyService, maintenance cron
apps/api/src/internal/          # internal-releases.controller.ts (worker callbacks)
apps/api/src/secrets/           # AES-GCM helpers for EnvironmentSecret
apps/worker/src/runtime-worker.ts
packages/shared/src/            # release state machine, hostname helpers, Caddyfile builder, queues
infra/docker/caddy/             # base Caddyfile + admin for local
packages/db/prisma/             # Release, RuntimeInstance, RouteBinding, …
docs/architecture/phase-3.md
docs/security/runtime-routing-phase-3.md
docs/adr/caddy-edge-phase-3.md
docs/adr/release-model-separate-from-build.md
```
