## ADR 0006: Single registry target in Phase 2

### Status
Accepted (Phase 2)

### Context
Phase 2 is focused on proving the secure build pipeline and audit trail, not multi-registry product breadth.

### Decision
Support **one registry target** in Phase 2. Registry push can be enabled/disabled via worker configuration.

### Details
- Deterministic tags derived from project + commit SHA.
- Persist tag/digest metadata into `BuildArtifact`.

### Deferred
- multiple registry providers
- per-project registry configuration
- multi-region replication

