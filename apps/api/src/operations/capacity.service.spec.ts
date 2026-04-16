import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { DeploymentStatus, ReleaseStatus } from '@prisma/client';
import { CapacityService } from './capacity.service';

describe('CapacityService', () => {
  it('rejects enqueue when build quota is saturated', async () => {
    const prisma = {
      workspaceQuota: {
        findUnique: vi.fn().mockResolvedValue({ maxConcurrentBuilds: 2 }),
      },
      deployment: {
        count: vi.fn().mockResolvedValue(2),
      },
      capacityEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    const svc = new CapacityService(prisma as never);
    await expect(svc.assertCanEnqueueBuild('ws1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.deployment.count).toHaveBeenCalledWith({
      where: {
        workspaceId: 'ws1',
        status: {
          in: [
            DeploymentStatus.queued,
            DeploymentStatus.assigned,
            DeploymentStatus.fetching_source,
            DeploymentStatus.preparing_context,
            DeploymentStatus.building_image,
            DeploymentStatus.pushing_image,
          ],
        },
      },
    });
  });

  it('allows provision when under default runtime quota', async () => {
    const prisma = {
      workspaceQuota: { findUnique: vi.fn().mockResolvedValue(null) },
      release: { count: vi.fn().mockResolvedValue(0) },
      capacityEvent: { create: vi.fn() },
    };
    const svc = new CapacityService(prisma as never);
    await expect(svc.assertCanProvisionRuntime('ws1')).resolves.toBeUndefined();
    expect(prisma.release.count).toHaveBeenCalledWith({
      where: {
        workspaceId: 'ws1',
        status: {
          in: [
            ReleaseStatus.pending,
            ReleaseStatus.provisioning_runtime,
            ReleaseStatus.starting,
            ReleaseStatus.health_checking,
          ],
        },
      },
    });
  });
});
