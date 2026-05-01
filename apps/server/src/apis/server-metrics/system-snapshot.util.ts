import { statfs } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

type CpuTotals = { idle: number; total: number };

let prevCpuTotals: CpuTotals[] | null = null;
let lastCpuPercent: number | undefined;

function mapCpuTotals(cpus: os.CpuInfo[]): CpuTotals[] {
  return cpus.map((c) => {
    const t = c.times;
    const total = t.user + t.nice + t.sys + t.irq + t.idle;
    return { idle: t.idle, total };
  });
}

/** Call on a steady interval; first call returns undefined until a delta exists. */
export function sampleCpuPercent(): number | undefined {
  const now = mapCpuTotals(os.cpus());
  if (!prevCpuTotals || prevCpuTotals.length !== now.length) {
    prevCpuTotals = now;
    return lastCpuPercent;
  }
  let idleDiff = 0;
  let totalDiff = 0;
  for (let i = 0; i < now.length; i++) {
    idleDiff += now[i]!.idle - prevCpuTotals[i]!.idle;
    totalDiff += now[i]!.total - prevCpuTotals[i]!.total;
  }
  prevCpuTotals = now;
  if (totalDiff <= 0) {
    return lastCpuPercent;
  }
  const pct = Math.min(
    100,
    Math.max(0, 100 - (100 * idleDiff) / totalDiff),
  );
  lastCpuPercent = pct;
  return pct;
}

function filesystemRoot(): string {
  return os.platform() === 'win32' ? path.parse(process.cwd()).root : '/';
}

export type DiskSnapshot = { freeBytes: number; totalBytes: number };

export async function sampleDiskUsage(): Promise<DiskSnapshot | null> {
  try {
    const s = await statfs(filesystemRoot());
    const bsize = Number(s.bsize);
    const blocks = Number(s.blocks);
    const bfree = Number(s.bfree);
    const totalBytes = blocks * bsize;
    const freeBytes = bfree * bsize;
    if (
      !Number.isFinite(totalBytes) ||
      totalBytes <= 0 ||
      !Number.isFinite(freeBytes)
    ) {
      return null;
    }
    return { freeBytes, totalBytes };
  } catch {
    return null;
  }
}

export function buildSystemSnapshot(
  cpuPercent: number | undefined,
  disk: DiskSnapshot | null,
) {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = Math.max(0, totalMem - freeMem);
  return {
    type: 'snapshot' as const,
    hostname: os.hostname(),
    cpuPercent,
    cpuCores: os.cpus().length,
    memoryUsedBytes: usedMem,
    memoryTotalBytes: totalMem,
    diskFreeBytes: disk?.freeBytes ?? null,
    diskTotalBytes: disk?.totalBytes ?? null,
    networkIngressBps: null as number | null,
    networkEgressBps: null as number | null,
    emittedAt: new Date().toISOString(),
  };
}
