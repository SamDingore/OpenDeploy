# ADR 0004 — Edge (Caddy vs Nginx) deferred

## Status

Accepted — Phase 1

## Context

Phase 1 intentionally avoids public routing to customer workloads. An edge reverse proxy is still part of the long-term architecture.

## Decision

**Defer edge implementation.** Prefer **Caddy** for the first real edge phase (automatic TLS, simpler MVP config). Keep **Nginx** as an option if advanced tuning or organizational standards require it later.

## Consequences

- Phase 1 ships without Caddy/Nginx in-repo.
- Phase 2+ should add edge configuration alongside preview URL routing.
