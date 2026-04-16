# ADR: Edge (Caddy) config versioning and rollback

## Status

Accepted (Phase 5).

## Context

Edge configuration is generated from **Postgres allowlists** (platform + verified custom domains). Mis-issuance or a bad reload can break traffic; operators need **history**, **audit**, and **rollback** without hand-editing production Caddyfiles.

## Decision

1. Each successful **file write** or **admin POST /load** creates an **`EdgeConfigVersion`** row: monotonic `version` per optional `EdgeNode`, `configHash`, full `bodySnapshot`, `applyStatus`, `actorHint`.
2. **`EDGE_NODE_NAME`** optionally scopes versions to an `EdgeNode` row (for multi-edge futures).
3. **Rollback** loads a prior **applied** snapshot and POSTs it again, then appends a **new** version noting `rollback_from_vN`. Failures append **`failed`** rows with error text.
4. **Preferred admin transport** is **`CADDY_ADMIN_UNIX_SOCKET`**; TCP **`CADDY_ADMIN_URL`** remains for dev.

## Consequences

- Large route tables imply large `bodySnapshot` rows—acceptable for moderate scale; **hash-only** retention policies may be added later.
- **Multi-edge** requires **serialized** publication and **per-node** version streams (Phase 5 seeds the model; full HA rollout continues in Phase 6).
