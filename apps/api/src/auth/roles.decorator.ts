import { SetMetadata } from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import { WORKSPACE_ROLES_KEY } from './workspace-access.guard';

export const MinWorkspaceRole = (role: WorkspaceRole) => SetMetadata(WORKSPACE_ROLES_KEY, role);
