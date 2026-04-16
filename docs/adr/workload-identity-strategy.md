# ADR: Workload identity strategy (SPIFFE/SPIRE-compatible)

## Status

Accepted (Phase 6).

## Context

Phase 5 introduced worker posture and a non-secret `workerIdentityFingerprint`, but internal trust still primarily relies on shared secrets (e.g. `INTERNAL_API_SECRET`) and network boundaries.

Phase 6 adds:

- multiple regions
- regional edge fleets
- multiple execution backend types (Docker + Kubernetes)

In this environment, static shared secrets become a weak primitive and create operational risk:

- broad blast radius if leaked
- difficult rotation across fleets
- no strong identity for authorization decisions

SPIFFE defines a standard for securely identifying software systems in dynamic environments. SPIRE is a production-ready implementation for node/workload attestation and identity issuance.

## Decision

1. Introduce a **pluggable identity provider abstraction** with SPIFFE concepts as the default direction.
2. Store identity lifecycle in `IdentityRecord`:
   - `spiffeId`
   - `kind` (`worker`, `edge`, `runtime-agent`, `control-service`)
   - `issuedAt`, `expiresAt`, `status`
3. Prefer **short-lived identity documents** (e.g. SVIDs) for internal plane-to-plane communication.
4. Authorize sensitive internal operations based on:
   - identity (subject, kind, region/backend attributes)
   - role and policy rules (not network location)
5. Keep `INTERNAL_API_SECRET` as a **bootstrap** mechanism only, to support incremental rollout.

## Attestation (baseline expectations)

- **Worker/edge nodes**: node attestation appropriate to deployment environment (e.g. join token + pinned fingerprint initially; stronger methods later).
- **Kubernetes workloads**: workload attestation based on Kubernetes service account identity and cluster trust (SPIRE Kubernetes workload attestor pattern).

## Consequences

- Internal trust becomes explicit and scalable across regions and backends.
- Policy evaluation can incorporate identity attributes (who/what is calling, from which region/backend, with what role).
- Migration complexity is manageable because identity can be enabled progressively while legacy shared-secret paths remain as bootstrap.
