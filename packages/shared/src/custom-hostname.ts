import { isPlatformManagedHostname } from './preview-hostname';

const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i;

/**
 * Lowercase, trim trailing dot, IDNA not applied (ASCII hostnames only for MVP).
 */
export function normalizeCustomHostname(input: string): string {
  let h = input.trim().toLowerCase();
  if (h.endsWith('.')) h = h.slice(0, -1);
  return h;
}

/**
 * Returns apex hostname (registrable domain approximation): last two labels.
 * MVP: does not handle multi-part public suffixes (co.uk).
 */
export function deriveApexDomain(hostname: string): string {
  const labels = hostname.split('.').filter(Boolean);
  if (labels.length < 2) return hostname;
  return `${labels[labels.length - 2]}.${labels[labels.length - 1]}`;
}

export function isApexHostname(hostname: string): boolean {
  return hostname.split('.').filter(Boolean).length <= 2;
}

export function isValidCustomHostnameShape(hostname: string): boolean {
  if (!hostname || hostname.length > 253) return false;
  if (hostname.includes('..')) return false;
  const labels = hostname.split('.');
  if (labels.length < 3) return false;
  for (const label of labels) {
    if (!label || label.length > 63) return false;
    if (!LABEL.test(label)) return false;
  }
  return true;
}

export function collidesWithPlatformDomain(hostname: string, platformDomain: string): boolean {
  return isPlatformManagedHostname(hostname, platformDomain);
}

export function verificationTxtRecordName(hostname: string): string {
  return `_opendeploy.${hostname}`;
}
