import { describe, expect, it } from 'vitest';
import { WebhookProvider } from '@opendeploy/shared';
import { webhookIdempotencyKey } from './idempotency';

describe('webhookIdempotencyKey', () => {
  it('is stable per provider and delivery id', () => {
    expect(webhookIdempotencyKey(WebhookProvider.github, 'abc')).toBe('github:abc');
  });
});
