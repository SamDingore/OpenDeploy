import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verifies GitHub webhook signature (X-Hub-Signature-256).
 * @see https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
 */
export function verifyGitHubWebhookSignature(
  secret: string,
  rawBody: Buffer | string,
  signatureHeader: string | undefined,
): boolean {
  if (!signatureHeader?.startsWith('sha256=')) {
    return false;
  }
  const digest = signatureHeader.slice('sha256='.length);
  const mac = createHmac('sha256', secret);
  const body = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;
  mac.update(body);
  const expected = mac.digest('hex');
  try {
    const a = Buffer.from(digest, 'hex');
    const b = Buffer.from(expected, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
