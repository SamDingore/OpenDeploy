## Worker isolation (Phase 2)

Phase 2 introduces **real untrusted builds**. The worker plane is treated as a **hostile execution boundary**.

## Trust boundaries

- **Web/API containers**: never execute untrusted repo code.
- **Workers**: execute builds and must be isolated from control-plane secrets and data.

## Required controls (baseline)

- **Worker-only build execution**: checkout and build occur only on worker nodes.
- **Internal auth**: worker calls control-plane internal endpoints with a dedicated `INTERNAL_API_SECRET` credential.
- **No token persistence**:
  - GitHub installation tokens are generated on-demand.
  - Raw tokens are never written to DB.
  - Worker logs redact tokens and mask clone URLs.
- **Ephemeral build workspace**: a unique temp directory per job; cleanup in `finally`.
- **Timeouts**: build commands are run with a per-job timeout.

## Practical note (local/dev)

The current Phase 2 implementation uses `docker buildx build` from the worker process. This requires access to a Docker engine on the worker host.

- Treat this as an **explicit trust decision** in early Phase 2.
- For improved posture, prefer a **rootless BuildKit** setup and isolate worker nodes at the network level.

## What Phase 2 does not do yet

- Network egress policy enforcement per build
- cgroups/CPU/memory quotas per build process
- seccomp/capability hardening of the build executor container

These are Phase 2 hardening follow-ups once the end-to-end build pipeline is proven in staging.

