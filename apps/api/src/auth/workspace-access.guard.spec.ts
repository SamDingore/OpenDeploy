import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceRole } from '@prisma/client';
import { WorkspaceAccessGuard } from './workspace-access.guard';

describe('WorkspaceAccessGuard', () => {
  it('denies when user is not a workspace member', async () => {
    const prisma = {
      workspaceMember: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(WorkspaceRole.VIEWER),
    };
    const guard = new WorkspaceAccessGuard(prisma as never, reflector as never);
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ userId: 'user_1', params: { workspaceId: 'ws_1' } }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    };
    await expect(guard.canActivate(ctx as never)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies when role is insufficient', async () => {
    const prisma = {
      workspaceMember: {
        findUnique: vi.fn().mockResolvedValue({ role: WorkspaceRole.VIEWER }),
      },
    };
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(WorkspaceRole.ADMIN),
    };
    const guard = new WorkspaceAccessGuard(prisma as never, reflector as never);
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ userId: 'user_1', params: { workspaceId: 'ws_1' } }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    };
    await expect(guard.canActivate(ctx as never)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
