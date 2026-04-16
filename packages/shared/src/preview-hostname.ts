/**
 * Produce a DNS label safe string (lowercase, hyphens).
 */
export function slugToDnsLabel(slug: string): string {
  const s = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s || 'project';
}

export function previewHostname(input: {
  pullRequestNumber: number;
  projectSlug: string;
  platformDomain: string;
}): string {
  const proj = slugToDnsLabel(input.projectSlug);
  return `pr-${input.pullRequestNumber}.${proj}.${input.platformDomain}`;
}

export function productionHostname(input: { projectSlug: string; platformDomain: string }): string {
  const proj = slugToDnsLabel(input.projectSlug);
  return `${proj}.${input.platformDomain}`;
}

/**
 * Hostnames must be platform-owned subdomains of platformDomain (exactly one subdomain level for prod, two for preview).
 */
export function isPlatformManagedHostname(hostname: string, platformDomain: string): boolean {
  const h = hostname.toLowerCase().trim();
  const d = platformDomain.toLowerCase().trim();
  if (!h.endsWith(`.${d}`)) return false;
  const prefix = h.slice(0, -(d.length + 1));
  if (!prefix || prefix.includes('..') || prefix.startsWith('.') || prefix.endsWith('.')) return false;
  const parts = prefix.split('.');
  if (parts.length === 1) return true;
  if (parts.length === 2) return (parts[0] ?? '').startsWith('pr-');
  return false;
}
