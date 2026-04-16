import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { WorkerStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { DeploymentStatus } from '@opendeploy/shared';
import { WorkerStatusDto, WorkerLogDto, WorkerRegisterDto } from '../deployments/dto/worker-status.dto';
import { DeploymentsService } from '../deployments/deployments.service';
import { success } from '@opendeploy/shared';
import { PrismaService } from '../prisma/prisma.service';
import { InternalSecretGuard } from './internal-secret.guard';
import { GithubService } from '../github/github.service';

@Controller('internal')
@UseGuards(InternalSecretGuard)
export class InternalController {
  constructor(
    private readonly deployments: DeploymentsService,
    private readonly prisma: PrismaService,
    private readonly github: GithubService,
  ) {}

  @Post('workers/register')
  async register(@Body() body: WorkerRegisterDto) {
    const poolName = body.nodePoolName ?? 'default';
    const pool = await this.prisma.nodePool.upsert({
      where: { name: poolName },
      create: {
        name: poolName,
        kind: 'mixed',
        supportsRootless: body.poolSupportsRootless ?? body.rootlessCapable ?? false,
      },
      update: {
        ...(body.poolSupportsRootless === true || body.rootlessCapable === true
          ? { supportsRootless: true }
          : {}),
      },
    });

    const node = await this.prisma.workerNode.create({
      data: {
        name: body.name,
        status: 'online',
        lastHeartbeatAt: new Date(),
        metadata: body.metadata as Prisma.InputJsonValue | undefined,
        nodePoolId: pool.id,
        rootlessCapable: body.rootlessCapable ?? false,
        runnerClass: body.runnerClass ?? 'standard',
        workerIdentityFingerprint: body.workerIdentityFingerprint ?? null,
      },
    });
    return success({ workerId: node.id });
  }

  @Patch('workers/:id/heartbeat')
  async heartbeat(@Param('id') id: string) {
    await this.prisma.workerNode.update({
      where: { id },
      data: { lastHeartbeatAt: new Date(), status: 'online' },
    });
    return success({ ok: true });
  }

  @Patch('deployments/:deploymentId/status')
  async status(@Param('deploymentId') deploymentId: string, @Body() body: WorkerStatusDto) {
    if (body.logMessage) {
      await this.deployments.appendLog(deploymentId, {
        level: body.logLevel ?? 'info',
        message: body.logMessage,
      });
    }
    await this.deployments.transitionStatus(
      deploymentId,
      body.status,
      body.failureCode ?? null,
      undefined,
      body.failureDetail,
    );
    return success({ ok: true });
  }

  @Post('deployments/:deploymentId/logs')
  async log(@Param('deploymentId') deploymentId: string, @Body() body: WorkerLogDto) {
    await this.deployments.appendLog(deploymentId, {
      level: body.level,
      message: body.message,
    });
    return success({ ok: true });
  }

  @Get('deployments/:deploymentId/build-input')
  async buildInput(@Param('deploymentId') deploymentId: string) {
    const dep = await this.prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: { project: { include: { repositoryLinks: { include: { installation: true } } } } },
    });
    if (!dep) {
      return success({ ok: false, error: 'deployment_not_found' });
    }
    const link = dep.project.repositoryLinks[0];
    if (!link) {
      return success({ ok: false, error: 'project_repo_not_linked' });
    }
    if (!dep.commitSha) {
      return success({ ok: false, error: 'deployment_missing_commit_sha' });
    }
    return success({
      deploymentId: dep.id,
      commitSha: dep.commitSha,
      repoFullName: link.fullName,
      providerInstallationId: link.installation.providerInstallationId,
      defaultBranch: link.defaultBranch,
    });
  }

  @Post('github/installations/:providerInstallationId/token')
  async installationToken(@Param('providerInstallationId') providerInstallationId: string) {
    const { token, expiresAt } =
      await this.github.createInstallationAccessToken(providerInstallationId);
    return success({ token, expiresAt });
  }

  @Post('deployments/:deploymentId/artifacts')
  async persistArtifact(
    @Param('deploymentId') deploymentId: string,
    @Body()
    body: {
      imageTag: string;
      imageDigest?: string;
      registryType?: string;
      registryRepository?: string;
      buildContextBytes?: number;
      dockerfilePath?: string;
      builderVersion?: string;
      metadataJson?: Prisma.InputJsonValue;
      sourceSnapshot?: {
        repoOwner?: string;
        repoName?: string;
        installationId?: string;
        commitSha: string;
        cloneUrlMasked?: string;
        defaultBranch?: string;
      };
    },
  ) {
    const artifact = await this.prisma.buildArtifact.create({
      data: {
        deploymentId,
        imageTag: body.imageTag,
        imageDigest: body.imageDigest ?? null,
        registryType: body.registryType ?? null,
        registryRepository: body.registryRepository ?? null,
        buildContextBytes: body.buildContextBytes ?? null,
        dockerfilePath: body.dockerfilePath ?? null,
        builderVersion: body.builderVersion ?? null,
        metadataJson: (body.metadataJson as Prisma.InputJsonValue | undefined) ?? undefined,
      },
    });
    if (body.sourceSnapshot) {
      await this.prisma.sourceSnapshot.upsert({
        where: { deploymentId },
        update: {
          repoOwner: body.sourceSnapshot.repoOwner ?? null,
          repoName: body.sourceSnapshot.repoName ?? null,
          installationId: body.sourceSnapshot.installationId ?? null,
          commitSha: body.sourceSnapshot.commitSha,
          cloneUrlMasked: body.sourceSnapshot.cloneUrlMasked ?? null,
          defaultBranch: body.sourceSnapshot.defaultBranch ?? null,
        },
        create: {
          deploymentId,
          repoOwner: body.sourceSnapshot.repoOwner ?? null,
          repoName: body.sourceSnapshot.repoName ?? null,
          installationId: body.sourceSnapshot.installationId ?? null,
          commitSha: body.sourceSnapshot.commitSha,
          cloneUrlMasked: body.sourceSnapshot.cloneUrlMasked ?? null,
          defaultBranch: body.sourceSnapshot.defaultBranch ?? null,
        },
      });
    }
    return success({ artifactId: artifact.id });
  }

  @Post('deployments/:deploymentId/attempt/:attemptId/assign-worker')
  async assign(
    @Param('deploymentId') deploymentId: string,
    @Param('attemptId') attemptId: string,
    @Body() body: { workerId: string },
  ) {
    const wn = await this.prisma.workerNode.findUnique({ where: { id: body.workerId } });
    if (!wn || wn.status !== WorkerStatus.online) {
      throw new BadRequestException('worker_not_assignable');
    }
    await this.prisma.deploymentAttempt.update({
      where: { id: attemptId },
      data: { workerNodeId: body.workerId, startedAt: new Date() },
    });
    await this.deployments.transitionStatus(
      deploymentId,
      DeploymentStatus.assigned,
      null,
      undefined,
    );
    return success({ ok: true });
  }
}
