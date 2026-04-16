import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

let sdk: NodeSDK | undefined;

/**
 * Start the OpenTelemetry Node SDK (traces via OTLP). Honors OTEL_SDK_DISABLED=true.
 * Metrics/logs can be added in a follow-up; trace propagation uses W3C headers on HTTP and
 * `createTraceCarrierFromActiveContext` from `@opendeploy/shared` on BullMQ payloads.
 */
export function startOpenDeployOtel(serviceName: string): void {
  if (process.env['OTEL_SDK_DISABLED'] === 'true') {
    return;
  }
  if (sdk) {
    return;
  }

  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

  const exporter = new OTLPTraceExporter();
  const resource = new Resource({
    [ATTR_SERVICE_NAME]: process.env['OTEL_SERVICE_NAME'] ?? serviceName,
  });

  sdk = new NodeSDK({
    resource,
    traceExporter: exporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();

  const shutdown = () => {
    void sdk
      ?.shutdown()
      .catch(() => {})
      .finally(() => {
        sdk = undefined;
      });
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

export async function shutdownOpenDeployOtel(): Promise<void> {
  await sdk?.shutdown();
  sdk = undefined;
}
