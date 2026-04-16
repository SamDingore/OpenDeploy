import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import { success } from '@opendeploy/shared';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { MinWorkspaceRole } from '../auth/roles.decorator';
import { WorkspaceAccessGuard } from '../auth/workspace-access.guard';
import { CustomDomainsService } from './custom-domains.service';
import { AddCustomDomainDto } from './dto/add-custom-domain.dto';
import { AttachCustomDomainDto } from './dto/attach-custom-domain.dto';

@Controller(
  'workspaces/:workspaceId/projects/:projectId/environments/:environmentId/custom-domains',
)
@UseGuards(ClerkAuthGuard, WorkspaceAccessGuard)
export class CustomDomainsController {
  constructor(private readonly customDomains: CustomDomainsService) {}

  @Get()
  @MinWorkspaceRole(WorkspaceRole.VIEWER)
  async list(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('environmentId') environmentId: string,
  ) {
    const rows = await this.customDomains.listForEnvironment(workspaceId, projectId, environmentId);
    const withInstructions = rows.map((r) => ({
      ...r,
      dnsInstructions: this.customDomains.instructionsFor(
        { hostname: r.hostname, verificationToken: r.verificationToken },
        r.project.slug,
      ),
    }));
    return success(withInstructions);
  }

  @Get(':customDomainId')
  @MinWorkspaceRole(WorkspaceRole.VIEWER)
  async get(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('environmentId') environmentId: string,
    @Param('customDomainId') customDomainId: string,
  ) {
    const row = await this.customDomains.getOne(
      workspaceId,
      projectId,
      environmentId,
      customDomainId,
    );
    return success({
      ...row,
      dnsInstructions: this.customDomains.instructionsFor(
        { hostname: row.hostname, verificationToken: row.verificationToken },
        row.project.slug,
      ),
    });
  }

  @Post()
  @MinWorkspaceRole(WorkspaceRole.MEMBER)
  async add(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('environmentId') environmentId: string,
    @CurrentUserId() userId: string,
    @Body() body: AddCustomDomainDto,
  ) {
    const row = await this.customDomains.addDomain({
      workspaceId,
      projectId,
      environmentId,
      hostnameRaw: body.hostname,
      actorUserId: userId,
    });
    return success(row);
  }

  @Post(':customDomainId/recheck')
  @MinWorkspaceRole(WorkspaceRole.MEMBER)
  async recheck(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('environmentId') environmentId: string,
    @Param('customDomainId') customDomainId: string,
  ) {
    return success(
      await this.customDomains.recheck(workspaceId, projectId, environmentId, customDomainId),
    );
  }

  @Post(':customDomainId/attach')
  @MinWorkspaceRole(WorkspaceRole.MEMBER)
  async attach(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('environmentId') environmentId: string,
    @Param('customDomainId') customDomainId: string,
    @CurrentUserId() userId: string,
    @Body() body: AttachCustomDomainDto,
  ) {
    return success(
      await this.customDomains.attach({
        workspaceId,
        projectId,
        environmentId,
        customDomainId,
        releaseId: body.releaseId,
        actorUserId: userId,
      }),
    );
  }

  @Post(':customDomainId/detach')
  @MinWorkspaceRole(WorkspaceRole.MEMBER)
  async detach(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('environmentId') environmentId: string,
    @Param('customDomainId') customDomainId: string,
    @CurrentUserId() userId: string,
  ) {
    return success(
      await this.customDomains.detach({
        workspaceId,
        projectId,
        environmentId,
        customDomainId,
        actorUserId: userId,
      }),
    );
  }

  @Post(':customDomainId/retry-issuance')
  @MinWorkspaceRole(WorkspaceRole.MEMBER)
  async retry(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('environmentId') environmentId: string,
    @Param('customDomainId') customDomainId: string,
  ) {
    return success(
      await this.customDomains.retryIssuance(workspaceId, projectId, environmentId, customDomainId),
    );
  }
}
