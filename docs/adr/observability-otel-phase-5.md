# ADR: Observability with OpenTelemetry (Phase 5)

## Status

Accepted (Phase 5).

## Context

Logs and DB audit rows are insufficient for **partial failures** across API processes, BullMQ workers, and edge reloads. **OpenTelemetry** provides a **vendor-neutral** path for **traces**, **metrics**, and (later) **logs** correlation.

## Decision

1. Package **`@opendeploy/telemetry`** wraps `@opentelemetry/sdk-node`, OTLP HTTP trace export, and **auto-instrumentations** (with filesystem instrumentation disabled to reduce noise).
2. **API** and **worker** call `startOpenDeployOtel` from small `instrumentation.ts` files loaded **before** application code.
3. **BullMQ** jobs carry an optional `traceCarrier: Record<string, string>` populated via `createTraceCarrierFromActiveContext()` from `@opendeploy/shared`; workers restore context with `runWithTraceCarrier`.
4. Standard env vars: `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`, `OTEL_SDK_DISABLED=true` to disable.

## Metrics and SLOs (minimum set)

Emit from apps once metric readers are enabled (follow-up): `build_queue_depth`, `build_duration_seconds`, `release_provision_duration_seconds`, `runtime_start_failures_total`, `route_activation_failures_total`, `edge_config_apply_duration_seconds`, `domain_verification_failures_total`, `certificate_renewal_failures_total`, `worker_quarantines_total`.

**SLO candidates**: successful build completion rate, runtime activation rate, route attach latency after health success, custom-domain issuance success rate, cert renewal before expiry, worker queue wait time, edge config apply success rate.

## Consequences

- Backend choice (Grafana Cloud, Honeycomb, Jaeger, etc.) is an **environment** concern; OpenDeploy stays on **OTLP**.
- **TelemetrySpanLink** can back UI “open trace” buttons without coupling to a specific vendor’s API shape.
