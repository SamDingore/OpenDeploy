import { promises as dns } from 'node:dns';

export async function resolveCnameChainLeafTarget(hostname: string): Promise<string | null> {
  try {
    const records = await dns.resolveCname(hostname);
    const first = records[0];
    return first ? first.replace(/\.$/, '').toLowerCase() : null;
  } catch {
    return null;
  }
}

export async function txtRecordsAt(name: string): Promise<string[]> {
  try {
    const chunks = await dns.resolveTxt(name);
    return chunks.map((c) => c.join(''));
  } catch {
    return [];
  }
}

export function cnameMatchesPlatformTarget(observed: string | null, expectedFqdn: string): boolean {
  if (!observed) return false;
  const o = observed.toLowerCase().replace(/\.$/, '');
  const e = expectedFqdn.toLowerCase().replace(/\.$/, '');
  return o === e || o.endsWith(`.${e}`);
}
