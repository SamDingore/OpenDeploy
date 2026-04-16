import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EnvironmentType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(workspaceId: string) {
    return this.prisma.project.findMany({
      where: { workspaceId },
      orderBy: { name: 'asc' },
      include: { environments: true, repositoryLinks: true },
    });
  }

  async create(
    workspaceId: string,
    actorUserId: string,
    input: { name: string; slug: string },
  ) {
    const existing = await this.prisma.project.findUnique({
      where: { workspaceId_slug: { workspaceId, slug: input.slug } },
    });
    if (existing) {
      throw new ConflictException('project_slug_taken');
    }
    const project = await this.prisma.project.create({
      data: {
        workspaceId,
        name: input.name,
        slug: input.slug,
        environments: {
          create: [
            { type: EnvironmentType.preview, name: 'Preview', slug: 'preview' },
            { type: EnvironmentType.production, name: 'Production', slug: 'production' },
          ],
        },
      },
      include: { environments: true },
    });
    await this.audit.record({
      workspaceId,
      actorUserId,
      action: 'project.created',
      resource: 'project',
      resourceId: project.id,
    });
    return project;
  }

  async get(workspaceId: string, projectId: string) {
    const p = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId },
      include: { environments: true, repositoryLinks: true },
    });
    if (!p) {
      throw new NotFoundException('project_not_found');
    }
    return p;
  }
}
