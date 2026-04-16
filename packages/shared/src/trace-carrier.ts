import { context, propagation } from '@opentelemetry/api';

/** Inject W3C trace context from the active span into a string map (e.g. BullMQ job data). */
export function createTraceCarrierFromActiveContext(): Record<string, string> {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  return carrier;
}

/** Restore parent context from a carrier and run async work inside it. */
export function runWithTraceCarrier<T>(
  carrier: Record<string, string> | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const ctx = propagation.extract(context.active(), carrier ?? {});
  return context.with(ctx, fn);
}
