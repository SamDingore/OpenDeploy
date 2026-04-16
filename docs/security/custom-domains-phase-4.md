# Security: custom domains (Phase 4)

## Threat framing

Custom domains introduce **ownership**, **DNS**, and **certificate issuance** risks that platform subdomains avoid. The design prioritizes:

1. **No edge activation without recorded verification**  
2. **Global hostname uniqueness** (including soft-fail rows that still hold the name)  
3. **No tenant-controlled edge configuration**  
4. **Auditable lifecycle** (domain + certificate events, control-plane audit log)  
5. **Secret hygiene** (no private keys or ACME account material in UI/logs; redacted Caddy admin errors)

## Controls

| Control | Implementation |
|---------|----------------|
| Hostname normalization | Lowercase, trim dot, ASCII MVP; reject invalid labels / apex for first cut. |
| Platform collision | Reject names that match `isPlatformManagedHostname` for `PLATFORM_PUBLIC_DOMAIN`. |
| Global uniqueness | `CustomDomain.hostname` unique; deleted/revoked rows retain the name until cleaned up intentionally. |
| Verification | CNAME to deterministic platform production hostname + TXT at `_opendeploy.<hostname>`. |
| Route attach | Requires **active** release, **healthy** probe history, and **verified** (or **detached** re-attach) domain. |
| Edge allowlist | Caddy config includes custom hosts only in explicit issuance/active states. |
| Teardown | Runtime stop detaches custom domains and reloads edge config so dead upstreams are not advertised. |
| Rate limits | Classify `rate_limited` vs transient; backoff via `nextRetryAt` + BullMQ retries; reconcile job avoids hot loops. |

## Out of scope (MVP)

- Automated DNS provider APIs  
- Wildcard certs  
- BYO certificates  
- Continuous post-activation ownership monitoring (planned Phase 5)

## Operational notes

- Protect **Caddy admin API** like a control-plane admin endpoint.  
- Protect **internal** domain job endpoints with `INTERNAL_API_SECRET`.  
- Use real DNS (not only `/etc/hosts`) when validating Let’s Encrypt HTTP-01 from the edge.
