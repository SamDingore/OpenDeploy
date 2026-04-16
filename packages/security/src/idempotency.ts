import { createHash } from 'node:crypto';

import { WebhookProvider } from '@opendeploy/shared';

export function webhookIdempotencyKey(
  provider: WebhookProvider,
  deliveryId: string,
): string {
  return `${provider}:${deliveryId}`;
}

export function hashPayload(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
