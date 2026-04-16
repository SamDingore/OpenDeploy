import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsString, Matches, MinLength } from 'class-validator';
import { WorkspaceRole } from '@prisma/client';
import { success } from '@opendeploy/shared';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { MinWorkspaceRole } from '../auth/roles.decorator';
import { WorkspaceAccessGuard } from '../auth/workspace-access.guard';
import { WorkspacesService } from './workspaces.service';

class CreateWorkspaceDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  slug!: string;
}

@Controller('workspaces')
@UseGuards(ClerkAuthGuard)
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get()
  async mine(@CurrentUserId() userId: string) {
    const list = await this.workspaces.listForUser(userId);
    return success(list);
  }

  @Post()
  async create(@CurrentUserId() userId: string, @Body() body: CreateWorkspaceDto) {
    const ws = await this.workspaces.create(userId, body);
    return success(ws);
  }

  @Get(':workspaceId')
  @UseGuards(WorkspaceAccessGuard)
  @MinWorkspaceRole(WorkspaceRole.VIEWER)
  async get(@Param('workspaceId') workspaceId: string) {
    const ws = await this.workspaces.get(workspaceId);
    return success(ws);
  }
}
