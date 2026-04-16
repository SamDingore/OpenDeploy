# Phase 7 — Global traffic, governance, and recovery

Phase 6 made OpenDeploy portable across backends and regions, with progressive delivery and identity-based trust. Phase 7 is the bounded next step: make that distributed control plane **safe to operate at enterprise scale** across **multiple edge fleets**, with **controlled global traffic movement**, **strong governance**, and **deliberate disaster recovery**.

Phase 7 does **not** add random product surface. It hardens platform operations: global request steering, approval gates, policy packs, and recovery workflows with safe publication semantics.

## Objective

Move from:

- multi-region capable platform
- backend portability
- canary/weighted rollout
- identity-aware internal trust

to:

- global traffic management across multiple edge fleets
- enterprise governance and approval controls
- policy packs for compliance, egress, placement, and cost
- recovery and disaster-readiness for regional/edge failures
- operator-safe publication pipelines for routing and policy changes

## Theme

**Phase 7 — Global traffic, governance, and recovery**

## Architectural direction (still correct)

- **Gateway API direction**: as you expand beyond cutover/weighted rollout into richer routing and policy (protocol-aware routing, role-oriented delegation, header/path matching, mirrors, retries), Kubernetes Gateway API remains the right conceptual anchor even when OpenDeploy does not expose raw Kubernetes objects.
- **OpenTelemetry contract**: continue unifying traces, metrics, and logs across control/queue/worker/edge and regional boundaries.
- **SPIFFE direction**: as failover and multi-fleet operations expand, short-lived workload identity is safer and more standard than ambient long-lived secrets.

## Major tracks

### 1) Global traffic management (multi-fleet request steering)

Phase 6 introduced region-aware placement; Phase 7 adds global request steering across **multiple edge fleets**.

Deliver:

- edge fleet model (multiple fleets, explicit region association and status)
- global traffic policy model (explicit “how traffic moves” rules)
- region preference + failover rules (primary/failover, geo preferred, manual override)
- health-aware traffic steering (don’t route to unhealthy regions/fleets)
- controlled evacuation and restoration (drain and restore as workflows)
- **publication safety** for global route changes (staged, validated, rollbackable)

This must be modeled as a **control-plane policy layer**, not ad hoc DNS edits or manual per-edge configuration.

### 2) Governance and approvals (operator controls)

Phase 7 introduces formal operator controls suitable for production at scale:

- approval workflows for sensitive operations
- separation of duties for production-impacting changes
- policy exceptions with expiry
- break-glass workflows
- audit-complete operator actions (who, what, why, scope, when)
- tenant-level governance settings

Typical gated actions:

- production rollout beyond a threshold
- rollback override
- cross-region failover
- custom-domain policy override
- backend switch for regulated workloads
- quota increases above defaults

### 3) Deeper policy engine coverage (policy becomes a subsystem)

Phase 6 added policy hooks. Phase 7 makes policy a **first-class subsystem** with reusable packs and broader evaluation coverage:

- region placement constraints
- compliance labels
- egress restrictions
- runner isolation tier requirements
- cost-tier selection
- rollout eligibility
- failover eligibility
- domain/certificate restrictions
- tenant-specific limits and exemptions

This is where OpenDeploy starts behaving like a **real platform control plane**, not just a deploy orchestrator.

### 4) Recovery and disaster readiness (deliberate mechanics)

Phase 7 adds deliberate recovery mechanics, not just reconcilers:

- region failover runbooks encoded into the platform (plans + orchestrations)
- edge-fleet failover modes (drain, quarantine, restore)
- control-plane backup/restore procedures
- disaster-recovery drills + recorded outcomes
- recovery point / recovery time tracking
- operator-visible dependency health for critical subsystems (identity issuance, edge apply, queue health)

Phase 7 should make it possible to answer:

- What happens if one region is lost?
- What happens if one edge fleet is misconfigured?
- What happens if a rollout policy deploys bad traffic weights globally?
- What happens if identity issuance is unavailable?

### 5) Stronger publication safety (unify “publish” surfaces)

By Phase 7 there are multiple publish surfaces:

- edge config
- traffic assignments
- rollout strategies
- policy rules
- certificate/domain state
- regional failover directives

Phase 7 unifies them behind:

- staged publication
- versioned change sets
- validation before apply
- automatic rollback on failed apply
- blast-radius-aware rollout of platform config

## Suggested subphases (delivery order)

| Subphase | Theme                         | Key deliverables |
| -------- | ----------------------------- | ---------------- |
| **7A**   | Global edge + traffic control | `EdgeFleet`; `GlobalTrafficPolicy`; region preference/failover; safe route publication pipeline; traffic steering telemetry |
| **7B**   | Governance + approvals         | `ChangeSet`; `ApprovalPolicy`; approvals queue; role separation; exceptions + expiry; break-glass path; audit completeness |
| **7C**   | DR + resilience                | drain/evacuate/restore workflows; `DisasterRecoveryPlan`; `RecoveryEvent`; drills + outcomes; recovery dashboards |
| **7D**   | Policy packs                   | reusable policy bundles (compliance/cost/egress); tenant-level overrides; policy visibility + exception UX |

## Data model additions (minimum)

Add at least these new concepts (shape-level; implementation may evolve):

### Global traffic

- `EdgeFleet`
  - `id`
  - `name`
  - `regionId`
  - `status` (`active | degraded | draining | offline | quarantined`)
  - `publicationMode`
  - `capacityHintsJson`
- `GlobalTrafficPolicy`
  - `id`
  - `environmentId`
  - `strategyType` (`primary_failover | weighted_global | geo_preferred | manual_override`)
  - `configJson`
  - `status` (`draft | validating | ready | applied | failed | rolled_back`)

### Publication safety + approvals

- `ChangeSet`
  - `id`
  - `scopeType`
  - `scopeId`
  - `changeType`
  - `proposedByUserId`
  - `approvedByUserId`
  - `status` (`pending | awaiting_approval | approved | rejected | applying | applied | failed | rolled_back | expired`)
  - `payloadJson`
  - `appliedAt`
- `ApprovalPolicy`
  - `id`
  - `scopeType`
  - `scopeId`
  - `operationType`
  - `rulesJson`
  - `isEnabled`
- `PolicyException`
  - `id`
  - `policyRuleId`
  - `scopeType`
  - `scopeId`
  - `reason`
  - `expiresAt`
  - `approvedByUserId`

### Disaster recovery

- `DisasterRecoveryPlan`
  - `id`
  - `regionId`
  - `planType`
  - `definitionJson`
  - `lastDrillAt`
  - `lastOutcome`
- `RecoveryEvent`
  - `id`
  - `regionId`
  - `eventType`
  - `status` (`planned | running | completed | failed | cancelled`)
  - `startedAt`
  - `finishedAt`
  - `summaryJson`

## Mandatory security controls (Phase 7)

See `docs/security/global-traffic-governance-phase-7.md`. Minimum requirements:

- **No global traffic change without validation** (schema, policy, health, and blast-radius checks).
- **High-impact changes can require approval** per tenant and environment.
- **Policy exceptions must expire automatically**.
- **Break-glass actions must be separately audited** and clearly attributable.
- **Region/fleet drain must be policy-gated**.
- **Edge publication must support rollback**.
- **Failover cannot bypass health and identity checks**.
- **Tenant scope must be preserved** during global operations.

SPIFFE-compatible workload identity remains relevant because multi-fleet failover makes short-lived identity safer than ambient long-lived trust.

## Observability requirements

OpenTelemetry remains the system contract. Phase 7 adds telemetry for:

- global route publication latency
- edge-fleet apply success/failure
- failover trigger reason
- regional evacuation time
- approval lead time
- policy-denied operations
- break-glass usage
- DR drill success rate
- recovery objective attainment (RPO/RTO tracking)

## Acceptance criteria

Phase 7 is complete when:

1. OpenDeploy can steer traffic across more than one **edge fleet** and **region** using explicit `GlobalTrafficPolicy`.
2. A region or edge fleet can be **drained** and traffic redirected through a controlled failover workflow.
3. High-impact production changes can require **approval** before apply.
4. Policy exceptions are **time-bounded** and auditable.
5. Disaster-recovery drills can be executed and recorded in-platform.
6. Global config publication is versioned, validated, and rollback-capable.
7. Telemetry covers global routing, approval workflows, and recovery events end to end.

## Non-goals (explicitly out of scope)

Do not overload Phase 7 with:

- generalized persistent volumes for everyone
- tenant-authored routing code
- marketplace/catalog features
- arbitrary cloud-specific integrations
- every DNS provider under the sun

## Phase 8 (TODO list)

Once Phase 7 stabilizes, Phase 8 candidates typically include:

- optional active-active control-plane write paths for select subsystems (with explicit correctness boundaries)
- deeper Gateway API parity (mirrors, retries, timeouts, header-based routing) once global traffic safety is proven
- a full data-ownership model for policy packs (versioning, promotion across environments, signing)
- multi-control-plane / multi-tenant “org of orgs” governance (if needed), without sacrificing auditability
- stateful workload support (PV + backup + restore + migration story) as a separate product decision
