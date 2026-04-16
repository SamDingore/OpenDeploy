import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyGitHubWebhookSignature } from './github-webhook';

function sign(secret: string, body: string): string {
  const mac = createHmac('sha256', secret);
  mac.update(body);
  return `sha256=${mac.digest('hex')}`;
}

describe('verifyGitHubWebhookSignature', () => {
  it('accepts valid signature', () => {
    const secret = 'testsecret';
    const body = '{"action":"opened"}';
    const sig = sign(secret, body);
    expect(verifyGitHubWebhookSignature(secret, body, sig)).toBe(true);
  });

  it('rejects tampered body', () => {
    const secret = 'testsecret';
    const sig = sign(secret, '{"action":"opened"}');
    expect(verifyGitHubWebhookSignature(secret, '{"action":"closed"}', sig)).toBe(false);
  });

  it('rejects missing prefix', () => {
    const secret = 'testsecret';
    const body = '{}';
    const mac = createHmac('sha256', secret);
    mac.update(body);
    expect(verifyGitHubWebhookSignature(secret, body, mac.digest('hex'))).toBe(false);
  });
});
