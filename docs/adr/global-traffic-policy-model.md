# ADR: Global traffic policy model (multi-fleet request steering)

## Status

Accepted (Phase 7).

## Context

Phase 6 added multi-region topology and progressive delivery. That enables region-aware placement and weighted rollout, but does not yet provide a safe, explicit model for **global request steering** across:

- multiple edge fleets
- region preference and failover
- health-aware routing decisions
- controlled evacuation and restoration

Ad hoc mechanisms (manual edge edits, scattered DNS changes) create risk:

- changes are hard to validate and audit
- blast radius is unclear
- rollback is inconsistent
- global misconfiguration can affect every tenant at once

We need global traffic steering to be a **policy-driven control-plane primitive** with staged publication and rollback.

## Decision

1. Introduce `EdgeFleet` as a first-class model representing a publish/apply target group of edge nodes, explicitly associated with a region and lifecycle state.
2. Introduce `GlobalTrafficPolicy` as the source of truth for **how requests are steered globally** for an environment.
3. Treat global traffic changes as **versioned change sets**:
   - validate before apply (policy + health + blast-radius checks)
   - stage publication across fleets
   - automatically roll back on failed apply
4. Keep the routing semantics aligned with Kubernetes **Gateway API** concepts (roles, delegation, protocol-aware routing) without exposing raw edge config as the API.

## Data model (minimum)

- `EdgeFleet`:
  - `name`, `regionId`, `status`, `publicationMode`, `capacityHintsJson`
- `GlobalTrafficPolicy`:
  - `environmentId`
  - `strategyType`:
    - `primary_failover`
    - `weighted_global`
    - `geo_preferred`
    - `manual_override`
  - `configJson`
  - `status`:
    - `draft`
    - `validating`
    - `ready`
    - `applied`
    - `failed`
    - `rolled_back`

## Behavior (must-haves)

- **Health-aware steering**:
  - do not route to fleets/regions that are unhealthy or not eligible per policy
  - failover must record the trigger reason and selected targets
- **Evacuation and restoration**:
  - draining a region/fleet is an explicit workflow (not an edge edit)
  - restoration is explicit (no silent “auto return” without policy)
- **Safety**:
  - no global policy apply without validation and an auditable change record
  - publication must be staged (blast-radius-aware) where possible
  - rollback must be supported for edge publication

## Consequences

- Global request steering becomes a first-class, auditable control-plane function rather than a set of external runbooks.
- Multi-fleet operations (drain, quarantine, restore) can be encoded into workflows and policy evaluation.
- Routing providers can evolve (edge-first → Gateway API implementation) without changing the operator intent model.
