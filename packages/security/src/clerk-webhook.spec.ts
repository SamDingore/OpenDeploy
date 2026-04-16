import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyClerkWebhookSignature } from './clerk-webhook';

describe('verifyClerkWebhookSignature', () => {
  it('accepts v1 signature', () => {
    const key = Buffer.alloc(32, 9);
    const secret = `whsec_${key.toString('base64')}`;
    const id = 'msg_123';
    const ts = '1234567890';
    const payload = '{"type":"user.created"}';
    const signedContent = `${id}.${ts}.${payload}`;
    const secretBytes = key;
    const expected = createHmac('sha256', secretBytes).update(signedContent).digest('base64');
    const svixSignature = `v1,${expected}`;
    expect(
      verifyClerkWebhookSignature(secret, payload, id, ts, svixSignature),
    ).toBe(true);
  });

  it('rejects bad signature', () => {
    const rawSecret = Buffer.from('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa').toString('base64');
    const secret = `whsec_${rawSecret}`;
    expect(
      verifyClerkWebhookSignature(
        secret,
        '{}',
        'id',
        'ts',
        'v1,AAAA',
      ),
    ).toBe(false);
  });
});
