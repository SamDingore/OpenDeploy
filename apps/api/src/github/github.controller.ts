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
}
