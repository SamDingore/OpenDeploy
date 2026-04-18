import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentClerkAuth } from '../../auth/clerk-auth.decorator';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import type { ClerkJwtPayload } from '../../auth/clerk-auth.types';
import type { DeploymentStatus } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DeploymentOrchestratorService } from './deployment-orchestrator.service';

function deploymentStatusToApi(status: DeploymentStatus): string {
  switch (status) {
    case 'READY':
      return 'ready';
    case 'ERROR':
      return 'error';
    case 'BUILDING':
      return 'building';
    case 'QUEUED':
      return 'queued';
    case 'INITIALIZING':
      return 'initializing';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'queued';
  }
}

type ImportGithubProjectBody = {
  githubRepoId?: string | number;
  ownerLogin?: string;
  name?: string;
  fullName?: string;
  defaultBranch?: string | null;
  htmlUrl?: string;
  isPrivate?: boolean;
  framework?: string;
};

type DeploymentEnvInput = {
  key?: string;
  value?: string;
};

type CreateDeploymentBody = {
  projectName?: string;
  frameworkPreset?: string;
  rootDirectory?: string;
  buildCommand?: string;
  outputDirectory?: string;
  installCommand?: string;
  envVars?: DeploymentEnvInput[];
};

function requireClerkUserId(auth: ClerkJwtPayload | undefined): string {
  const sub = auth?.sub;
  if (!sub) {
    throw new UnauthorizedException('Missing Clerk subject');
  }
  return sub;
}

@Controller('apis/projects')
@UseGuards(ClerkAuthGuard)
export class ProjectsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deploymentOrchestrator: DeploymentOrchestratorService,
  ) {}

  private async requireProject(projectId: string, clerkUserId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, clerkUserId },
      include: {
        githubRepository: {
          select: {
            ownerLogin: true,
            name: true,
            fullName: true,
            defaultBranch: true,
            htmlUrl: true,
            isPrivate: true,
          },
        },
      },
    });
    if (!project) {
      throw new BadRequestException('Project not found');
    }
    return project;
  }

  @Get()
  async list(@CurrentClerkAuth() auth: ClerkJwtPayload | undefined) {
    const clerkUserId = requireClerkUserId(auth);
    const projects = await this.prisma.project.findMany({
      where: { clerkUserId },
      orderBy: { createdAt: 'desc' },
      include: {
        githubRepository: {
          select: {
            ownerLogin: true,
            name: true,
            fullName: true,
            defaultBranch: true,
            htmlUrl: true,
            isPrivate: true,
          },
        },
      },
    });
    return {
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        framework: p.framework,
        domain: p.productionDomain,
        repository: {
          ownerLogin: p.githubRepository.ownerLogin,
          name: p.githubRepository.name,
          fullName: p.githubRepository.fullName,
          defaultBranch: p.githubRepository.defaultBranch,
          htmlUrl: p.githubRepository.htmlUrl,
          isPrivate: p.githubRepository.isPrivate,
        },
        createdAt: p.createdAt,
      })),
    };
  }

  @Get(':id')
  async getOne(
    @CurrentClerkAuth() auth: ClerkJwtPayload | undefined,
    @Param('id') projectId: string,
  ) {
    const clerkUserId = requireClerkUserId(auth);
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, clerkUserId },
      include: {
        githubRepository: {
          select: {
            ownerLogin: true,
            name: true,
            fullName: true,
            defaultBranch: true,
            htmlUrl: true,
            isPrivate: true,
          },
        },
        deployments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!project) {
      throw new BadRequestException('Project not found');
    }
    return {
      project: {
        id: project.id,
        name: project.name,
        framework: project.framework,
        domain: project.productionDomain,
        repository: project.githubRepository,
        createdAt: project.createdAt,
        deployments: project.deployments.map((d) => ({
          id: d.id,
          status: deploymentStatusToApi(d.status),
          sourceBranch: d.sourceBranch,
          commitSha: d.commitSha,
          commitMessage: d.commitMessage,
          deployedBy: d.deployedBy,
          buildDurationMs: d.buildDurationMs,
          createdAt: d.createdAt.toISOString(),
          updatedAt: d.updatedAt.toISOString(),
        })),
      },
    };
  }

  @Post(':id/deployments')
  async createDeployment(
    @CurrentClerkAuth() auth: ClerkJwtPayload | undefined,
    @Param('id') projectId: string,
    @Body() body: CreateDeploymentBody,
  ) {
    const clerkUserId = requireClerkUserId(auth);
    const project = await this.requireProject(projectId, clerkUserId);

    const projectName = body.projectName?.trim() || project.name;
    const frameworkPreset =
      body.frameworkPreset?.trim() || project.framework || 'Unknown';
    const rootDirectory = body.rootDirectory?.trim() || './';
    const buildCommand = body.buildCommand?.trim() || null;
    const outputDirectory = body.outputDirectory?.trim() || null;
    const installCommand = body.installCommand?.trim() || null;
    const sourceBranch = project.githubRepository.defaultBranch?.trim() || null;
    const sanitizedEnvVars = (body.envVars ?? [])
      .map((entry) => ({
        key: entry.key?.trim() ?? '',
        value: entry.value?.trim() ?? '',
      }))
      .filter((entry) => entry.key.length > 0);

    const deployment = await this.prisma.deployment.create({
      data: {
        projectId: project.id,
        status: 'QUEUED',
        sourceBranch,
        deployedBy: clerkUserId,
        config: {
          create: {
            projectName,
            frameworkPreset,
            rootDirectory,
            buildCommand,
            outputDirectory,
            installCommand,
          },
        },
        environmentVars: {
          create: sanitizedEnvVars,
        },
      },
    });
    this.deploymentOrchestrator.enqueue(deployment.id);

    return {
      deployment: {
        id: deployment.id,
        status: deploymentStatusToApi(deployment.status),
        projectId: deployment.projectId,
      },
    };
  }

  @Get(':id/deployments/:deploymentId')
  async getDeployment(
    @CurrentClerkAuth() auth: ClerkJwtPayload | undefined,
    @Param('id') projectId: string,
    @Param('deploymentId') deploymentId: string,
  ) {
    const clerkUserId = requireClerkUserId(auth);
    await this.requireProject(projectId, clerkUserId);

    const deployment = await this.prisma.deployment.findFirst({
      where: {
        id: deploymentId,
        projectId,
      },
      include: {
        config: true,
        environmentVars: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!deployment) {
      throw new BadRequestException('Deployment not found');
    }

    return {
      deployment: {
        id: deployment.id,
        projectId: deployment.projectId,
        status: deploymentStatusToApi(deployment.status),
        sourceBranch: deployment.sourceBranch,
        commitSha: deployment.commitSha,
        commitMessage: deployment.commitMessage,
        deployedBy: deployment.deployedBy,
        buildDurationMs: deployment.buildDurationMs,
        createdAt: deployment.createdAt.toISOString(),
        updatedAt: deployment.updatedAt.toISOString(),
        config: deployment.config
          ? {
              projectName: deployment.config.projectName,
              frameworkPreset: deployment.config.frameworkPreset,
              rootDirectory: deployment.config.rootDirectory,
              buildCommand: deployment.config.buildCommand,
              outputDirectory: deployment.config.outputDirectory,
              installCommand: deployment.config.installCommand,
            }
          : null,
        environmentVars: deployment.environmentVars.map((entry) => ({
          key: entry.key,
          value: entry.value,
        })),
      },
    };
  }

  @Get(':id/deployments/:deploymentId/stream')
  async streamDeployment(
    @CurrentClerkAuth() auth: ClerkJwtPayload | undefined,
    @Param('id') projectId: string,
    @Param('deploymentId') deploymentId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const clerkUserId = requireClerkUserId(auth);
    await this.requireProject(projectId, clerkUserId);

    const deployment = await this.prisma.deployment.findFirst({
      where: { id: deploymentId, projectId },
      select: { id: true },
    });
    if (!deployment) {
      throw new BadRequestException('Deployment not found');
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const writeEvent = (event: unknown) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    const unsubscribe = this.deploymentOrchestrator.subscribe(
      deploymentId,
      (event) => {
        writeEvent(event);
      },
    );

    const keepAlive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(keepAlive);
      unsubscribe();
      res.end();
    });
  }

  @Post('import-github')
  async importGithubProject(
    @CurrentClerkAuth() auth: ClerkJwtPayload | undefined,
    @Body() body: ImportGithubProjectBody,
  ) {
    const clerkUserId = requireClerkUserId(auth);
    const githubRepoId = body.githubRepoId;
    const ownerLogin = body.ownerLogin?.trim();
    const repoName = body.name?.trim();
    const fullName = body.fullName?.trim();
    const htmlUrl = body.htmlUrl?.trim();
    const isPrivate = body.isPrivate === true;
    const framework = body.framework?.trim() || 'Unknown';
    const repoIdAsString = String(githubRepoId ?? '').trim();

    if (!repoIdAsString || !ownerLogin || !repoName || !fullName || !htmlUrl) {
      throw new BadRequestException('Missing required repository fields');
    }
    if (!/^\d+$/.test(repoIdAsString)) {
      throw new BadRequestException('Invalid githubRepoId');
    }
    const parsedRepoId = BigInt(repoIdAsString);

    const repository = await this.prisma.githubRepository.upsert({
      where: { githubRepoId: parsedRepoId },
      create: {
        githubRepoId: parsedRepoId,
        ownerLogin,
        name: repoName,
        fullName,
        defaultBranch: body.defaultBranch?.trim() || null,
        htmlUrl,
        isPrivate,
      },
      update: {
        ownerLogin,
        name: repoName,
        fullName,
        defaultBranch: body.defaultBranch?.trim() || null,
        htmlUrl,
        isPrivate,
      },
    });

    const generatedDomain = `${repoName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}.opendeploy.app`;
    const project = await this.prisma.project.upsert({
      where: {
        clerkUserId_githubRepositoryId: {
          clerkUserId,
          githubRepositoryId: repository.id,
        },
      },
      create: {
        clerkUserId,
        githubRepositoryId: repository.id,
        name: repoName,
        framework,
        productionDomain: generatedDomain,
      },
      update: {
        name: repoName,
        framework,
      },
    });

    return {
      project: {
        id: project.id,
        name: project.name,
        framework: project.framework,
        domain: project.productionDomain,
      },
    };
  }
}
