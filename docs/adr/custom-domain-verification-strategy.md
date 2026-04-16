# ADR: custom domain verification (Phase 4)

## Status

Accepted — Phase 4 MVP

## Context

Before the edge may obtain or serve TLS for `customer.com` hostnames, the platform must **prove** that the tenant controls DNS. Let’s Encrypt will validate control again during HTTP-01, but OpenDeploy must not rely on “traffic appeared” as an ownership signal.

## Decision

Use **Track A (MVP)** for normal subdomains:

1. **CNAME** the custom hostname to the **deterministic production platform hostname**  
   (`<project-slug>.<PLATFORM_PUBLIC_DOMAIN>`).  
2. **TXT** record at `_opendeploy.<custom-hostname>` containing an unguessable `verificationToken`.

Both must pass before `CustomDomain` may transition to `verified`.

**Apex** hostnames and **DNS-01** are **deferred** (Track B): they require different challenge and routing assumptions.

## Consequences

**Positive**

- Predictable instructions for users and support.  
- CNAME encodes routing intent toward the platform edge.  
- TXT reduces accidental or malicious claims if CNAME alone were used.

**Negative / limits**

- Requires two DNS changes.  
- Does not cover apex domains in MVP.  
- Does not yet implement periodic re-verification after activation.

## Alternatives

- HTTP token file on an origin the customer controls (not used: we optimize for edge-aligned CNAME-first flow).  
- DNS provider APIs (deferred).
