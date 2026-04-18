import type { Job } from 'bullmq';

export type DeploymentJobData = { deploymentId: string };

export function readDeploymentIdFromJob(job: Job): string | undefined {
  const raw = job.data as unknown;
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const id = (raw as DeploymentJobData).deploymentId;
  return typeof id === 'string' ? id : undefined;
}
