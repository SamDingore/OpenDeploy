import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import { success } from '@opendeploy/shared';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { MinWorkspaceRole } from '../auth/roles.decorator';
import { WorkspaceAccessGuard } from '../auth/workspace-access.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('workspaces/:workspaceId/workers')
@UseGuards(ClerkAuthGuard, WorkspaceAccessGuard)
export class WorkersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @MinWorkspaceRole(WorkspaceRole.ADMIN)
  async list() {
    const nodes = await this.prisma.workerNode.findMany({
      orderBy: { lastHeartbeatAt: 'desc' },
      take: 50,
      include: { nodePool: true },
    });
    return success(nodes);
  }
}
