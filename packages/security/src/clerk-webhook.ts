import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verifies Svix-style webhook signatures used by Clerk.
 * Headers: svix-id, svix-timestamp, svix-signature
 */
export function verifyClerkWebhookSignature(
  secret: string,
  rawBody: Buffer | string,
  svixId: string | undefined,
  svixTimestamp: string | undefined,
  svixSignature: string | undefined,
): boolean {
  if (!svixId || !svixTimestamp || !svixSignature) {
    return false;
  }
  const payload = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
  const signedContent = `${svixId}.${svixTimestamp}.${payload}`;
  const secretBytes = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64');
  const mac = createHmac('sha256', secretBytes);
  mac.update(signedContent);
  const expected = mac.digest('base64');

  const parts = svixSignature.split(' ');
  for (const part of parts) {
    const [version, sig] = part.split(',', 2);
    if (version !== 'v1' || !sig) continue;
    try {
      const a = Buffer.from(sig, 'base64');
      const b = Buffer.from(expected, 'base64');
      if (a.length === b.length && timingSafeEqual(a, b)) {
        return true;
      }
    } catch {
      /* ignore */
    }
  }
  return false;
}
