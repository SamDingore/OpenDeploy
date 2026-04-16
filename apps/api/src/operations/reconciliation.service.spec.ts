import { describe, expect, it, vi } from 'vitest';
import { ReconciliationKind, WorkerStatus } from '@prisma/client';
import { ReconciliationService } from './reconciliation.service';

function mockPrisma(overrides: Record<string, unknown>) {
  const base = {
    reconciliationRun: {
      create: vi.fn().mockResolvedValue({ id: 'run1' }),
      update: vi.fn().mockResolvedValue({}),
    },
    nodeLease: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn().mockResolvedValue({}) },
    runtimeInstance: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
    workerNode: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
    certificateRecord: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
    release: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
  };
  return { ...base, ...overrides } as typeof base;
}

describe('ReconciliationService', () => {
  it('releases expired leases', async () => {
    const prisma = mockPrisma({
      nodeLease: {
        findMany: vi.fn().mockResolvedValue([{ id: 'l1' }]),
        update: vi.fn().mockResolvedValue({}),
      },
    });
    const svc = new ReconciliationService(prisma as never);
    await svc.runScheduledRound();
    expect(prisma.nodeLease.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'l1' } }),
    );
    const kinds = prisma.reconciliationRun.create.mock.calls.map(
      (c) => (c[0] as { data: { kind: string } }).data.kind,
    );
    expect(kinds).toContain(ReconciliationKind.lease);
  });

  it('marks stale online workers offline', async () => {
    const prisma = mockPrisma({
      workerNode: {
        findMany: vi.fn().mockResolvedValue([{ id: 'w1' }]),
        update: vi.fn().mockResolvedValue({}),
      },
    });
    const svc = new ReconciliationService(prisma as never);
    await svc.runScheduledRound();
    expect(prisma.workerNode.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'w1' },
        data: { status: WorkerStatus.offline },
      }),
    );
  });
});
