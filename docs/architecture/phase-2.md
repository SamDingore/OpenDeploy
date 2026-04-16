## Phase 2: isolated build pipeline (no routing)

Phase 2 upgrades OpenDeploy from **simulated deployments** to a **real, auditable build pipeline**:

- Given a **GitHub-linked repo** and a **commit SHA**, the platform can **securely build a container image** and persist a **full audit trail**.
- Phase 2 ends at **image build + (optional) registry push + metadata persistence**.
- Phase 2 does **not** include preview URLs, production routing, custom domains, TLS automation, or runtime traffic switching.

## Architecture (still split-plane)

- **Control plane** (`apps/api`, `apps/web`): auth, API, DB, queue, UI, SSE log/status streaming.
- **Worker plane** (`apps/worker`): **source checkout + BuildKit build + log streaming + artifact persistence** only.

Repo code and build execution happen **only** on the worker plane.

## Phase 2 state machine

Deployments now track build phases:

- `created`
- `queued`
- `assigned`
- `fetching_source`
- `preparing_context`
- `building_image`
- `pushing_image`
- `build_succeeded`
- `build_failed`
- `cancelled`

## Data model additions

- **`Deployment`**: `commitSha`, `triggerSource`, build timing fields, `failureCode`/`failureDetail`.
- **`DeploymentAttempt`**: attempt metadata (`attemptNumber`, `queueJobId`, `workerNodeId`, timestamps).
- **`BuildArtifact`**: tag/digest + BuildKit metadata JSON (best-effort).
- **`SourceSnapshot`**: masked clone URL and pinned SHA reference for auditability.

## Operational flow (happy path)

1. Control plane persists a deployment and enqueues a BullMQ job.
2. Worker claims the job and transitions to `assigned`.
3. Worker requests a **GitHub App installation token** from the control plane (internal auth).
4. Worker clones the repo at the exact `commitSha` into an **ephemeral workspace**.
5. Worker runs a **BuildKit-backed build** via `docker buildx build` and streams logs to the control plane.
6. Worker persists `BuildArtifact` + `SourceSnapshot`, then marks `build_succeeded` (or `build_failed` with classification).

## Phase 3 TODO (routing phase)

- Edge routing + preview URLs
- TLS automation and custom domains
- Runtime release orchestration (separate from build)
- Rollbacks and traffic switching

