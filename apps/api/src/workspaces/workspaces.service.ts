import { ConflictException, Injectable } from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listForUser(userId: string) {
    return this.prisma.workspace.findMany({
      where: { members: { some: { userId } } },
      orderBy: { name: 'asc' },
    });
  }

  async create(
    userId: string,
    input: { name: string; slug: string },
  ) {
    const existing = await this.prisma.workspace.findUnique({ where: { slug: input.slug } });
    if (existing) {
      throw new ConflictException('workspace_slug_taken');
    }
    const ws = await this.prisma.workspace.create({
      data: {
        name: input.name,
        slug: input.slug,
        members: {
          create: { userId, role: WorkspaceRole.OWNER },
        },
      },
    });
    await this.audit.record({
      workspaceId: ws.id,
      actorUserId: userId,
      action: 'workspace.created',
      resource: 'workspace',
      resourceId: ws.id,
    });
    return ws;
  }

  async get(workspaceId: string) {
    return this.prisma.workspace.findUnique({ where: { id: workspaceId } });
  }
}
