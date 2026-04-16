# Security hardening — Phase 5

Phase 5 aligns OpenDeploy with **defense in depth** on the worker and edge planes while keeping the **control / worker / edge** separation from earlier phases.

## Runner isolation

- **Docker** still implies trust in the daemon and host kernel. **Rootless** Docker reduces daemon privilege exposure; OpenDeploy records **pool-level** `supportsRootless` and **per-worker** `rootlessCapable` so rollouts are **explicit** and **pool-scoped** (see `docs/adr/rootless-runner-strategy.md`).
- **Runner classes** (`standard`, `hardened`, `internal_trusted`) reserve space for **VM-backed** or **gVisor-style** runners later without forcing the whole fleet into the most expensive tier.
- **RuntimePolicy** introduces **egress tiers** (`unrestricted`, `allowlisted`, `blocked`) for future enforcement on hardened pools.

## Edge / Caddy

- The **admin API** is powerful and should not sit on a **broadly reachable** TCP interface next to tenant code. Prefer **`CADDY_ADMIN_UNIX_SOCKET`** with filesystem permissions, or bind admin to **loopback** only (see Caddy security documentation).
- **EdgeConfigVersion** stores immutable snapshots; **rollback** re-applies a prior snapshot and **audits** the action (`edge.config.rollback`).

## Node health and blast radius

- Workers can be marked **`draining`**, **`degraded`**, **`quarantined`**, or **`retired`** (schema); **assign-worker** only accepts **`online`** nodes today—extend schedulers to respect drain/quarantine consistently as scheduling matures.
- **Reconciliation** marks **stale heartbeats** as `offline` and closes **expired leases** after crashes.

## Secrets and machine identity

- Workers may send a **non-secret** `workerIdentityFingerprint` at register time for **attestation** and drift detection (future: signed tokens, SPIFFE, etc.).
- **INTERNAL_API_SECRET** remains the bootstrap for worker→API calls; Phase 5 does not relax that boundary.

## Quotas

- **WorkspaceQuota** limits concurrent **builds** and **in-flight runtime provisioning**, reducing cross-tenant **noisy neighbor** impact and **queue flooding**.

## Audit

Actions to preserve in audit / telemetry:

- Edge **rollback** and failed applies.
- **Quarantine** / **drain** transitions (extend as APIs are added).
- **Reconciliation** repairs (partial vs full) via `ReconciliationRun` and optional `AuditEvent` expansion.
