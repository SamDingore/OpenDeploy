# ADR 0003 — Split control plane and worker plane

## Status

Accepted — Phase 1

## Context

Running untrusted build workloads co-located with the API increases blast radius (secrets, lateral movement, SSRF).

## Decision

Maintain a **strict split** between:

- **Control plane** (auth, data model, webhooks, enqueue, policy)
- **Worker plane** (clone/build/deploy simulation now; real Docker/BuildKit later)

## Consequences

- **Positive**: Cleaner trust boundaries; worker compromise does not imply full database access if internal credentials are scoped.
- **Negative**: More moving parts (extra service, internal auth, networking).
