# ADR: Progressive delivery model (release strategies + traffic assignments)

## Status

Accepted (Phase 6).

## Context

Phase 3 introduced health-gated routing and production rollback, but assumed “instant cutover”: one active production release per environment.

Phase 6 introduces multi-region and multiple execution backends. As a result:

- routing changes become more frequent and more complex
- ad hoc edge edits become risky and hard to audit
- automated rollback needs consistent health and SLO inputs

We need progressive delivery as a **first-class release policy layer**, independent of any one edge implementation.

## Decision

1. Add a `ReleaseStrategy` model per environment with types:
   - `instant`
   - `canary`
   - `weighted`
   - `manual_promote`
2. Represent traffic movement via explicit `TrafficAssignment` rows (per route binding, per release, optional per region) rather than implicit edge diffs.
3. Implement a rollout orchestrator that transitions rollout state with:
   - health gating
   - policy gating
   - audit logging for every transition
4. Keep routing provider pluggable:
   - Phase 6 can implement weighted/canary via the existing edge plane first
   - Kubernetes Gateway API is a long-term alignment target when Kubernetes routing becomes primary

## Data model (minimum)

- `ReleaseStrategy`: `environmentId`, `type`, `configJson`
- `TrafficAssignment`: `routeBindingId`, `releaseId`, `weight`, `regionId`, `status`

Progressive release states:

- `pending`
- `warming`
- `receiving_canary`
- `evaluating`
- `promoted`
- `rolled_back`
- `failed`
- `terminated`

## Guardrails (must-haves)

- no traffic weight > 0 for a candidate release unless:
  - runtime health checks passed and are recent enough per policy
  - policy engine approves the transition
  - an audit event is recorded
- rollback triggers must be:
  - explicitly enabled per environment
  - based on defined signals (health probe, OTel-derived SLOs)
  - rate-limited to prevent oscillation

## Consequences

- Progressive delivery becomes auditable and consistent across regions/backends.
- Routing providers can evolve (edge-first → Gateway API) without rewriting rollout logic.
- Operators gain clear visibility into “what traffic is where” and “why promotion/rollback happened”.
