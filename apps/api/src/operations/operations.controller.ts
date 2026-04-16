import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import { success } from '@opendeploy/shared';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { MinWorkspaceRole } from '../auth/roles.decorator';
import { WorkspaceAccessGuard } from '../auth/workspace-access.guard';
import { PrismaService } from '../prisma/prisma.service';
import { CaddyService } from '../edge/caddy.service';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

class EdgeRollbackDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}

@Controller('workspaces/:workspaceId/operations')
@UseGuards(ClerkAuthGuard, WorkspaceAccessGuard)
export class OperationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly caddy: CaddyService,
  ) {}

  @Get('node-pools')
  @MinWorkspaceRole(WorkspaceRole.ADMIN)
  async nodePools() {
    const pools = await this.prisma.nodePool.findMany({
      orderBy: { name: 'asc' },
      include: {
        workerNodes: {
          orderBy: { lastHeartbeatAt: 'desc' },
          take: 50,
        },
      },
    });
    return success(pools);
  }

  @Get('reconciliation-runs')
  @MinWorkspaceRole(WorkspaceRole.ADMIN)
  async reconciliationRuns() {
    const rows = await this.prisma.reconciliationRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 100,
    });
    return success(rows);
  }

  @Get('capacity-events')
  @MinWorkspaceRole(WorkspaceRole.ADMIN)
  async capacityEvents() {
    const rows = await this.prisma.capacityEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return success(rows);
  }

  @Get('quotas')
  @MinWorkspaceRole(WorkspaceRole.ADMIN)
  async quotas(@Param('workspaceId') workspaceId: string) {
    const row = await this.prisma.workspaceQuota.findUnique({ where: { workspaceId } });
    return success(
      row ?? {
        workspaceId,
        maxConcurrentBuilds: 5,
        maxConcurrentRuntimes: 20,
        maxCertJobsInFlight: 10,
        maxEdgeReloadsPerHour: 120,
        maxCustomDomains: 50,
        inheritedDefaults: true,
      },
    );
  }

  @Get('edge-config-versions')
  @MinWorkspaceRole(WorkspaceRole.ADMIN)
  async edgeConfigVersions() {
    const rows = await this.prisma.edgeConfigVersion.findMany({
      orderBy: [{ edgeNodeId: 'asc' }, { version: 'desc' }],
      take: 50,
      select: {
        id: true,
        edgeNodeId: true,
        version: true,
        configHash: true,
        applyStatus: true,
        appliedAt: true,
        errorDetail: true,
        actorHint: true,
      },
    });
    return success(rows);
  }

  @Post('edge-config/rollback')
  @MinWorkspaceRole(WorkspaceRole.ADMIN)
  async rollbackEdge(
    @Param('workspaceId') workspaceId: string,
    @Body() body: EdgeRollbackDto,
    @CurrentUserId() userId: string,
  ) {
    await this.caddy.rollbackToVersion(body.version, {
      workspaceId,
      actorUserId: userId,
    });
    return success({ ok: true });
  }
}
