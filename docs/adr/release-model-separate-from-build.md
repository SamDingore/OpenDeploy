# ADR: Release model separate from build (Deployment)

## Status

Accepted — Phase 3

## Context

Phase 2 introduced a rich **`Deployment`** lifecycle for **building** images (`DeploymentStatus` from `created` through `build_succeeded` / `build_failed`). Runtime concerns (containers, health, routes, traffic cutover) are a **different** safety and state domain:

- Builds are **batch** jobs with mostly idempotent artifacts.  
- Releases are **long-lived** or **session-like** (containers, probes, edge bindings) with different failure modes and permissions.

Overloading `Deployment` for both would couple build retries to traffic switches and complicate audit (“was this record a build or a live route?”).

## Decision

Introduce explicit **`Release`** (and related `RuntimeInstance`, `RouteBinding`, `PlatformHostname`, `HealthCheckResult`) models:

- A `Release` references the **`BuildArtifact`** (and originating `Deployment`) but tracks its **own** status machine (`ReleaseStatus`).  
- **Production** environments maintain `Environment.activeReleaseId` for the single live release pointer.  
- **Preview** releases key off `pullRequestNumber` + preview `Environment`.

`Deployment` remains the build/audit unit; `Release` is the runtime/traffic unit.

## Consequences

**Positive**

- Clear APIs and UI: “build logs” vs “runtime logs / health / URL”.  
- Rollback can reference a **prior release** without re-running a build.  
- Teardown and TTL jobs target **releases**, not ambiguous deployment rows.

**Negative**

- More joins in queries; must keep foreign keys and cascades disciplined.  
- Product language must educate users on build vs release (documentation + UI labels).

## Alternatives considered

- **Single table** with parallel status enums — rejected: high confusion and risky state combinations.  
- **Deployment = release** — rejected: breaks audit clarity when rebuilding the same commit or retrying builds.
