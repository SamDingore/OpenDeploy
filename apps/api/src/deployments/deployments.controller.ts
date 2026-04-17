import {
  Body,
  Controller,
  Get,
  MessageEvent,
  Param,
  Post,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Observable, filter, from, map, mergeMap } from 'rxjs';
import { success } from '@opendeploy/shared';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { MinWorkspaceRole } from '../auth/roles.decorator';
import { WorkspaceAccessGuard } from '../auth/workspace-access.guard';
import { WorkspaceRole } from '@prisma/client';
import { CreateDeploymentDto } from './dto/create-deployment.dto';
import { DeploymentEventsService } from './deployment-events.service';
import { DeploymentsService } from './deployments.service';

@Controller('workspaces/:workspaceId/projects/:projectId/deployments')
@UseGuards(ClerkAuthGuard, WorkspaceAccessGuard)
export class DeploymentsController {
  constructor(
    private readonly deployments: DeploymentsService,
    private readonly events: DeploymentEventsService,
  ) {}

  @Get()
  @MinWorkspaceRole(WorkspaceRole.VIEWER)
  async list(@Param('workspaceId') workspaceId: string, @Param('projectId') projectId: string) {
    const rows = await this.deployments.listForProject(workspaceId, projectId);
    return success(rows);
  }

  @Post()
  @MinWorkspaceRole(WorkspaceRole.MEMBER)
  async create(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @CurrentUserId() userId: string,
    @Body() body: CreateDeploymentDto,
  ) {
    const result = await this.deployments.create({
      workspaceId,
      projectId,
      environmentId: body.environmentId,
      actorUserId: userId,
      gitRef: body.gitRef,
      framework: body.framework,
      installCommand: body.installCommand,
      buildCommand: body.buildCommand,
      startCommand: body.startCommand,
      rootDirectory: body.rootDirectory,
    });
    return success(result);
  }

  @Get(':deploymentId')
  @MinWorkspaceRole(WorkspaceRole.VIEWER)
  async get(
    @Param('workspaceId') workspaceId: string,
    @Param('deploymentId') deploymentId: string,
  ) {
    const row = await this.deployments.get(workspaceId, deploymentId);
    return success(row);
  }

  @Post(':deploymentId/retry')
  @MinWorkspaceRole(WorkspaceRole.MEMBER)
  async retry(
    @Param('workspaceId') workspaceId: string,
    @Param('deploymentId') deploymentId: string,
    @CurrentUserId() userId: string,
  ) {
    const result = await this.deployments.retryBuild({
      workspaceId,
      deploymentId,
      actorUserId: userId,
    });
    return success(result);
  }

  @Sse(':deploymentId/events')
  @MinWorkspaceRole(WorkspaceRole.VIEWER)
  stream(
    @Param('workspaceId') workspaceId: string,
    @Param('deploymentId') deploymentId: string,
  ): Observable<MessageEvent> {
    return from(this.deployments.get(workspaceId, deploymentId)).pipe(
      mergeMap(() =>
        this.events.stream().pipe(
          filter((e) => e.deploymentId === deploymentId),
          map((e) => ({ data: JSON.stringify(e) })),
        ),
      ),
    );
  }
}
