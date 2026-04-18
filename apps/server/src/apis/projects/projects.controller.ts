import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CurrentClerkAuth } from '../../auth/clerk-auth.decorator';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import type { ClerkJwtPayload } from '../../auth/clerk-auth.types';
import { PrismaService } from '../../prisma/prisma.service';

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
  constructor(private readonly prisma: PrismaService) {}

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
      where: {
        id: projectId,
        clerkUserId,
      },
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
    return {
      project: {
        id: project.id,
        name: project.name,
        framework: project.framework,
        domain: project.productionDomain,
        repository: project.githubRepository,
        createdAt: project.createdAt,
      },
    };
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
