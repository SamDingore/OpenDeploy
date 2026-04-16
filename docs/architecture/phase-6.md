# Phase 6 — Distribution, backend portability, and policy

By the end of Phase 5, OpenDeploy is no longer just an MVP: it already has a split-plane lifecycle (control/build/runtime/edge), routing and custom domains with certificate automation, quotas, reconcilers, telemetry, and edge config versioning.

Phase 6 does **not** add random product features. It turns OpenDeploy into a **portable, distributed control plane** that can run across **multiple execution backends** and **multiple failure domains**.

## Objective

Move from:

- single-backend assumptions (Docker-centric runtime execution)
- primarily single-region operational design
- one edge/control topology

to:

- optional alternate execution backends (Docker remains supported; Kubernetes becomes optional)
- multi-region topology with region-aware placement and drain/failover primitives
- progressive delivery as a first-class release policy layer (not ad hoc edge edits)
- stronger workload identity across planes and policy-based authorization
- portable networking/routing abstractions that can align with Kubernetes Gateway API concepts over time

## Theme

**Phase 6 — Distribution, backend portability, and policy**

## Major tracks

### 1) Optional Kubernetes backend (additive)

Do not replace the existing Docker-based backend. Add Kubernetes as a **second execution backend**.

Kubernetes is used for:

- selected runtime workloads
- regional runtime placement (per-cluster/per-region scheduling)
- higher-density scheduling and richer network policy support
- future build worker pools (optional, later)

Routing alignment: Phase 6 should begin mapping OpenDeploy’s internal routing model toward **Gateway API** concepts (gateway, listener, route, backend target, traffic policy) without requiring Kubernetes for every install.

See `docs/adr/kubernetes-backend-strategy.md`.

### 2) Multi-region control and edge topology

Phase 6 adds:

- region-aware runtime placement
- regional edge nodes and region-scoped worker/runtime pools
- failover-aware route control (drain and reroute within defined policies)
- regional health and capacity views for operators

Do not jump straight to fully active-active writes across every subsystem. Start with:

- **one primary control plane** (single writable source of truth)
- **multiple regional execution domains** (runtime/edge pools)
- explicit, policy-driven placement and failover behavior

### 3) Progressive delivery (policy-driven)

Phase 6 introduces a release policy layer that supports:

- canary releases
- weighted traffic shifting
- manual promotion (staged gates)
- automatic rollback triggers based on health/SLO signals

This should be implemented as a **release strategy model** with **auditable** transitions, not direct edits to edge configuration.

See `docs/adr/progressive-delivery-model.md`.

### 4) Workload identity and policy plane

Once OpenDeploy spans multiple regions and backend types, long-lived shared secrets become a weak primitive.

Phase 6 introduces:

- workload/node identity between control, worker, edge, and runtime agents
- node and workload attestation
- short-lived identity documents instead of long-lived shared internal secrets
- policy decisions based on identity and role, not just network location

Direction: align with **SPIFFE** identity concepts and implement via **SPIRE** or a pluggable equivalent.

See `docs/adr/workload-identity-strategy.md` and `docs/security/distributed-control-plane-phase-6.md`.

## Proposed subphases (delivery order)


| Subphase | Theme                | Key deliverables                                                                                                                                                |
| -------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **6A**   | Backend abstraction  | Execution backend interface; Docker adapter as default; Kubernetes runtime backend (optional); capability discovery; backend-specific reconciler adapters       |
| **6B**   | Regional topology    | Region model; region-aware pools; region-scoped scheduling; regional edge placement; drain/failover primitives; regional health/capacity surfaces               |
| **6C**   | Progressive delivery | Release strategy model; weighted traffic assignments; canary orchestration; promotion + rollback policies; SLO-driven rollback hooks; audit for all transitions |
| **6D**   | Identity and policy  | SPIFFE/SPIRE-compatible identity plane; node/workload attestation; identity-based internal authz; policy engine hooks for placement and rollout eligibility     |


## Architecture changes

### 1) Execution backend contract

Phase 6 introduces an explicit backend contract so the control plane does not hardcode infrastructure details.

Required interface surface (minimum for Phase 6):

- `startRuntime`
- `stopRuntime`
- `deleteRuntime`
- `streamLogs`
- `runHealthCheck`
- `listActualInstances`
- `reconcileRuntime`
- `fetchCapabilitySet`

Implementation:

- `DockerExecutionBackend` (existing behavior adapted)
- `KubernetesExecutionBackend` (new, optional)

Capability discovery should drive admission and scheduling decisions (e.g. rootless, network policy, region labels, supported traffic policy features).

### 2) Routing abstraction aligned to Gateway API concepts

Even if OpenDeploy does not expose Kubernetes objects directly, Phase 6 should evolve internal routing primitives to map toward:

- gateway
- listener
- route
- backend target
- traffic policy (including weighted/canary behavior)

This keeps future Kubernetes support expressive and avoids “Caddyfile-as-API” drift.

### 3) Replace shared trust with identity

Phase 6 transitions internal trust toward identity-based authorization:

- each worker/edge/runtime agent has an attested identity
- internal APIs authorize based on **identity + role + policy**
- certificate issuance, edge applies, and runtime callbacks use **short-lived** credentials once identity is available

## Data model additions (minimum)

Add at least:

- `Region`: `id`, `slug`, `displayName`, `status`, `isPrimary`, `metadataJson`
- `ExecutionBackend`: `id`, `kind` (`docker`, `kubernetes`), `name`, `regionId`, `status`, `capabilitiesJson`
- `ClusterTarget` (Kubernetes regions): `id`, `executionBackendId`, `name`, `kubeContextRef`/secret ref, `gatewayClassName`, `namespaceStrategy`, `status`
- `ReleaseStrategy`: `id`, `environmentId`, `type` (`instant`, `canary`, `weighted`, `manual_promote`), `configJson`
- `TrafficAssignment`: `id`, `routeBindingId`, `releaseId`, `weight`, `regionId`, `status`
- `IdentityRecord`: `id`, `subject`, `spiffeId`, `kind` (`worker`, `edge`, `runtime-agent`, `control-service`), `issuedAt`, `expiresAt`, `status`
- `PolicyRule`: `id`, `scopeType`, `scopeId`, `policyType`, `definitionJson`, `isEnabled`

State additions:

- `Region.status`: `active | degraded | draining | offline | retired`
- `ExecutionBackend.status`: `active | degraded | read_only | draining | offline`
- progressive release state: `pending | warming | receiving_canary | evaluating | promoted | rolled_back | failed | terminated`

## Security requirements (mandatory controls)

- **Identity-based trust** between planes (prefer attested identity over shared secrets).
- **Region/backend isolation** with drain and quarantine behavior.
- **Progressive delivery guardrails**: no weighted/canary route bypasses health gating or policy checks.
- **Policy-first backend selection** for placement by isolation tier, region affinity, compliance labels, egress class, cost class, and runner posture.

Details in `docs/security/distributed-control-plane-phase-6.md`.

## Observability requirements

OpenTelemetry remains the contract. Phase 6 adds telemetry for:

- backend selection and capability gating
- cross-region route activation latency
- backend-specific failure rates
- rollout step duration and promotion/rollback decisions
- identity issuance and attestation failures
- region/backend drain and failover events

Tracing becomes more important as workflows cross queue/worker/edge and regional boundaries.

## Acceptance criteria

Phase 6 is complete when:

1. OpenDeploy can schedule runtimes on at least **two execution backends**, with Docker remaining supported and Kubernetes optional.
2. The platform can represent at least **two regions** and make **region-aware placement** decisions.
3. A production release can use a **weighted/canary rollout policy** rather than only instant cutover.
4. Rollout promotion and rollback are **policy-driven** and **auditable**.
5. Internal trust between planes can be established with **workload/node identity** rather than only shared secrets (SPIFFE/SPIRE-style).
6. Telemetry can follow distributed workflows across control, queue, worker, edge, and regional backend boundaries via OpenTelemetry.
7. A degraded region or backend can be **drained** without breaking global control-plane state.

## Non-goals (explicitly out of scope)

- generalized persistent volumes for all users
- public marketplace of templates/runtimes
- “every orchestrator” support
- cross-cloud live migration
- tenant-authored custom routing code
- bespoke per-customer observability stacks

## Phase 7 (TODO list)

Once Phase 6 stabilizes, Phase 7 candidates typically include:

- active-active control-plane write paths (selected subsystems only, with clear correctness boundaries)
- multi-edge fleets with global traffic management and safer publication pipelines
- broader Gateway API traffic policy surface (mirroring, header-based routing) once release policy is stable
- deeper policy engine coverage (compliance, cost, egress) and policy authoring UX
- optional stateful workload support (PV + backup + restore + migration story) as a separate product decision

