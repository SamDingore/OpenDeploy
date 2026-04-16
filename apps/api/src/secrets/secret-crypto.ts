import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export function sealSecret(plain: string, keyHex64: string): string {
  const key = Buffer.from(keyHex64, 'hex');
  if (key.length !== 32) {
    throw new Error('invalid_secrets_key_length');
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function openSealed(b64: string, keyHex64: string): string {
  const key = Buffer.from(keyHex64, 'hex');
  if (key.length !== 32) {
    throw new Error('invalid_secrets_key_length');
  }
  const buf = Buffer.from(b64, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
