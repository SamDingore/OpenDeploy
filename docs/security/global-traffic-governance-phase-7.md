# Security — Global traffic, governance, and recovery (Phase 7)

Phase 7 expands OpenDeploy from “multi-region capable” into “globally operable”: multiple edge fleets, global request steering, governance gates, and disaster recovery workflows.

This phase introduces **high-blast-radius** operations (global routing changes, regional evacuation, break-glass overrides). The security posture must prioritize **validation**, **approval**, **auditability**, and **identity-aware authorization**.

## Trust boundaries (Phase 7)

- **Control plane** (API/web/DB/Redis/queues): source of truth for traffic policies, approvals, change sets, DR plans, and audit events.
- **Edge fleets** (one or more per region): terminate TLS and route traffic; publish/apply operations are production-impacting and must be rollbackable.
- **Execution domains** (workers/runtimes, optional Kubernetes clusters): run tenant workloads; emit health and telemetry; participate in failover safety checks.
- **Identity plane** (SPIFFE/SPIRE-compatible issuance and verification): authorization root for plane-to-plane calls; must degrade safely.

## Phase 7 security goals

- **No unsafe global changes**: global traffic/routing changes are validated and staged; failures roll back automatically.
- **Governance by default**: high-impact operations can require approval; separation of duties is supported.
- **Exceptions are temporary**: policy exceptions are explicit, time-bounded, and reviewable.
- **Break-glass is auditable**: emergency override exists but is separately logged, scoped, and attributable.
- **Failover is safe**: drain/evacuation cannot bypass health and identity checks; tenant scope is preserved.
- **Operator actions are complete**: all production-impacting actions are recorded with actor, scope, reason, and outcome.

## Mandatory controls (must-have)

### 1) Validation gates for global traffic and edge publication

No global traffic change is applied without pre-apply validation:

- **schema validation** (policy config shape)
- **scope validation** (tenant/environment boundaries preserved)
- **policy evaluation** (placement/failover/egress/compliance rules)
- **health validation** (target regions/fleets are eligible and healthy)
- **blast-radius assessment** (what % of traffic/users/tenants are affected)
- **publication readiness** (edge fleets reachable; rollback artifact available)

Validation results must be recorded on the associated `ChangeSet`, including failure reasons suitable for an operator UI.

### 2) Approval gates and separation of duties

Approval policies can require approvals for operation classes such as:

- increasing production rollout traffic beyond a threshold
- cross-region failover (manual override)
- fleet/region drain + evacuation
- domain/certificate policy overrides
- backend switches for regulated workloads
- quota increases above defaults

Separation of duties requirements:

- “propose” and “approve” must be attributable, and policy can require different roles for each.
- approvals must be tied to a specific `ChangeSet` payload hash (no “approve whatever is current”).

### 3) Policy exceptions with expiry enforcement

Exceptions are allowed for operational reality, but must be safe:

- exceptions must reference a policy rule (or rule set) and include a reason
- exceptions must include **`expiresAt`** and expire automatically
- expired exceptions must not be usable, even if still present
- exception creation and renewal are approval-gated when configured

### 4) Break-glass workflow (emergency override)

Break-glass is allowed only as a deliberate workflow:

- break-glass creates a distinct audit trail (separate action namespace / tagging)
- requires a reason and scope (tenant/env/region/fleet)
- is time-bounded (short TTL)
- emits telemetry for monitoring usage and potential abuse
- can be disabled or restricted by tenant governance settings

Break-glass must not bypass:

- tenant boundary checks
- identity verification requirements (who is calling)
- “unsafe apply” restrictions (e.g. no raw edge edits as source of truth)

### 5) Drain / evacuation / restore safety

Draining a region or fleet is a high-impact change and must be safety-checked:

- must be policy-gated (who can drain, under what circumstances)
- must verify identity plane availability (or enter a safe fallback mode that prevents unsafe reroutes)
- must be health-aware (avoid routing to degraded targets)
- must be reversible with an explicit restoration workflow

### 6) Tenant scope preservation

Global operations must preserve tenant and environment boundaries:

- a `ChangeSet` must encode its scope (`scopeType`, `scopeId`)
- apply handlers must enforce “can only touch within scope”
- cross-scope changes require explicit operator operation type and governance gates

## Identity requirements (SPIFFE direction)

As multi-fleet failover expands, OpenDeploy should prefer:

- short-lived workload identity for plane-to-plane operations
- mTLS where possible for edge/worker/control interactions
- explicit identity-based authorization for:
  - global traffic apply/rollback
  - edge fleet publication
  - drain/evacuation workflows
  - DR drill execution and recording

If identity issuance is unavailable:

- fail **closed** for global routing changes (no unsafe apply)
- allow only explicitly configured break-glass operations, with additional auditing and scope restrictions

## Disaster recovery security

### Backup and restore

- control-plane backups must be authenticated, encrypted, and integrity-checked
- restore operations must be approval-gated and audited
- periodic backup/restore validation should be recorded as drills/events

### DR drills and recorded outcomes

- DR drill execution must be a first-class workflow that creates `RecoveryEvent` rows
- drills should record RPO/RTO attainment and any safety violations

## Observability and audit requirements

### Audit events (minimum)

Audit must exist for:

- `ChangeSet` lifecycle transitions (proposed, approved, rejected, applied, rolled_back)
- approval decisions (who approved, policy rule matched, decision time)
- policy denials and exception usage
- break-glass activations and expirations
- drain/evacuate/restore operations
- failover triggers and selected targets
- DR drill execution and outcomes

### OpenTelemetry (minimum)

Emit telemetry for:

- global route publication latency and errors
- edge-fleet apply latency and failures (by fleet/region)
- failover trigger reason + selected strategy
- evacuation time + restoration time
- approval lead time
- policy-denied operations
- break-glass usage rate and scope
- DR drill success rate and recovery objective attainment

## Acceptance criteria (security)

Phase 7 security is acceptable when:

1. No global traffic change can be applied without recorded validation results.
2. High-impact operations can be gated by approval policy with separation-of-duties support.
3. Policy exceptions always expire and expired exceptions are enforced as invalid.
4. Break-glass actions are separately audited and time-bounded.
5. Region/fleet drain and failover workflows cannot bypass health + identity checks.
6. Tenant scope is preserved across global traffic operations.
