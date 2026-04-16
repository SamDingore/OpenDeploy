# Phase 4: custom domains and tenant certificate automation

Phase 3 kept all public hostnames on the **platform-owned** DNS tree and let Caddy obtain certificates for those stable names. Phase 4 is the next bounded step: **customer hostnames** (`app.customer.com`) with **recorded ownership verification**, **automatic TLS** aligned with Let’s Encrypt constraints, and **routing that stays DB-backed** (no raw tenant Caddyfiles, no unguarded on-demand issuance).

## Objective

Move from:

- platform-managed hostnames only  
- implicit platform TLS only for those names

to:

- user can register a **custom hostname** on a **production** environment  
- **CNAME + TXT** checks prove intent and reduce hijack risk before any edge config references the name  
- **Caddy** still terminates TLS and proxies to **healthy** runtimes; hostnames enter the generated config only after verification and attach workflow  
- **failures, retries, and rate limits** are classified and visible in the data model  
- **detach** and **runtime teardown** remove custom routes without breaking platform hostnames

## Split planes (unchanged)


| Plane       | Responsibility                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------- |
| **Control** | `apps/api`, `apps/web`, Postgres, Prisma, Redis, BullMQ, auth, audit, domain/certificate services |
| **Worker**  | Builds, runtime provision/teardown, **domain queue** processors (call internal APIs)              |
| **Edge**    | Caddy: TLS + reverse proxy from **validated** DB rows only                                        |


## Data model (Prisma)

New models:

- `CustomDomain` — hostname, apex hint, lifecycle `CustomDomainStatus`, verification token, optional `routeBindingId`, optional `activeCertificateId`.  
- `DomainVerificationCheck` — append-only outcomes for `cname_target` and `dns_txt` checks.  
- `CertificateRecord` — metadata and lifecycle for certs (MVP: **Caddy-managed** issuance; `externalOrderRef` documents that).  
- `DomainEvent` — structured timeline for UI/diagnostics.

`RouteBinding.platformHostnameId` is now **optional**: platform routes still set it; **custom-domain** routes use `platformHostnameId = null` and link from `CustomDomain.routeBindingId`.

## Lifecycle

Statuses (subset of flow):

1. `awaiting_verification` — user must publish DNS.
2. `verified` — checks passed; safe to attach.
3. `certificate_issuing` — route binding exists; edge reload in progress.
4. `active` — TLS probe (metadata) succeeded; traffic may flow if DNS points at the edge.

Jobs (`domains` BullMQ queue):

- `domain-verify`, `domain-attach`, `certificate-issue`, `certificate-renew`, `domain-detach`, `domain-reconcile` (scheduled sweep).

## Edge / Caddy

`CaddyService` (in `apps/api/src/edge/`) loads:

- all **attached** platform `RouteBinding` rows with a `PlatformHostname`, and  
- **attached** custom-domain bindings whose `CustomDomain.status` is one of  
`certificate_issuing | certificate_active | certificate_renewing | active`.

That mirrors an **allowlist**: names are not served merely because traffic arrived; they must be in an allowed DB state.

## API & UI

- REST under  
`workspaces/:workspaceId/projects/:projectId/environments/:environmentId/custom-domains`  
(production-only enforcement in service).  
- Dashboard: **Custom domains** link from the project environments list (production).  
- Panel: DNS instructions, recheck, attach to a **healthy active** release id, detach, retry issuance.

## Repository layout (new / moved)


| Path                                                        | Role                                                                                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `packages/db/prisma/schema.prisma`                          | `CustomDomain`, `DomainVerificationCheck`, `CertificateRecord`, `DomainEvent`; optional `RouteBinding.platformHostnameId` |
| `packages/db/prisma/migrations/0003_phase4_custom_domains/` | SQL migration                                                                                                             |
| `packages/shared/src/custom-hostname.ts`                    | Normalization, apex/subdomain MVP rules, TXT name helper                                                                  |
| `packages/shared/src/domain-state-machine.ts`               | Safe status transitions                                                                                                   |
| `packages/shared/src/domain-queue.ts`                       | `DOMAIN_QUEUE_NAME`, job payload typing                                                                                   |
| `packages/shared/src/acme-error-classify.ts`                | Rate limit vs transient vs DNS buckets                                                                                    |
| `apps/api/src/edge/`                                        | `EdgeModule`, `CaddyService` (platform + allowlisted custom routes)                                                       |
| `apps/api/src/custom-domains/`                              | Public controller, DTOs, DNS verify helpers, TLS probe, service                                                           |
| `apps/api/src/internal/internal-domains.controller.ts`      | Worker callbacks (`INTERNAL_API_SECRET`)                                                                                  |
| `apps/api/src/queue/domain-queue.service.ts`                | BullMQ producers                                                                                                          |
| `apps/worker/src/domain-worker.ts`                          | Domain queue consumer                                                                                                     |
| `apps/web/.../environments/[environmentId]/custom-domains/` | Dashboard page                                                                                                            |
| `apps/web/components/custom-domains-panel.tsx`              | Client UI                                                                                                                 |


## Local / staging notes

- Point customer DNS CNAMEs at the same edge that serves your `PLATFORM_PUBLIC_DOMAIN` tree.  
- Set `CADDY_ADMIN_URL` and `CADDY_ACME_EMAIL` when testing real issuance.  
- Worker must run so `domains` jobs and the periodic reconcile job execute.

## Phase 5 — Hardening and operations

Implemented as **Phase 5** (see `docs/architecture/phase-5.md`): node pools, rootless posture fields, OTel + queue trace propagation, reconcilers, workspace quotas, edge config versioning/rollback, and operator UI/API surfaces.

Remaining **domain product** work (often better tracked as Phase 6+ alongside platform maturity):

- **Re-verification**: periodic ownership re-checks; degrade or block routing if DNS drifts.  
- **Apex + DNS-01**: explicit apex support with DNS-01 challenge plumbing (no HTTP-01 shortcut).  
- **Wildcard custom hostnames** (only with DNS-01 and strong rate-limit strategy).  
- **DNS provider integrations** (optional) for automated TXT/CNAME.  
- **BYO certificate** upload and optional multi-CA / EAB.  
- **ARI / renewal** alignment as ecosystem standards stabilize; richer cert inventory from edge.  
- **Multi-instance Caddy**: serialized publication across a fleet (Phase 5 introduces versioning; HA rollout continues).  
- **Hostname abstraction** if platform + custom unification simplifies policy.

