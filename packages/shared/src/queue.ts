import type { DeploymentStatus } from './enums';

export const DEPLOYMENT_QUEUE_NAME = 'deployments';

export const RELEASE_QUEUE_NAME = 'releases';

export const RELEASE_TEARDOWN_QUEUE_NAME = 'release-teardown';

export interface DeploymentJobPayload {
  deploymentId: string;
  deploymentAttemptId: string;
  workspaceId: string;
  projectId: string;
  /** W3C trace context for workers (filled by API when OTel is active). */
  traceCarrier?: Record<string, string>;
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
  traceCarrier?: Record<string, string>;
}

export interface ReleaseTeardownPayload {
  releaseId: string;
  reason: 'pr_closed' | 'superseded' | 'ttl' | 'manual';
  traceCarrier?: Record<string, string>;
}
