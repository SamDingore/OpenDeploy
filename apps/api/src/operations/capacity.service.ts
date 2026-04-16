import { BadRequestException, Injectable } from '@nestjs/common';
import { DeploymentStatus, ReleaseStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ACTIVE_BUILD_STATUSES: DeploymentStatus[] = [
  DeploymentStatus.queued,
  DeploymentStatus.assigned,
  DeploymentStatus.fetching_source,
  DeploymentStatus.preparing_context,
  DeploymentStatus.building_image,
  DeploymentStatus.pushing_image,
];

const PROVISIONING_RELEASE_STATUSES: ReleaseStatus[] = [
  ReleaseStatus.pending,
  ReleaseStatus.provisioning_runtime,
  ReleaseStatus.starting,
  ReleaseStatus.health_checking,
];

@Injectable()
export class CapacityService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCanEnqueueBuild(workspaceId: string): Promise<void> {
    const quota =
      (await this.prisma.workspaceQuota.findUnique({ where: { workspaceId } })) ?? null;
    const max = quota?.maxConcurrentBuilds ?? 5;
    const active = await this.prisma.deployment.count({
      where: { workspaceId, status: { in: ACTIVE_BUILD_STATUSES } },
    });
    if (active >= max) {
      await this.prisma.capacityEvent.create({
        data: {
          type: 'quota_denied',
          payloadJson: { workspaceId, kind: 'build', active, max },
        },
      });
      throw new BadRequestException('workspace_build_quota_exceeded');
    }
  }

  async assertCanProvisionRuntime(workspaceId: string): Promise<void> {
    const quota =
      (await this.prisma.workspaceQuota.findUnique({ where: { workspaceId } })) ?? null;
    const max = quota?.maxConcurrentRuntimes ?? 20;
    const active = await this.prisma.release.count({
      where: { workspaceId, status: { in: PROVISIONING_RELEASE_STATUSES } },
    });
    if (active >= max) {
      await this.prisma.capacityEvent.create({
        data: {
          type: 'quota_denied',
          payloadJson: { workspaceId, kind: 'runtime_provision', active, max },
        },
      });
      throw new BadRequestException('workspace_runtime_quota_exceeded');
    }
  }
}
