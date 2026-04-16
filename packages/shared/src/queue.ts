import type { DeploymentStatus } from './enums';

export const DEPLOYMENT_QUEUE_NAME = 'deployments';

export const RELEASE_QUEUE_NAME = 'releases';

export const RELEASE_TEARDOWN_QUEUE_NAME = 'release-teardown';

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

export type ReleaseJobKind = 'provision';

export interface ReleaseJobPayload {
  releaseId: string;
  kind: ReleaseJobKind;
}

export interface ReleaseTeardownPayload {
  releaseId: string;
  reason: 'pr_closed' | 'superseded' | 'ttl' | 'manual';
}
