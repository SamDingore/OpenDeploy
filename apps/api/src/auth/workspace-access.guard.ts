import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthedRequest } from './clerk-auth.guard';

export const WORKSPACE_ROLES_KEY = 'workspace_roles';

/** Minimum role required (hierarchy: VIEWER < MEMBER < ADMIN < OWNER) */
const rank: Record<WorkspaceRole, number> = {
  VIEWER: 0,
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

@Injectable()
export class WorkspaceAccessGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const userId = req.userId;
    if (!userId) {
      throw new ForbiddenException('not_authenticated');
    }

    const workspaceId = req.params['workspaceId'] ?? req.params['id'];
    if (!workspaceId || typeof workspaceId !== 'string') {
      throw new ForbiddenException('workspace_required');
    }

    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership) {
      throw new ForbiddenException('workspace_forbidden');
    }

    const minRole =
      this.reflector.getAllAndOverride<WorkspaceRole>(WORKSPACE_ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? WorkspaceRole.VIEWER;

    if (rank[membership.role] < rank[minRole]) {
      throw new ForbiddenException('insufficient_workspace_role');
    }

    (req as AuthedRequest & { workspaceRole?: WorkspaceRole }).workspaceRole = membership.role;
    return true;
  }
}
