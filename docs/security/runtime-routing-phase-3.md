# Threat notes: runtime & routing (Phase 3)

Phase 3 introduces **arbitrary container execution** on the worker plane and **public ingress** on the edge plane. This document captures the main risks and the controls implemented in this phase.

## Asset inventory

- **Customer application code** (container images built in Phase 2).  
- **Platform secrets** (GitHub tokens, `INTERNAL_API_SECRET`, optional `SECRETS_ENCRYPTION_KEY`).  
- **Tenant secrets** (`EnvironmentSecret`, ciphertext in Postgres).  
- **Routing truth** (`PlatformHostname`, `RouteBinding`) — integrity directly impacts who receives traffic.

## Threat: container breakout / host compromise

**Risk:** A malicious or compromised image exploits the runtime to escape to the host or attack the worker.

**Controls (Phase 3):**

- Runtime containers are started **without** `--privileged`, **without** host networking, and **without** user-controlled bind mounts in the worker integration path.  
- CPU and memory limits are applied via `docker run` (`RUNTIME_CPU_LIMIT`, `RUNTIME_MEMORY_LIMIT`).  
- Build and runtime remain on the **worker** plane, not API/web.

**Residual:** Docker daemon access is still a high-trust capability; Phase 4+ should narrow this (rootless, isolated nodes, seccomp/AppArmor profiles).

## Threat: unauthorized ingress to internal services

**Risk:** Edge misconfiguration exposes internal admin interfaces or other tenants’ traffic.

**Controls:**

- Caddy configuration is **generated only** from `RouteBinding` rows marked `attached`; there is **no** user-supplied Caddyfile path.  
- Hostnames must match `isPlatformManagedHostname` for the configured `PLATFORM_PUBLIC_DOMAIN`.  
- Caddy admin (`CADDY_ADMIN`) must **not** be exposed on the public Internet in production; restrict to control-plane network only.

## Threat: routing before readiness (SSRF / takeover window)

**Risk:** Traffic is sent to a broken or malicious intermediate state.

**Controls:**

- `completeProvisionAfterHealth` requires a **successful** `HealthCheckResult` before creating an `attached` binding.  
- Production route swaps and preview updates **detach** prior bindings for the same `PlatformHostname` in a **single transaction** before attaching the new route.

## Threat: secret leakage via logs or UI

**Risk:** Runtime or build logs leak API keys; UI reveals secrets after creation.

**Controls:**

- Runtime log append applies **pattern redaction** for common `key=value` secret shapes.  
- `EnvironmentSecret` stores **ciphertext only**; API does not implement a “reveal” endpoint.  
- Audit entries for secrets record **names** and ids, not values.

## Threat: abusive TLS / domain issuance (Phase 4 preview)

**Risk:** Per-customer domains multiply ACME orders; Let’s Encrypt **rate limits** can brick issuance during incidents.

**Decision:** Phase 3 stays on a **single platform wildcard / platform subdomain** scheme. Custom domains are deferred until explicit rate-limit and ownership-verification design exists.

## Threat: stale preview routes and orphaned containers

**Risk:** Missed GitHub webhooks leave preview environments running.

**Controls:**

- `pull_request` `closed` triggers `teardownPreviewForPr`.  
- `ReleaseMaintenanceService` runs periodic **TTL** teardown for old preview releases (`PREVIEW_TTL_HOURS`).  
- Teardown jobs remove containers and call `applyTeardownDone` to normalize DB + edge config.

## Audit expectations

The following actions should generate `AuditEvent` rows (non-exhaustive):

- `release.created`, `release.status`, `release.promote`, `release.rollback`  
- `route.attached`, `release.teardown_enqueued`, `release.teardown_done`  
- `secret.upsert`  
