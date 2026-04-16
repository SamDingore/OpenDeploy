# Threat model — Phase 1

## Assets

- User identities (Clerk) and workspace membership.
- GitHub installation metadata and webhook payloads.
- Deployment history, logs, and audit trail.
- Internal worker authentication (`INTERNAL_API_SECRET`).

## Adversaries

- Anonymous internet actors hitting public endpoints (webhooks).
- Authenticated but low-privilege users attempting cross-workspace access.
- Compromised worker or leaked internal secret.

## Controls implemented

| Area | Control | Notes |
|------|---------|--------|
| GitHub webhooks | HMAC-SHA256 (`X-Hub-Signature-256`) | Implemented in `packages/security`; enforced before persistence. |
| Webhook abuse | Idempotent `WebhookEvent` rows | Unique `idempotencyKey` + `(provider, deliveryId)` prevents double processing. |
| AuthN | Clerk JWT verification (`@clerk/backend`) | Bearer tokens on API; Next.js middleware when keys are configured. |
| AuthZ | `WorkspaceAccessGuard` + `MinWorkspaceRole` | Membership required; role hierarchy enforced. |
| Worker API | `X-Internal-Secret` | Separate from user JWT; must be long, random, and rotated if leaked. |
| Audit | Append-style `AuditEvent` | Sensitive actions create records; worker transitions use `deployment.status.system`. |
| Logs / UI | Control-character stripping | Web log viewer strips control chars; prefer text nodes (no raw HTML). |
| Error responses | `AllExceptionsFilter` | Returns generic codes/messages; no stack traces to clients in production (Nest defaults + filter). |

## Explicit non-goals (Phase 1)

- Production routing / multi-tenant edge (Caddy) — deferred.
- Encryption at rest for secrets — only partial (DB relies on Postgres volume security); application-level secret encryption not implemented.
- Rate limiting on `/webhooks/github` — recommended for Phase 2 (reverse proxy or Nest throttler once keying strategy is defined).

## Operational notes

- **Development convenience**: Next.js middleware becomes a no-op when Clerk keys are missing so `next build` succeeds without live Clerk configuration. **Production deployments must always set Clerk keys** so authentication is enforced.
- **Internal secret**: Treat like a root credential for worker-plane operations; scope narrowly and rotate on compromise.

## Remaining risks / Phase 2 work

- Add WAF / edge rate limits for webhook endpoints.
- Signed SSE URLs or short-lived tokens instead of trusting only the Next proxy path.
- Clerk webhook signature verification endpoint (env `CLERK_WEBHOOK_SECRET` is scaffold-ready in security package).
- mTLS or network policies between worker and API in real deployments.
