# ADR: Rootless runner strategy

## Status

Accepted (Phase 5).

## Context

Docker documents **rootless mode** as a way to run the daemon and containers with reduced host privilege. It also documents **caveats** (networking, volume mounts, feature gaps). OpenDeploy must not treat rootless as a silent feature flag: operators need **explicit pool-level** adoption and **documented** constraints.

## Decision

1. **Default pool** remains **`mixed`** posture; **rootless** is adopted **per `NodePool`** via `supportsRootless` plus worker-reported `rootlessCapable`.
2. Workers send optional env-driven hints: `WORKER_ROOTLESS_CAPABLE=true`, `WORKER_NODE_POOL`, `WORKER_IDENTITY_FINGERPRINT`.
3. **Hardened** and **internal_trusted** runner classes are reserved for stronger isolation (VM / separate daemon / no tenant mix) in later iterations.
4. **Documentation** and **runbooks** must list Docker rootless limitations relevant to builds (BuildKit, registry push, networking) before promoting a pool to production.

## Consequences

- Scheduling and admission must eventually **pin** high-risk tenants to **hardened** pools; Phase 5 lays down **data model** and **registration** hooks only.
- Observability must include **pool** and **runnerClass** labels on worker-related spans/metrics when exporters are configured.
