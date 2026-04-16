# Security — Distributed control plane (Phase 6)

Phase 6 expands OpenDeploy from a hardened single-backend design into a **portable, multi-region control plane** with optional execution backends (Docker + Kubernetes). That changes the threat model: more nodes, more networks, more identities, and more automated decisions.

This document defines **mandatory security controls** for Phase 6 and the minimum viable security posture for distribution.

## Trust boundaries (recap)

- **Control plane** (`apps/api`, `apps/web`, DB/Redis/queues): source of truth; orchestrates releases, policies, and audits.
- **Execution domains** (regional worker/runtime pools, optional Kubernetes clusters): run untrusted tenant workloads and build processes.
- **Edge plane** (regional edge nodes): terminate TLS and route traffic based on allowlisted state; apply operations are high-impact.

## Phase 6 security goals

- **Identity-based trust** between planes instead of long-lived shared secrets.
- **Policy-driven authorization** for high-impact actions (placement, routing, rollout transitions, drain/quarantine).
- **Regional isolation**: a degraded region or backend can be drained without corrupting global state.
- **Progressive-delivery guardrails**: weighted/canary routing cannot bypass health/SLO checks or policy.
- **Auditable control**: every automated decision and operator override leaves an audit trail.

## Workload identity (SPIFFE/SPIRE direction)

### Why

Phase 5’s shared bootstrap secrets are acceptable for an MVP, but become weaker as:

- regions and node classes multiply
- edge fleets grow
- backends diversify (Docker + Kubernetes)

### Requirements

- **Each plane component has an identity**:
  - worker node agent
  - edge node agent
  - runtime agent (if introduced)
  - control services (internal API callers)
- **Short-lived credentials**:
  - prefer mTLS with short-lived SVIDs (SPIFFE) for internal RPC/HTTP
  - avoid long-lived bearer secrets once identity is deployed
- **Attestation**:
  - node attestation for worker/edge nodes (bootstrap controlled)
  - workload attestation for in-cluster components (Kubernetes workload identity)
- **Rotation and revocation**:
  - identities must expire
  - a drained/quarantined node must not retain authorization via stale credentials

### Practical rollout (incremental)

Phase 6 should allow a staged rollout:

1. Keep `INTERNAL_API_SECRET` as a **bootstrap** only.
2. Add identity issuance and record lifecycle (`IdentityRecord`).
3. Introduce identity-based authz for the highest-impact endpoints:
   - edge apply/rollback
   - runtime start/stop/delete callbacks
   - reconciliation mutations
4. Tighten policies to require identity for sensitive actions when configured.

## Policy plane (enterprise-grade controls)

### Scope

Policies in Phase 6 must at minimum cover:

- **placement** (region affinity, compliance labels, isolation tier, cost class)
- **backend selection** (capability admission: rootless, network policy, egress class)
- **rollout eligibility** (who can canary/weight, what environments allow it)
- **cross-region routing** (when traffic may shift between regions)
- **drain/quarantine** permissions (operator + automation)

### Requirements

- **Policy-first**: the scheduler and rollout orchestrator must call policy evaluation before acting.
- **Identity-aware**: decisions are based on identity attributes (role, region, backend) not only network location.
- **Explainable**: denials should return a reason suitable for operator UI.
- **Auditable**: every decision (allow/deny) should emit audit events with policy rule references.

## Multi-region isolation and failure domains

### Region / backend drain and quarantine

Mandatory behaviors:

- a region/backend can enter `draining`:
  - new placements stop (policy-gated overrides allowed)
  - existing workloads gradually migrate or terminate per policy
  - routing weights decrease in that region according to a defined plan
- a region/backend can enter `offline`/`quarantined`:
  - no placement and no routing attachment
  - reconciler must avoid “reviving” drained instances unless policy allows

### Single writable control plane (Phase 6 boundary)

To avoid consistency failures:

- keep one primary writable control plane
- treat regional domains as execution domains with eventual reconciliation
- explicitly define what state is authoritative globally vs observed regionally

## Progressive delivery guardrails

### Requirements

- no weighted/canary route can be applied without:
  - successful health gating on candidate runtime(s)
  - policy evaluation approval
  - audit record for the transition
- automatic rollback triggers must be:
  - policy-configured per environment
  - rate-limited to avoid oscillation
  - auditable, including which signal triggered rollback

### Signals and sources

Phase 6 should treat OpenTelemetry-derived signals as inputs:

- error rate / latency SLOs
- backend health probe failures
- edge apply failure rate

## Kubernetes backend security (minimum)

If Kubernetes is enabled:

- **least privilege** Kubernetes credentials (namespace-scoped where possible)
- a clear **namespace isolation** strategy (per workspace, per environment, or per project)
- alignment with Gateway API concepts for routing policy (do not embed unsafe arbitrary config)
- capture and audit “who/what applied” changes to cluster targets

## Audit and telemetry requirements

Audit events must exist for:

- region/backend status changes (active/degraded/draining/offline)
- backend selection decisions (including policy rule references)
- rollout transitions (warming/canary/evaluating/promoted/rolled_back)
- edge apply/rollback operations (including region scope)
- identity issuance/attestation failures and revocations

OpenTelemetry spans/attributes should support:

- correlation across control → queue → worker → edge and regional boundaries
- backend kind, region id, and rollout id as consistent attributes

## Acceptance criteria (security)

Phase 6 security is acceptable when:

1. Internal plane-to-plane calls can be authorized using **short-lived workload identity** (SPIFFE-like) when enabled.
2. Placement and rollout actions are **policy-gated** and **auditable**.
3. A degraded region/backend can be **drained** without breaking global state or bypassing guardrails.
4. Weighted/canary routing cannot be applied without health gating and policy approval.
