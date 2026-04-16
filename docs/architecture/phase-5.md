# Phase 5 — Hardening and operations

Phase 4 completed the **core product loop** (source → build → runtime → routing → custom domains → certificates). Phase 5 **stops expanding major product surface** and invests in **isolation**, **observability**, **reconciliation**, **capacity**, and **edge/control resilience**.

## Objective

Move from feature-complete MVP with basic isolation and logs to:

- Stronger tenant and runner isolation (pools, rootless posture, runner classes).
- **OpenTelemetry** traces across API → queues → workers → edge operations (see `@opendeploy/telemetry` and queue `traceCarrier` fields).
- **Reconcilers** for leases, stale runtimes, stuck releases/certs, and worker heartbeats.
- **Quotas** and concurrency limits at the workspace level.
- **Edge config versioning**, rollback, and **Caddy admin** reachable preferably via **Unix socket** rather than a casually exposed TCP admin port.

## Subphases (delivery order)


| Subphase | Theme                | Key deliverables                                                                                                                                                                         |
| -------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **5A**   | Isolation            | `NodePool`, worker `runnerClass` / `rootlessCapable`, pool-level `supportsRootless`, internal worker identity fingerprint, assign-time checks (`worker_not_assignable` unless `online`). |
| **5B**   | Telemetry            | OTel SDK in API + worker; W3C propagation on BullMQ payloads; OTLP exporter env vars; structured logs should include trace ids once log bridge is wired.                                 |
| **5C**   | Reconcile + capacity | `ReconciliationRun` rows; cron every 5 minutes (`ENABLE_RECONCILER=false` to disable); `WorkspaceQuota` enforcement on builds and runtime provisioning.                                  |


## Data model (Prisma)

New / extended concepts:

- `**NodePool`** — named pool; `supportsRootless`, `isHardened`, capacity hints, `maxConcurrent*` hints.
- `**WorkerNode**` — `nodePoolId`, `rootlessCapable`, `runnerClass`, `workerIdentityFingerprint`; extended `**WorkerStatus**` (`degraded`, `quarantined`, `retired`).
- `**NodeLease**` — crash-safe lease records with expiry and `releasedAt`.
- `**RuntimePolicy**` — per-workspace or per-project CPU/memory/`maxReplicas`/`egressPolicy`/`isolationTier` (enforcement hooks land incrementally).
- `**WorkspaceQuota**` — `maxConcurrentBuilds`, `maxConcurrentRuntimes`, cert and edge churn caps (build/runtime enforced in API today).
- `**CapacityEvent**` — quota denials and future autoscale signals.
- `**ReconciliationRun**` — per-kind outcomes (`itemsExamined`, `itemsRepaired`, `errorSummary`).
- `**TelemetrySpanLink**` — optional DB correlation of `resourceId` → `traceId` for UI deep links.
- `**EdgeNode**` + `**EdgeConfigVersion**` — versioned Caddyfile snapshots; rollback appends a new applied version after POST `/load`.

Migration: `packages/db/prisma/migrations/0004_phase5_hardening_operations/`.

## API and UI

- **Internal**: worker register accepts pool name and rootless/class metadata; assign-worker rejects non-`online` nodes.
- **Operator (workspace ADMIN)** under `GET/POST /workspaces/:workspaceId/operations/*`: node pools, reconciliation history, quotas, edge config versions, rollback.
- **Web**: `/workspaces/[id]/operations` and richer **Workers** cards (pool, runner class, rootless).

## Environment variables

See root `.env.example` (Phase 5 section). Highlights:

- `**CADDY_ADMIN_UNIX_SOCKET`** — preferred admin path (HTTP over UDS).
- `**EDGE_NODE_NAME**` — logical edge id for version rows (upserts `EdgeNode`).
- `**OTEL_***` / `**OTEL_SDK_DISABLED**` — standard OpenTelemetry exporter settings; `@opendeploy/telemetry` reads OTLP defaults.
- `**WORKER_NODE_POOL**`, `**WORKER_ROOTLESS_CAPABLE**`, `**WORKER_IDENTITY_FINGERPRINT**` — worker registration hints.
- `**ENABLE_RECONCILER=false**` — disable cron reconcilers (tests / maintenance).

## Phase 6 (preview)

Phase 6 should not add random product features. It should turn OpenDeploy into a **portable, distributed control plane**: multi-region topology, optional execution backends beyond Docker, policy-first placement/routing, progressive delivery, and workload identity.

In scope for Phase 6:

- **Execution backend abstraction** (keep Docker; add optional Kubernetes runtime backend).
- **Multi-region topology** (one primary control plane; multiple regional runtime/edge pools; drain/failover primitives).
- **Progressive delivery** (canary/weighted/manual promotion as release policy; health/SLO gated rollback).
- **Workload identity + policy plane** (short-lived identities; identity-based authorization; policy-driven placement and routing).

Explicitly not bundled into Phase 6:

- General tenant persistent volumes for all users.
- Marketplace of templates/runtimes.
- Every orchestrator under the sun or cross-cloud live migration.
- Tenant-authored custom routing code.
- Bespoke observability stacks per customer (keep OTLP as the contract).
- DNS-01 / apex / wildcard custom domains (keep tracked under Phase 4 follow-ups; do not block distribution work).

## Acceptance (Phase 5)

Phase 5 is “complete enough to ship iteratively” when:

1. At least one **production-eligible** pool can advertise **rootless** posture (`supportsRootless` + worker `rootlessCapable`), with **documented** Docker rootless caveats (`docs/adr/rootless-runner-strategy.md`).
2. **Caddy admin** can be constrained to **Unix socket** (or tightly bound localhost) and config apply/rollback is **versioned and audited**.
3. **Traces** can cross API → BullMQ → worker jobs via **shared trace carriers**.
4. **SLO-oriented metrics** are defined (`docs/adr/observability-otel-phase-5.md`); Grafana/Prometheus wiring is environment-specific.
5. **Reconcilers** run on a schedule and repair **leases**, **orphaned runtime rows**, **stuck releases/certs**, and **stale heartbeats** within documented bounds.
6. **Workspace quotas** block saturated **build** and **runtime provision** enqueue paths.

