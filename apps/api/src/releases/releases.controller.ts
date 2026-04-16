import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import { success } from '@opendeploy/shared';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { MinWorkspaceRole } from '../auth/roles.decorator';
import { WorkspaceAccessGuard } from '../auth/workspace-access.guard';
import { ReleasesService } from './releases.service';

@Controller('workspaces/:workspaceId/projects/:projectId/releases')
@UseGuards(ClerkAuthGuard, WorkspaceAccessGuard)
export class ReleasesController {
  constructor(private readonly releases: ReleasesService) {}

  @Get()
  @MinWorkspaceRole(WorkspaceRole.VIEWER)
  async list(@Param('workspaceId') workspaceId: string, @Param('projectId') projectId: string) {
    const rows = await this.releases.listForProject(workspaceId, projectId);
    return success(rows);
  }

  @Post('promote')
  @MinWorkspaceRole(WorkspaceRole.MEMBER)
  async promote(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @CurrentUserId() userId: string,
    @Body() body: { deploymentId: string },
  ) {
    const row = await this.releases.promoteDeployment({
      workspaceId,
      projectId,
      deploymentId: body.deploymentId,
      actorUserId: userId,
    });
    return success(row);
  }

  @Post('rollback-production')
  @MinWorkspaceRole(WorkspaceRole.MEMBER)
  async rollback(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @CurrentUserId() userId: string,
  ) {
    const row = await this.releases.rollbackProduction({
      workspaceId,
      projectId,
      actorUserId: userId,
    });
    return success(row);
  }

  @Post('environment-secrets')
  @MinWorkspaceRole(WorkspaceRole.ADMIN)
  async upsertSecret(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @CurrentUserId() userId: string,
    @Body() body: { environmentId: string; name: string; value: string },
  ) {
    const row = await this.releases.createEnvironmentSecret({
      workspaceId,
      projectId,
      environmentId: body.environmentId,
      name: body.name,
      value: body.value,
      actorUserId: userId,
    });
    return success(row);
  }

  @Get(':releaseId')
  @MinWorkspaceRole(WorkspaceRole.VIEWER)
  async get(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('releaseId') releaseId: string,
  ) {
    const row = await this.releases.getForProject(workspaceId, projectId, releaseId);
    return success(row);
  }
}
