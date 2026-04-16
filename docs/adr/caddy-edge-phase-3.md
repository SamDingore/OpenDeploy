# ADR: Caddy for Phase 3 edge routing

## Status

Accepted — Phase 3

## Context

OpenDeploy needs HTTPS and hostname-based reverse proxying to customer **runtime** containers on a **platform-owned** domain. Phase 3 optimizes for:

- Low MVP complexity  
- Automatic TLS for named hosts where applicable  
- A single, auditable configuration pipeline (no ad hoc container labels as source of truth)

## Decision

Use **Caddy** as the dedicated edge reverse proxy. The control plane:

1. Persists intended routes in Postgres (`RouteBinding` + `PlatformHostname`).  
2. Generates a **Caddyfile** via `buildCaddyfile` from **only** validated rows.  
3. Applies configuration through `CADDY_ADMIN_URL` (`POST /load`) and/or `CADDYFILE_PATH`.

## Consequences

**Positive**

- Automatic TLS for real hostnames reduces custom cert wiring in early releases.  
- Site-block Caddyfiles are easy to review, diff in tests, and reason about in code review.  
- No requirement to expose the Docker socket to the edge plane.

**Negative / limits**

- Dynamic service discovery is **not** label-driven; route changes go through the control plane (by design for security).  
- Full config reload must be serialized to avoid conflicting writers; failures must be retryable (worker + queue).  
- Operators must protect the **admin API** as strongly as the control plane.

## Alternatives considered

- **Traefik** with Docker-label routing: fast for demos, but tends to couple routing to container metadata and encourages patterns that conflict with “routing truth in DB + audit” for a security-focused MVP. Traefik also warns against storing sensitive data in labels — a pattern we want to avoid normalizing.

- **Raw nginx**: maximum control, but TLS + reload ergonomics are more manual than Caddy for this phase’s goals.

## Follow-ups (Phase 4+)

- Multi-instance Caddy and **atomic** config distribution.  
- Optional integration with external ACME accounts / EAB for enterprise CAs.  
- Per-tenant custom domains with explicit ownership checks and issuance throttles.
