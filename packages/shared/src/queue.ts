import type { DeploymentStatus } from './enums';

export const DEPLOYMENT_QUEUE_NAME = 'deployments';

export interface DeploymentJobPayload {
  deploymentId: string;
  deploymentAttemptId: string;
  workspaceId: string;
  projectId: string;
}

export interface DeploymentEventPayload {
  deploymentId: string;
  status: DeploymentStatus;
  attemptId: string;
  at: string;
}
