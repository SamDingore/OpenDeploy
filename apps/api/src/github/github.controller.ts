import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { WorkspaceRole } from '@prisma/client';
import { success } from '@opendeploy/shared';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { MinWorkspaceRole } from '../auth/roles.decorator';
import { WorkspaceAccessGuard } from '../auth/workspace-access.guard';
import { GithubService } from './github.service';

class LinkInstallationDto {
  @IsString()
  providerInstallationId!: string;

  @IsOptional()
  @IsString()
  accountLogin?: string;
}

class LinkProjectRepositoryDto {
  @IsString()
  providerInstallationId!: string;

  @IsString()
  providerRepoId!: string;

  @IsString()
  fullName!: string;

  @IsOptional()
  @IsString()
  defaultBranch?: string;
}

@Controller('workspaces/:workspaceId/github')
@UseGuards(ClerkAuthGuard, WorkspaceAccessGuard)
export class GithubController {
  constructor(private readonly github: GithubService) {}

  @Get('install-url')
  @MinWorkspaceRole(WorkspaceRole.ADMIN)
  installUrl(@Param('workspaceId') workspaceId: string) {
    const url = this.github.getInstallUrl(workspaceId);
    return success({ url });
  }

  @Post('link-installation')
  @MinWorkspaceRole(WorkspaceRole.ADMIN)
  async link(
    @Param('workspaceId') workspaceId: string,
    @CurrentUserId() userId: string,
    @Body() body: LinkInstallationDto,
  ) {
    const row = await this.github.linkInstallation({
      workspaceId,
      actorUserId: userId,
      providerInstallationId: body.providerInstallationId,
      accountLogin: body.accountLogin,
    });
    return success(row);
  }

  @Get('installations')
  @MinWorkspaceRole(WorkspaceRole.ADMIN)
  async installations() {
    const rows = await this.github.listAppInstallations();
    return success(rows);
  }

  @Get('installations/:providerInstallationId/repositories')
  @MinWorkspaceRole(WorkspaceRole.ADMIN)
  async installationRepositories(@Param('providerInstallationId') providerInstallationId: string) {
    const rows = await this.github.listInstallationRepositories({ providerInstallationId });
    return success(rows);
  }

  @Post('projects/:projectId/link-repository')
  @MinWorkspaceRole(WorkspaceRole.ADMIN)
  async linkProjectRepository(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @CurrentUserId() userId: string,
    @Body() body: LinkProjectRepositoryDto,
  ) {
    const row = await this.github.linkProjectRepository({
      workspaceId,
      projectId,
      actorUserId: userId,
      providerInstallationId: body.providerInstallationId,
      providerRepoId: body.providerRepoId,
      fullName: body.fullName,
      defaultBranch: body.defaultBranch,
    });
    return success(row);
  }
}
