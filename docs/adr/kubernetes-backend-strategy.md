# ADR: Kubernetes backend strategy (optional execution backend)

## Status

Accepted (Phase 6).

## Context

OpenDeploy Phase 3–5 assumes a Docker-centric runtime backend. Phase 6’s goal is **backend portability** without forcing every install to adopt Kubernetes.

Kubernetes is the dominant production scheduler for many teams and provides mature primitives for:

- higher-density scheduling and placement controls
- richer network policy support
- regional clusters as failure domains
- Gateway API: an extensible, role-oriented, protocol-aware routing model that maps well to progressive delivery features

At the same time, OpenDeploy must remain usable in a simpler “Docker mode”.

## Decision

1. Introduce an explicit **execution backend contract** for runtime orchestration and reconciliation (Phase 6A).
2. Keep the existing Docker flow as the **default** backend.
3. Add a **KubernetesExecutionBackend** as an **optional** backend for selected runtime workloads.
4. Model Kubernetes connectivity via `ClusterTarget` rows (kube context/secret reference, gateway class, namespace strategy).
5. Align internal routing abstractions toward **Gateway API** concepts, but do not require Kubernetes for all routing immediately:
   - OpenDeploy’s edge plane may remain the primary traffic entrypoint while the Kubernetes backend matures.

## Execution backend contract (minimum surface)

The backend interface must support:

- `startRuntime`
- `stopRuntime`
- `deleteRuntime`
- `streamLogs`
- `runHealthCheck`
- `listActualInstances`
- `reconcileRuntime`
- `fetchCapabilitySet`

Backends expose capabilities that drive admission/scheduling decisions (e.g. rootless support, network policy features, region labels, supported traffic policy features).

## Namespace and isolation strategy (Phase 6 baseline)

Kubernetes isolation must be explicit and configurable via `namespaceStrategy`:

- per-workspace namespaces (default for strong isolation)
- per-environment or per-project namespaces (optional)

All cluster access must be least privilege; avoid cluster-wide credentials unless absolutely required.

## Consequences

- Docker remains a first-class backend, reducing adoption friction.
- The control plane becomes portable across multiple execution domains and failure domains.
- Gateway API alignment creates a stable target for richer traffic policy, even when the first progressive delivery implementation is edge-driven.
