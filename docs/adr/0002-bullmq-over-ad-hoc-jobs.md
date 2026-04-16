# ADR 0002 — BullMQ for orchestration

## Status

Accepted — Phase 1

## Context

Deployments require durable queueing, retries, and a worker pool model that can grow into real build agents.

## Decision

Use **Redis + BullMQ** as the job transport for deployment pipeline execution.

## Consequences

- **Positive**: Battle-tested retries/backoff, clear separation between API enqueue and worker consumption.
- **Negative**: Redis becomes a hard dependency; must monitor memory/eviction policies in production.
