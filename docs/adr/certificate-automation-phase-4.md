# ADR: certificate automation for custom domains (Phase 4)

## Status

Accepted — Phase 4 MVP

## Context

Let’s Encrypt enforces **rate limits**. Caddy’s **on-demand TLS** is unsafe in production without an explicit **permission** step. OpenDeploy already generates static site blocks per hostname from DB state.

## Decision

- Keep **Caddy** as the ACME client for custom hostnames **after** they are allowlisted in DB.  
- Persist **`CertificateRecord`** rows for audit, failure codes, and renewal scheduling signals.  
- Use a **TLS peer certificate probe** (metadata only, `rejectUnauthorized: false`) after edge reload to populate `notBefore` / `notAfter` and masked serial — **not** to trust the chain for authentication.  
- Model `externalOrderRef = "caddy-managed"` to document that the ACME order is not exported from the edge in MVP.

Issuance is **not** triggered from arbitrary request paths; it flows through **queue jobs** and **internal** APIs.

## Consequences

**Positive**

- Aligns with Caddy’s static-config model and avoids unguarded on-demand issuance.  
- Central place to classify `rate_limited`, transient, and misconfiguration errors.  
- Clear separation: verification ≠ issuance ≠ attach.

**Negative / limits**

- No direct ACME order URL or JWS logging in MVP.  
- Renewal mostly relies on Caddy’s internal renewal; the control plane **reconciles** expiries and can nudge via reload/probe.

## Follow-ups

- Export structured cert inventory from Caddy admin API where available.  
- ARI-aware renewal policy as standards and Caddy versions evolve.  
- Optional external ACME accounts / EAB for enterprise CAs.
