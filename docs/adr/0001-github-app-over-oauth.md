# ADR 0001 — GitHub App instead of OAuth App

## Status

Accepted — Phase 1

## Context

OpenDeploy needs repository access with least privilege, short-lived credentials, and clear installation boundaries per workspace.

## Decision

Use a **GitHub App** model (installation per account/org) rather than a classic OAuth App for primary Git integration.

## Consequences

- **Positive**: Fine-grained permissions, repo-scoped tokens, better alignment with GitHub’s recommended integration style.
- **Negative**: More setup (app registration, private key handling, webhook configuration) than a minimal OAuth flow.
