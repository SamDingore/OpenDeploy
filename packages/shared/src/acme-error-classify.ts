export type AcmeFailureKind = 'rate_limited' | 'dns_propagation' | 'misconfiguration' | 'transient' | 'unknown';

/**
 * Classify Caddy / ACME error text for retry policy (no secret material should be passed in).
 */
export function classifyAcmeOrEdgeError(message: string): AcmeFailureKind {
  const m = message.toLowerCase();
  if (m.includes('rate limit') || m.includes('too many certificates') || m.includes('429')) {
    return 'rate_limited';
  }
  if (m.includes('timeout') || m.includes('temporary') || m.includes('503') || m.includes('connection refused')) {
    return 'transient';
  }
  if (m.includes('dns') || m.includes('nxdomain') || m.includes('no such host')) {
    return 'dns_propagation';
  }
  if (m.includes('incorrect') || m.includes('invalid') || m.includes('unauthorized') || m.includes('403')) {
    return 'misconfiguration';
  }
  return 'unknown';
}

export function suggestedBackoffMs(kind: AcmeFailureKind, attempt: number): number {
  const base =
    kind === 'rate_limited'
      ? 3600_000
      : kind === 'dns_propagation'
        ? 120_000
        : kind === 'transient'
          ? 15_000
          : 60_000;
  const mult = Math.min(64, 2 ** Math.max(0, attempt - 1));
  return Math.min(base * mult, 24 * 3600_000);
}
