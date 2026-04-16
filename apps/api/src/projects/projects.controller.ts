import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import { success } from '@opendeploy/shared';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { MinWorkspaceRole } from '../auth/roles.decorator';
import { WorkspaceAccessGuard } from '../auth/workspace-access.guard';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectsService } from './projects.service';

@Controller('workspaces/:workspaceId/projects')
@UseGuards(ClerkAuthGuard, WorkspaceAccessGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @MinWorkspaceRole(WorkspaceRole.VIEWER)
  async list(@Param('workspaceId') workspaceId: string) {
    const rows = await this.projects.list(workspaceId);
    return success(rows);
  }

  @Post()
  @MinWorkspaceRole(WorkspaceRole.ADMIN)
  async create(
    @Param('workspaceId') workspaceId: string,
    @CurrentUserId() userId: string,
    @Body() body: CreateProjectDto,
  ) {
    const row = await this.projects.create(workspaceId, userId, body);
    return success(row);
  }

  @Get(':projectId')
  @MinWorkspaceRole(WorkspaceRole.VIEWER)
  async get(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
  ) {
    const row = await this.projects.get(workspaceId, projectId);
    return success(row);
  }
}
