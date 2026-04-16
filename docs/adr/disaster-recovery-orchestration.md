# ADR: Disaster recovery orchestration (drain, evacuation, drills, and recovery events)

## Status

Accepted (Phase 7).

## Context

Phase 6 introduced region-aware topology and drain/failover primitives. At enterprise scale, “we have reconcilers” is not a disaster recovery story. Operators need deliberate, repeatable workflows:

- drain a region or edge fleet safely
- evacuate traffic and placement according to policy
- restore service deliberately and auditably
- run DR drills and record outcomes
- reason about RPO/RTO and dependency readiness (edge publish health, identity availability, queue/DB health)

If DR remains external runbooks:

- behavior varies by operator and incident
- safety checks are inconsistently applied
- audit logs are incomplete
- drills are hard to schedule and measure

## Decision

1. Represent DR intent as explicit plans:
   - introduce `DisasterRecoveryPlan` per region (and optionally per fleet), describing drain/evacuation/restore runbooks in machine-readable form.
2. Represent DR execution as explicit events:
   - introduce `RecoveryEvent` as the lifecycle record of a DR action (planned, running, completed, failed, cancelled), with timestamps and outcomes.
3. Implement DR orchestration as a first-class workflow:
   - policy-gated operations (who can trigger what)
   - identity-aware authorization
   - health-aware steering and target eligibility
   - staged publication for routing and placement changes
   - rollback and “stop the bleeding” semantics for failed applies
4. Treat DR drills as the same workflow class as incidents:
   - drills create `RecoveryEvent` rows
   - outcomes include objective attainment (RPO/RTO) and safety violations

## Data model (minimum)

- `DisasterRecoveryPlan`:
  - `regionId`, `planType`, `definitionJson`
  - `lastDrillAt`, `lastOutcome`
- `RecoveryEvent`:
  - `regionId`, `eventType`
  - `status`: `planned | running | completed | failed | cancelled`
  - `startedAt`, `finishedAt`
  - `summaryJson`

## Guardrails (must-haves)

- **Failover cannot bypass safety checks**:
  - identity plane availability and authorization are required (or safe, explicitly configured break-glass fallback)
  - target regions/fleets must be eligible and healthy per policy
- **Staged publication**:
  - large-scope routing changes must be applied in a staged, blast-radius-aware way when possible
  - failures trigger rollback and create operator-visible outcomes
- **Tenant boundary preservation**:
  - global DR actions must preserve tenant/environment scope constraints
- **Drills are measurable**:
  - record evacuation time, restoration time, and objective attainment

## Consequences

- DR becomes testable and repeatable, not tribal knowledge.
- Operators get visibility into readiness and outcomes, and can improve plans iteratively.
- Recovery workflows reuse the same publication safety and governance primitives as global traffic changes.
