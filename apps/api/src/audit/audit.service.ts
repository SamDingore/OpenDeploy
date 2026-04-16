import { Injectable } from '@nestjs/common';
import type { Prisma } from '@opendeploy/db';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: {
    workspaceId?: string | null;
    actorUserId?: string | null;
    action: string;
    resource: string;
    resourceId?: string | null;
    metadata?: Prisma.InputJsonValue;
  }): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        workspaceId: input.workspaceId ?? undefined,
        actorUserId: input.actorUserId ?? undefined,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId ?? undefined,
        metadata: input.metadata,
      },
    });
  }
}
