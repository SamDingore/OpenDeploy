import { describe, expect, it } from 'vitest';
import { classifyAcmeOrEdgeError, suggestedBackoffMs } from './acme-error-classify';

describe('classifyAcmeOrEdgeError', () => {
  it('detects rate limits', () => {
    expect(classifyAcmeOrEdgeError('Error: rate limit exceeded')).toBe('rate_limited');
  });

  it('detects transient errors', () => {
    expect(classifyAcmeOrEdgeError('connection timeout')).toBe('transient');
  });
});

describe('suggestedBackoffMs', () => {
  it('uses longer base for rate limits', () => {
    expect(suggestedBackoffMs('rate_limited', 1)).toBeGreaterThan(
      suggestedBackoffMs('transient', 1),
    );
  });
});
