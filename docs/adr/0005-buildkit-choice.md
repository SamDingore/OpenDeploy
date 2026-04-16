## ADR 0005: Use BuildKit (via buildx) for builds

### Status
Accepted (Phase 2)

### Context
Phase 2 requires a real image build pipeline with strong performance characteristics and a future-ready path for cache and metadata capture.

### Decision
Use **BuildKit-backed builds** via `docker buildx build` rather than the legacy `docker build` builder flow.

### Rationale
BuildKit is documented by Docker as providing:

- parallel stage execution
- skipping unused stages
- incremental context transfer
- better caching primitives and extensibility

These properties map directly to multi-build platform needs.

### Consequences
- Worker nodes must have BuildKit available (directly or via buildx).
- Build metadata can be captured via BuildKit/buildx metadata output (stored in `BuildArtifact.metadataJson`).

