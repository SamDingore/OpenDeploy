# ADR: Approval, exception, and break-glass model (enterprise governance)

## Status

Accepted (Phase 7).

## Context

By Phase 6, OpenDeploy can perform actions with significant production impact:

- routing changes (weighted/canary, region shifts)
- edge publication and rollback
- region drain/failover primitives
- policy enforcement decisions

Phase 7 expands this into **global** traffic management across multiple fleets. At enterprise scale, this requires formal controls:

- approval workflows for high-impact operations
- separation of duties (propose vs approve)
- auditable operator actions
- time-bounded policy exceptions
- emergency “break-glass” override path that is accountable, scoped, and temporary

If approvals are implemented as “manual checkboxes” without a strong model, the system risks:

- approving a different payload than intended
- inconsistent enforcement across subsystems
- hard-to-audit overrides and exception drift

## Decision

1. Introduce `ChangeSet` as the canonical unit of publication for sensitive operations:
   - captures *what* change is proposed (payload)
   - captures *who* proposed and approved
   - captures *scope* (tenant/environment/region/fleet)
   - captures lifecycle (validation, approval, apply, rollback)
2. Introduce `ApprovalPolicy` as the rule set for determining when approval is required, and who may approve, per scope and operation type.
3. Introduce `PolicyException` as an explicit, time-bounded override of specific policy rules:
   - exceptions must have `expiresAt`
   - expired exceptions are invalid by enforcement (not just UI)
   - exception creation/renewal can itself be approval-gated
4. Implement “break-glass” as a distinct operation class:
   - requires a reason and scope
   - produces separate audit and telemetry
   - is time-bounded
   - does not allow raw edge edits as a source of truth

## Data model (minimum)

- `ChangeSet`:
  - `scopeType`, `scopeId`, `changeType`
  - `proposedByUserId`, `approvedByUserId`
  - `status`: `pending | awaiting_approval | approved | rejected | applying | applied | failed | rolled_back | expired`
  - `payloadJson`, `appliedAt`
- `ApprovalPolicy`:
  - `scopeType`, `scopeId`
  - `operationType`
  - `rulesJson`, `isEnabled`
- `PolicyException`:
  - `policyRuleId`
  - `scopeType`, `scopeId`
  - `reason`, `expiresAt`, `approvedByUserId`

## Guardrails (must-haves)

- approvals must bind to a **specific payload hash** (no approving a moving target)
- separation of duties must be supported (policy can require different principals)
- all approval decisions and applies must emit:
  - **audit events** (complete, queryable)
  - **OpenTelemetry spans** (correlatable to edge publication and DR workflows)
- break-glass usage must be visible and reviewable:
  - distinct audit action namespace/tagging
  - metrics for usage frequency and scope

## Consequences

- Sensitive operations become consistent across traffic, policy, and DR subsystems.
- Operators can reason about “what is pending”, “what was approved”, and “what was applied” using a single primitive (`ChangeSet`).
- Exceptions do not silently accumulate; expiry is enforced by the platform.
- Break-glass exists without turning into an unbounded bypass of safety guarantees.
