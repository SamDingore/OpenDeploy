import type { DeploymentStatus } from '../../../../generated/prisma/client';

/** Maps Prisma deployment status to the API / SSE string form */
export function deploymentStatusToApi(status: DeploymentStatus): string {
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
